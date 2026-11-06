import makeWASocket, {
  downloadMediaMessage,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  WAMessage,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import P from "pino";
import qrcode from "qrcode-terminal";
import {
  buildDistributionKeys,
  buildOptionsLabel,
  extractText,
  extractContextInfo,
  extractDiscussionBody,
  hasSupportedMedia,
  isSlashSessionCommand,
  isSkipCommand,
  isValidUserAnswer,
  normalizeInput,
  parseAnswerKeyByType,
  parseCadernoCommand,
  parsePrivateCommand,
  parseGabaritoCommand,
  parseOmissasCommand,
  parseAtrasadasCommand,
  parseAdiantarCommand,
  parseSemanaCommand,
  parseEconomyCommand,
  parseProgressoCommand,
  parseQaCommand,
  parseRepeatQuestionCommand,
  parseRespondentsCommand,
  parseSlashSessionCommand,
  parseSyncMembrosCommand,
  parseTypeSelection,
  splitWhatsAppText
} from "./message-utils";
import { buildQuizFullGuide, buildPrivateInvalidFallback } from "./help-text";
import { config } from "./config";
import {
  createQuestion,
  formatQaStatsMessage,
  getCadernoById,
  getCadernoProgress,
  getQuestionResult,
  getQaStatsForGroup,
  getQuestionForRepeat,
  getEngagedUserJidsForCaderno,
  getEngagedEligibleUserJidsForCadernoAt,
  getCadernoQuestionPublishedAt,
  getEngagedUserJidsForMateria,
  listMateriasForGroup,
  getCadernoIdForQuestion,
  getQuestionCreatorAndGroup,
  getQuestionTargetGroupJid,
  getQuizModePrivate,
  insertAnswer,
  SelfAnswerNotAllowedError,
  getUserAnswer,
  listAnswerUserJidsForQuestion,
  listCadernosForOwner,
  listEngagedGroupCadernosForUser,
  adiantarCadernoQuestions,
  adiantarCadernoDays,
  buildSemanaReportForUser,
  formatSemanaReportText,
  resetCadernoPublishedQuestions,
  setCadernoStatus,
  setQuizModePrivate,
  updateUserAnswer,
  upsertGroupMembersFromSync,
  createOmissasWebSession,
  createUserCategory,
  listUserCategories,
  resolveCategoryNames,
  setAnswerCategories,
  insertQuestionWaMessage,
  upsertDiscussionPost,
  findQuestionByWaMessageId,
  findDiscussionCommentByWaMessageId,
  getDiscussionPostByQuestionId,
  insertDiscussionComment,
  listDiscussionCommentsForPost,
  formatDiscussionCommentsTree,
  markDiscussionCommentsSharedToWa,
  getResultWaMessageIdForQuestion,
  isSkippedResultWaMessageId,
  markAutoGabaritoSkipped,
  shouldPostGroupAutoGabarito
} from "./supabase";
import {
  computeNextRunAt,
  dateIsoInTimezone,
  formatNextRunPretty,
  resolveWeekdayNamesToIsos
} from "./schedule";
import { forceRunCaderno, startCadernoScheduler, stopCadernoScheduler, tryAdvanceCadernoAfterAnswer } from "./caderno-scheduler";
import {
  handleFlashcardsPrivateMessage,
  startFlashcardsBot,
  stopFlashcardsBot
} from "./flashcards/bot";
import { tryHandleGastos } from "./gastos-bridge";
import {
  flushEconomyOutbox,
  handleEconomyCommand,
  processEconomyAfterAnswer,
  processEconomyAfterCreateQuestion,
  tryHandlePurchaseConfirm,
  registerWebAnswerSideEffect
} from "./economy/bot-handlers";
import { notifyGroupOmissasEntered } from "./economy/omissas";
import { ECONOMY_TZ } from "./economy/constants";
import { MediaPayload, QuestionDraft, QuestionType } from "./types";

function toIsoTimestamp(value: unknown): string {
  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === "bigint") {
    return new Date(Number(value) * 1000).toISOString();
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    const numeric = (value as { toNumber: () => number }).toNumber();
    return new Date(numeric * 1000).toISOString();
  }
  return new Date().toISOString();
}

function isPrivateChatJid(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid");
}

/**
 * JID do usuario que enviou a mensagem.
 * - No privado: sempre `remoteJid` (participant em DM pode ser lixo e une varias pessoas).
 * - No grupo: tenta `participantAlt` / `remoteJidAlt` (WhatsApp multi-device) e depois `participant`.
 *   Se faltar tudo, cai em `remoteJid` (id do grupo — nao e pessoa; comandos podem falhar).
 */
function resolveActorJid(remoteJid: string, key: WAMessage["key"]): string {
  if (!remoteJid.endsWith("@g.us")) {
    return remoteJid;
  }

  const ext = key as WAMessage["key"] & {
    participantAlt?: string;
    remoteJidAlt?: string;
  };

  const candidates = [ext.participantAlt, ext.remoteJidAlt, key.participant];
  for (const c of candidates) {
    if (c && typeof c === "string" && !c.endsWith("@g.us")) {
      return c;
    }
  }

  return remoteJid;
}

type CreationSession =
  | { stage: "awaiting_type" }
  | { stage: "awaiting_materia"; questionType: QuestionType }
  | { stage: "awaiting_statement"; questionType: QuestionType; materiaId: number }
  | {
      stage: "awaiting_answer_key";
      draft: Omit<QuestionDraft, "answerKey" | "explanationText" | "explanationMedia">;
    }
  | { stage: "awaiting_explanation"; draft: Omit<QuestionDraft, "explanationText" | "explanationMedia"> };

const creationSessions = new Map<string, CreationSession>();
let isStarting = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let activeSocketInstance = 0;
type PendingChange = {
  questionId: string;
  newAnswerLetter: string;
  newAnswerComment?: string | null;
  previousAnswerLetter?: string | null;
  categories?: string[] | null;
};
const pendingAnswerChanges = new Map<string, PendingChange>();

type PendingCategoryResolve = {
  questionId: string;
  answerId: number;
  resolvedIds: number[];
  unknownQueue: string[];
  stage: "ask_create" | "pick_existing";
  currentUnknown: string;
  catalog: { id: number; name: string }[];
};
const pendingCategoryResolve = new Map<string, PendingCategoryResolve>();

/** Privado: lista de short_ids apos /omissas; usuario confirma sim para receber enunciados. */
const omissasOfferByUser = new Map<string, string[]>();

const autoGabaritoPostedQuestionIds = new Set<string>();
const autoGabaritoWaitingQuestionIds = new Set<string>();
const AUTO_GABARITO_AI_WAIT_MS = 6000;
const AUTO_GABARITO_AI_WAIT_TRIES = 12;

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatCategoryList(cats: { id: number; name: string }[]): string {
  if (!cats.length) return "(nenhuma)";
  return cats.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
}

async function beginCategoryResolve(
  sock: WASocket,
  remoteJid: string,
  sender: string,
  questionId: string,
  answerId: number,
  categoryNames: string[] | null | undefined
): Promise<void> {
  if (categoryNames === undefined) return;
  if (categoryNames === null) return;

  if (categoryNames.length === 0) {
    await setAnswerCategories(answerId, []);
    await sock.sendMessage(remoteJid, {
      text: `Categorias da questao #${questionId} limpas.`
    });
    return;
  }

  const { known, unknown, catalog } = await resolveCategoryNames(sender, categoryNames);
  const resolvedIds = known.map((k) => k.id);

  if (!unknown.length) {
    const finalCats = await setAnswerCategories(answerId, resolvedIds);
    const names = finalCats.map((c) => c.name).join(", ") || "(nenhuma)";
    await sock.sendMessage(remoteJid, {
      text: `Categorias da #${questionId}: ${names}`
    });
    return;
  }

  const currentUnknown = unknown[0]!;
  pendingCategoryResolve.set(sender, {
    questionId,
    answerId,
    resolvedIds,
    unknownQueue: unknown.slice(1),
    stage: "ask_create",
    currentUnknown,
    catalog: catalog.map((c) => ({ id: c.id, name: c.name }))
  });

  await sock.sendMessage(remoteJid, {
    text: [
      `Categoria "${currentUnknown}" nao existe.`,
      "Deseja criar uma nova? Responda *sim* ou *nao*."
    ].join("\n")
  });
}

async function finishCategoryResolve(
  sock: WASocket,
  remoteJid: string,
  sender: string,
  pending: PendingCategoryResolve
): Promise<void> {
  const finalCats = await setAnswerCategories(pending.answerId, pending.resolvedIds);
  pendingCategoryResolve.delete(sender);
  const names = finalCats.map((c) => c.name).join(", ") || "(nenhuma)";
  await sock.sendMessage(remoteJid, {
    text: `Categorias da #${pending.questionId} atualizadas: ${names}`
  });
}

async function advanceCategoryResolveQueue(
  sock: WASocket,
  remoteJid: string,
  sender: string,
  pending: PendingCategoryResolve
): Promise<void> {
  if (!pending.unknownQueue.length) {
    await finishCategoryResolve(sock, remoteJid, sender, pending);
    return;
  }
  const currentUnknown = pending.unknownQueue[0]!;
  pending.unknownQueue = pending.unknownQueue.slice(1);
  pending.currentUnknown = currentUnknown;
  pending.stage = "ask_create";
  const catalog = await listUserCategories(sender);
  pending.catalog = catalog.map((c) => ({ id: c.id, name: c.name }));
  pendingCategoryResolve.set(sender, pending);
  await sock.sendMessage(remoteJid, {
    text: [
      `Categoria "${currentUnknown}" nao existe.`,
      "Deseja criar uma nova? Responda *sim* ou *nao*."
    ].join("\n")
  });
}

async function handlePendingCategoryResolve(
  sock: WASocket,
  remoteJid: string,
  sender: string,
  text: string
): Promise<boolean> {
  const pending = pendingCategoryResolve.get(sender);
  if (!pending) return false;

  const normalized = normalizeInput(text);

  if (pending.stage === "ask_create") {
    if (normalized === "sim" || normalized === "s") {
      const created = await createUserCategory(sender, pending.currentUnknown);
      if (!pending.resolvedIds.includes(created.id)) {
        pending.resolvedIds.push(created.id);
      }
      await sock.sendMessage(remoteJid, {
        text: created.alreadyExisted
          ? `Categoria "${created.name}" ja existia — associada.`
          : `Categoria "${created.name}" criada e associada.`
      });
      await advanceCategoryResolveQueue(sock, remoteJid, sender, pending);
      return true;
    }
    if (normalized === "nao" || normalized === "não" || normalized === "n") {
      const catalog = await listUserCategories(sender);
      pending.catalog = catalog.map((c) => ({ id: c.id, name: c.name }));
      if (!pending.catalog.length) {
        await sock.sendMessage(remoteJid, {
          text: [
            "Voce ainda nao tem categorias.",
            `Envie *sim* para criar "${pending.currentUnknown}", ou /newcat nome.`
          ].join("\n")
        });
        return true;
      }
      pending.stage = "pick_existing";
      pendingCategoryResolve.set(sender, pending);
      await sock.sendMessage(remoteJid, {
        text: [
          `Ok. Escolha o numero da categoria para associar no lugar de "${pending.currentUnknown}":`,
          "",
          formatCategoryList(pending.catalog)
        ].join("\n")
      });
      return true;
    }
    await sock.sendMessage(remoteJid, {
      text: `Categoria "${pending.currentUnknown}" nao existe. Deseja criar? Responda *sim* ou *nao*.`
    });
    return true;
  }

  if (pending.stage === "pick_existing") {
    const n = Number(String(text || "").trim());
    if (!Number.isInteger(n) || n < 1 || n > pending.catalog.length) {
      await sock.sendMessage(remoteJid, {
        text: [
          `Envie um numero de 1 a ${pending.catalog.length}:`,
          "",
          formatCategoryList(pending.catalog)
        ].join("\n")
      });
      return true;
    }
    const picked = pending.catalog[n - 1]!;
    if (!pending.resolvedIds.includes(picked.id)) {
      pending.resolvedIds.push(picked.id);
    }
    await sock.sendMessage(remoteJid, {
      text: `Associada: ${picked.name}`
    });
    await advanceCategoryResolveQueue(sock, remoteJid, sender, pending);
    return true;
  }

  return true;
}

function jidComparableKey(jid: string): string {
  const at = jid.indexOf("@");
  if (at < 0) return jid.toLowerCase().trim();
  const userPart = jid.slice(0, at);
  const userNoDevice = userPart.includes(":") ? userPart.split(":")[0]! : userPart;
  const domain = jid.slice(at + 1).toLowerCase();
  return `${userNoDevice}@${domain}`;
}

function participantHasMatchingAnswer(memberJid: string, answeredUserJids: string[]): boolean {
  const pk = jidComparableKey(memberJid);
  for (const a of answeredUserJids) {
    if (a === memberJid) return true;
    if (jidComparableKey(a) === pk) return true;
  }
  return false;
}

function getBotJidComparable(sock: WASocket): string | null {
  const ext = sock as WASocket & {
    user?: { id?: string };
    authState?: { creds?: { me?: { id?: string } } };
  };
  const rawId = ext.user?.id ?? ext.authState?.creds?.me?.id ?? "";
  return rawId ? jidComparableKey(String(rawId)) : null;
}

async function fetchGroupParticipantIds(sock: WASocket, groupJid: string): Promise<string[]> {
  const meta = await sock.groupMetadata(groupJid);
  const parts = meta.participants as { id?: string }[];
  return parts.map((p) => String(p.id || "")).filter(Boolean);
}

function resultHasPendingStudentAi(
  result: Awaited<ReturnType<typeof getQuestionResult>>
): boolean {
  const all = [...result.correctRespondents, ...result.wrongRespondents];
  return all.some((r) => Boolean(r.comment) && !r.aiComment);
}

async function waitForPendingAiComments(
  shortUp: string,
  groupJid: string,
  initial: Awaited<ReturnType<typeof getQuestionResult>>
): Promise<Awaited<ReturnType<typeof getQuestionResult>>> {
  let result = initial;
  if (!resultHasPendingStudentAi(result)) return result;
  for (let i = 0; i < AUTO_GABARITO_AI_WAIT_TRIES; i++) {
    await delayMs(AUTO_GABARITO_AI_WAIT_MS);
    const posted = await getResultWaMessageIdForQuestion(result.questionId, groupJid);
    if (posted) return result;
    result = await getQuestionResult(shortUp);
    if (!resultHasPendingStudentAi(result)) return result;
  }
  return result;
}

async function maybePostAutoGabaritoToGroup(sock: WASocket, rawShortId: string): Promise<void> {
  const shortUp = rawShortId.toUpperCase();

  try {
    if (!config.autoGabaritoWhenAllReply) return;
    if (autoGabaritoPostedQuestionIds.has(shortUp)) return;
    if (autoGabaritoWaitingQuestionIds.has(shortUp)) return;

    const meta = await getQuestionCreatorAndGroup(shortUp);
    if (!meta) return;

    const { targetGroupJid: groupJid, creatorJid } = meta;
    const isPrivateQuizTarget =
      groupJid.endsWith("@s.whatsapp.net") || groupJid.endsWith("@lid");

    if (isPrivateQuizTarget) {
      const answered = await listAnswerUserJidsForQuestion(shortUp);
      const expectJid = groupJid;
      const pk = jidComparableKey(expectJid);
      const answeredComparable = answered.map((j) => jidComparableKey(j));
      const selfAnswered = answeredComparable.some((jc) => jc === pk);
      if (!selfAnswered) return;

      autoGabaritoWaitingQuestionIds.add(shortUp);
      try {
        let result = await getQuestionResult(shortUp);
        const alreadyPosted = await getResultWaMessageIdForQuestion(result.questionId, groupJid);
        if (alreadyPosted) {
          autoGabaritoPostedQuestionIds.add(shortUp);
          return;
        }

        result = await waitForPendingAiComments(shortUp, groupJid, result);
        const postedAfterWait = await getResultWaMessageIdForQuestion(result.questionId, groupJid);
        if (postedAfterWait) {
          autoGabaritoPostedQuestionIds.add(shortUp);
          return;
        }

        autoGabaritoPostedQuestionIds.add(shortUp);
        await publishQuestionResult(sock, groupJid, result, {
          headerPrefix:
            "[Resposta registrada]\nResultado enviado automaticamente (caderno privado)."
        });
      } finally {
        autoGabaritoWaitingQuestionIds.delete(shortUp);
      }
      return;
    }

    const cadernoId = await getCadernoIdForQuestion(shortUp);
    let engaged: string[] = [];
    if (cadernoId != null) {
      const publishedAt = await getCadernoQuestionPublishedAt(shortUp);
      engaged = publishedAt
        ? await getEngagedEligibleUserJidsForCadernoAt(cadernoId, publishedAt)
        : await getEngagedUserJidsForCaderno(cadernoId);
    } else if (meta.materiaId != null) {
      engaged = await getEngagedUserJidsForMateria(meta.materiaId);
    } else {
      console.log(
        "[auto-gabarito] Questão manual sem matéria. Cadastre matérias no site e escolha no wizard."
      );
      return;
    }
    if (engaged.length === 0) {
      console.log(
        cadernoId != null
          ? "[auto-gabarito] Nenhum membro engajado neste caderno. Marque engajados na edição do caderno no site."
          : "[auto-gabarito] Nenhum engajado nesta matéria. Marque engajados no modal Engajamento (por matéria)."
      );
      return;
    }

    const answered = await listAnswerUserJidsForQuestion(shortUp);
    const botComp = getBotJidComparable(sock);
    const creatorComp = jidComparableKey(creatorJid);

    const expectAnswer = engaged.filter((jid) => {
      const jc = jidComparableKey(jid);
      if (botComp && jc === botComp) return false;
      if (jc === creatorComp) return false;
      return true;
    });

    if (expectAnswer.length === 0) {
      console.log(
        "[auto-gabarito] Só o criador (ou só o bot) entre os engajados; não há 'outros' para fechar — use /gabarito manual se quiser."
      );
      return;
    }

    const allAnswered = expectAnswer.every((m) => participantHasMatchingAnswer(m, answered));
    if (!allAnswered) return;

    autoGabaritoWaitingQuestionIds.add(shortUp);
    try {
      const result = await getQuestionResult(shortUp);
      const alreadyPosted = await getResultWaMessageIdForQuestion(result.questionId, groupJid);
      if (alreadyPosted && !isSkippedResultWaMessageId(alreadyPosted)) {
        autoGabaritoPostedQuestionIds.add(shortUp);
        return;
      }

      if (!shouldPostGroupAutoGabarito(result)) {
        if (!alreadyPosted) {
          await markAutoGabaritoSkipped({
            questionId: result.questionId,
            shortId: result.shortId,
            groupJid
          });
        }
        console.log(
          `[auto-gabarito] #${shortUp} omitido no grupo (todos acertaram, sem chute nem discussão).`
        );
        return;
      }

      autoGabaritoPostedQuestionIds.add(shortUp);

      await publishQuestionResult(sock, groupJid, result, {
        headerPrefix: `[Engajados responderam] #${shortUp}`,
        discussionSource: "auto_gabarito"
      });
    } finally {
      autoGabaritoWaitingQuestionIds.delete(shortUp);
    }
  } catch (e) {
    autoGabaritoWaitingQuestionIds.delete(shortUp);
    console.warn("[auto-gabarito]", (e as Error).message);
  }
}

async function buildRespondentsReport(sock: WASocket, rawShortId: string): Promise<string> {
  const result = await getQuestionResult(rawShortId);
  const namesOrdered = [...result.correctUsers, ...result.wrongUsers];

  let totalEligible = 0;
  try {
    const gj = await getQuestionTargetGroupJid(result.shortId);
    if (gj) {
      const memberIds = await fetchGroupParticipantIds(sock, gj);
      const botComp = getBotJidComparable(sock);
      totalEligible = botComp
        ? memberIds.filter((jid) => jidComparableKey(jid) !== botComp).length
        : memberIds.length;
    }
  } catch {
    // sem total do grupo — ainda assim mostra lista
  }

  if (namesOrdered.length === 0) {
    const extra =
      totalEligible > 0 ? ` (~${totalEligible} pessoas no grupo com o bot)` : "";
    return `Ninguem respondeu a questao #${result.shortId} ainda.${extra}\nResponderam no privado com: a ${result.shortId} (ou outra letra).`;
  }

  const countPart =
    totalEligible > 0
      ? ` (${namesOrdered.length}/${totalEligible} no grupo responderam)`
      : ` (${namesOrdered.length} resposta/s registrada/s)`;

  const lines = [
    `Respondentes da questao #${result.shortId}${countPart}`,
    "",
    ...namesOrdered.map((name, idx) => `${idx + 1}. ${name}`),
    "",
    `Resultado completo: /gabarito ${result.shortId}`
  ];
  return lines.join("\n");
}

function getDisplayName(msg: WAMessage, fallbackJid: string): string {
  return (msg.pushName && msg.pushName.trim()) || fallbackJid.split("@")[0];
}

/**
 * Grupo do quiz (publicar no grupo + gravar `target_group_jid` no Supabase).
 * Se houver **dois ou mais** JIDs em `TARGET_GROUP_JIDS`, usa o **segundo** —
 * o primeiro pode ficar na env para outro uso (reservado).
 * Com apenas um JID, usa esse (comportamento antigo).
 */
function getQuizTargetGroupJid(): string {
  if (config.targetGroupJids.length === 0) {
    throw new Error("Configure TARGET_GROUP_JIDS no .env para publicar as questoes.");
  }
  if (config.targetGroupJids.length >= 2) {
    return config.targetGroupJids[1];
  }
  return config.targetGroupJids[0];
}

function buildOmissasWebLink(token: string): string {
  return `${config.publicSiteUrl}/omissas?t=${encodeURIComponent(token)}`;
}

async function buildStudyAppOmissasLink(
  webLink: string | null,
  userJid: string
): Promise<string | null> {
  if (!webLink || !config.studyAppUrl) return null;
  try {
    const { getFlashcardsLinkByUserJid } = await import("./flashcards/links");
    const link = await getFlashcardsLinkByUserJid(userJid);
    if (!link || link.status !== "active") return null;
    const t = new URL(webLink).searchParams.get("t");
    if (!t) return null;
    return `${config.studyAppUrl.replace(/\/+$/, "")}/questoes/omissas?t=${encodeURIComponent(t)}`;
  } catch {
    return null;
  }
}

async function tryCreateOmissasWebLink(input: {
  userJid: string;
  userName?: string | null;
  groupJid: string;
  mode: "hoje" | "atrasadas" | "adiantar";
  shortIds: string[];
}): Promise<string | null> {
  if (!input.shortIds.length) return null;
  try {
    const session = await createOmissasWebSession({
      userJid: input.userJid,
      userName: input.userName,
      groupJid: input.groupJid,
      mode: input.mode,
      shortIds: input.shortIds
    });
    return buildOmissasWebLink(session.token);
  } catch (e) {
    console.warn("[omissas-web] create session:", (e as Error).message);
    return null;
  }
}

function extractFileExtension(mimeType: string): string {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("webp")) return "webp";
  return "bin";
}

async function extractMediaPayload(sock: WASocket, msg: WAMessage): Promise<MediaPayload | null> {
  if (!hasSupportedMedia(msg)) return null;
  const mimeType = msg.message?.imageMessage?.mimetype ?? msg.message?.documentMessage?.mimetype;
  if (!mimeType) return null;
  const stream = await downloadMediaMessage(
    msg,
    "buffer",
    {},
    { logger: P({ level: "silent" }), reuploadRequest: sock.updateMediaMessage }
  );
  const data = Buffer.isBuffer(stream) ? stream : Buffer.from(stream as ArrayBuffer);
  return {
    data,
    mimeType,
    fileExt: extractFileExtension(mimeType)
  };
}

async function publishQuestionToGroup(
  sock: WASocket,
  groupJid: string,
  shortId: string,
  draft: QuestionDraft,
  opts?: { deferredToTomorrow?: boolean }
): Promise<void> {
  const intro = `Nova questao #${shortId} enviada por ${draft.creatorName}`;
  const deferNote = opts?.deferredToTomorrow
    ? "\n⏳ Conta como omissa *amanhã* (corte 15h)."
    : "";
  const options =
    draft.questionType === "true_false"
      ? `Responda no privado do bot:\nc ${shortId}\ne ${shortId}`
      : `Responda no privado do bot:\na ${shortId}\nb ${shortId}\nc ${shortId}\nd ${shortId}\ne ${shortId}`;

  const statementText = draft.statementText ? `\n\n${draft.statementText}` : "";

  if (draft.statementMedia) {
    if (draft.statementMedia.mimeType.startsWith("image/")) {
      await sock.sendMessage(groupJid, {
        image: draft.statementMedia.data,
        caption: `${intro}${deferNote}${statementText}\n\n${options}`
      });
      return;
    }

    await sock.sendMessage(groupJid, {
      document: draft.statementMedia.data,
      mimetype: draft.statementMedia.mimeType,
      fileName: `questao-${shortId}.${draft.statementMedia.fileExt}`,
      caption: `${intro}${deferNote}${statementText}\n\n${options}`
    });
    return;
  }

  await sock.sendMessage(groupJid, {
    text: `${intro}${deferNote}${statementText}\n\n${options}`
  });
}

function firstNameForAnnotation(name: string): string {
  const first = String(name || "")
    .trim()
    .split(/\s+/)[0];
  return (first || "alguém").toLowerCase();
}

function formatConfidenceTag(confidence?: string | null): string {
  const v = String(confidence || "").toLowerCase();
  if (v === "chute" || v === "inseguro") return ` [${v}]`;
  return "";
}

function formatRespondentLines(
  respondents: {
    name: string;
    letter: string;
    comment: string | null;
    aiComment?: string | null;
    confidence?: string | null;
  }[]
): string {
  if (!respondents.length) return "Ninguem";
  return respondents
    .map((r) => {
      const base = `- ${r.name} (${r.letter})${formatConfidenceTag(r.confidence)}`;
      return r.comment ? `${base}: ${r.comment}` : base;
    })
    .join("\n");
}

function formatAnnotationReplyBlocks(
  result: Awaited<ReturnType<typeof getQuestionResult>>
): string[] {
  const all = [...result.correctRespondents, ...result.wrongRespondents];
  const parts: string[] = [];
  for (const r of all) {
    const ai = r.aiComment?.trim();
    if (!ai) continue;
    if (parts.length) parts.push("");
    parts.push(`---Resposta anotação ${firstNameForAnnotation(r.name)}---`);
    parts.push(ai);
  }
  return parts;
}

async function maybeWakeCadernoAfterAnswer(sock: WASocket, rawShortId: string): Promise<void> {
  try {
    const cadernoId = await getCadernoIdForQuestion(rawShortId);
    if (cadernoId == null) return;
    await tryAdvanceCadernoAfterAnswer(sock, cadernoId, getBotJidComparable(sock));
  } catch (e) {
    console.warn("[caderno-wake]", (e as Error).message);
  }
}

function buildResultMessage(
  result: Awaited<ReturnType<typeof getQuestionResult>>,
  opts?: { statementSentSeparately?: boolean; discussionTree?: string }
): string {
  const keys = buildDistributionKeys(result.questionType);
  const distributionLines = keys.map((key) => `${key} - ${result.distribution[key] ?? 0}`);
  const correct = formatRespondentLines(result.correctRespondents);
  const wrong = formatRespondentLines(result.wrongRespondents);
  const annotationReplies = formatAnnotationReplyBlocks(result);

  const hasExplanation = Boolean(result.explanationText && result.explanationText.trim().length > 0);
  const hasExplanationMedia = Boolean(result.explanationMediaUrl && result.explanationMediaMimeType);
  let explanationBlock = "Sem comentario.";
  if (hasExplanation) {
    explanationBlock = result.explanationText ?? "Sem comentario.";
  } else if (hasExplanationMedia) {
    explanationBlock = "(veja a midia abaixo)";
  }

  const statementBlock: string[] = [];
  const sendsStatementMedia =
    Boolean(result.statementMediaUrl && result.statementMediaMimeType);
  if (opts?.statementSentSeparately) {
    statementBlock.push(
      sendsStatementMedia ? "Enunciado: (midia e texto acima)" : "Enunciado: (mensagem(ns) acima)",
      ""
    );
  } else if (result.statementText) {
    statementBlock.push("Enunciado:", result.statementText.trim(), "");
  } else if (sendsStatementMedia) {
    statementBlock.push("Enunciado: (veja acima)", "");
  }

  return [
    `Resultado da Questao #${result.shortId}`,
    "",
    ...statementBlock,
    `Gabarito: ${result.answerKey}`,
    "",
    "Distribuicao:",
    ...distributionLines,
    "",
    "Acertaram:",
    correct,
    "",
    "Erraram:",
    wrong,
    ...(annotationReplies.length ? ["", ...annotationReplies] : []),
    "",
    "Comentario do autor:",
    explanationBlock,
    ...(opts?.discussionTree
      ? ["", `[Discussão] #${result.shortId}`, "Comentários já registrados (site/adiantar/WhatsApp):", opts.discussionTree]
      : [])
  ].join("\n");
}

async function sendFullStatementBeforeResult(
  sock: WASocket,
  jid: string,
  shortId: string,
  statementText: string
): Promise<string[]> {
  const chunks = splitWhatsAppText(statementText);
  const total = chunks.length;
  const ids: string[] = [];
  for (let i = 0; i < total; i++) {
    const label =
      total === 1
        ? `Enunciado — Questao #${shortId}`
        : `Enunciado — Questao #${shortId} (${i + 1}/${total})`;
    const sent = await sock.sendMessage(jid, { text: `${label}\n\n${chunks[i]}` });
    const id = sent?.key?.id;
    if (id) ids.push(String(id));
  }
  return ids;
}

async function sendStatementMedia(
  sock: WASocket,
  jid: string,
  result: Awaited<ReturnType<typeof getQuestionResult>>
): Promise<string | null> {
  if (!result.statementMediaUrl || !result.statementMediaMimeType) return null;

  const caption = `Enunciado — Questao #${result.shortId}`;

  let sent;
  if (result.statementMediaMimeType.startsWith("image/")) {
    sent = await sock.sendMessage(jid, {
      image: { url: result.statementMediaUrl },
      caption
    });
  } else {
    sent = await sock.sendMessage(jid, {
      document: { url: result.statementMediaUrl },
      mimetype: result.statementMediaMimeType,
      fileName: `enunciado-${result.shortId}.${mimeToStatementFileExt(result.statementMediaMimeType)}`,
      caption
    });
  }
  return sent?.key?.id ? String(sent.key.id) : null;
}

async function sendExplanationMedia(
  sock: WASocket,
  jid: string,
  result: Awaited<ReturnType<typeof getQuestionResult>>
): Promise<string | null> {
  if (!result.explanationMediaUrl || !result.explanationMediaMimeType) return null;

  let sent;
  if (result.explanationMediaMimeType.startsWith("image/")) {
    sent = await sock.sendMessage(jid, { image: { url: result.explanationMediaUrl } });
  } else {
    sent = await sock.sendMessage(jid, {
      document: { url: result.explanationMediaUrl },
      mimetype: result.explanationMediaMimeType,
      fileName: "comentario-questao"
    });
  }
  return sent?.key?.id ? String(sent.key.id) : null;
}

type PublishQuestionResultOpts = {
  headerPrefix?: string;
  /** Cria/atualiza card no feed quando o destino é o grupo. */
  discussionSource?: "auto_gabarito" | "gabarito";
};

async function publishQuestionResult(
  sock: WASocket,
  jid: string,
  result: Awaited<ReturnType<typeof getQuestionResult>>,
  opts?: PublishQuestionResultOpts | string
): Promise<void> {
  const options: PublishQuestionResultOpts =
    typeof opts === "string" ? { headerPrefix: opts } : opts || {};
  const hasStatementMedia = Boolean(result.statementMediaUrl && result.statementMediaMimeType);
  const statementText = result.statementText?.trim() ?? "";
  let statementSentSeparately = false;
  const statementIds: string[] = [];
  const isGroup = jid.endsWith("@g.us");

  let discussionTree = "";
  let discussionCommentIds: number[] = [];
  if (isGroup && result.questionId && options.discussionSource) {
    try {
      const post = await upsertDiscussionPost({
        questionId: result.questionId,
        shortId: result.shortId,
        groupJid: jid,
        source: options.discussionSource
      });
      if (post) {
        const comments = await listDiscussionCommentsForPost(post.id);
        discussionTree = formatDiscussionCommentsTree(comments);
        discussionCommentIds = comments.map((c) => c.id);
      }
    } catch (e) {
      console.warn("[discussions] load digest:", (e as Error).message);
    }
  }

  if (hasStatementMedia) {
    const mediaId = await sendStatementMedia(sock, jid, result);
    if (mediaId) statementIds.push(mediaId);
    statementSentSeparately = true;
  }
  if (statementText) {
    const textIds = await sendFullStatementBeforeResult(sock, jid, result.shortId, statementText);
    statementIds.push(...textIds);
    statementSentSeparately = true;
  }

  const header = options.headerPrefix ? `${options.headerPrefix}\n` : "";
  const resultSent = await sock.sendMessage(jid, {
    text: `${header}${buildResultMessage(result, {
      statementSentSeparately,
      discussionTree
    })}`
  });
  const resultId = resultSent?.key?.id ? String(resultSent.key.id) : null;
  const explanationId = await sendExplanationMedia(sock, jid, result);

  if (isGroup && result.questionId) {
    for (const waId of statementIds) {
      await insertQuestionWaMessage({
        questionId: result.questionId,
        shortId: result.shortId,
        groupJid: jid,
        waMessageId: waId,
        role: "statement"
      });
    }
    if (resultId) {
      await insertQuestionWaMessage({
        questionId: result.questionId,
        shortId: result.shortId,
        groupJid: jid,
        waMessageId: resultId,
        role: "result"
      });
    }
    if (explanationId) {
      await insertQuestionWaMessage({
        questionId: result.questionId,
        shortId: result.shortId,
        groupJid: jid,
        waMessageId: explanationId,
        role: "explanation_media"
      });
    }
    if (discussionTree) {
      const discText = [
        `[Discussão] #${result.shortId}`,
        "Comentários já registrados (site/adiantar/WhatsApp):",
        discussionTree
      ].join("\n");
      let discSent: Awaited<ReturnType<WASocket["sendMessage"]>> | undefined;
      if (resultId) {
        try {
          discSent = await sock.sendMessage(
            jid,
            { text: discText },
            {
              quoted: {
                key: { remoteJid: jid, id: resultId, fromMe: true },
                message: { conversation: `Resultado da Questao #${result.shortId}` }
              }
            }
          );
        } catch (e) {
          console.warn("[discussions] quoted digest failed:", (e as Error).message);
        }
      }
      if (!discSent?.key?.id) {
        try {
          discSent = await sock.sendMessage(jid, { text: discText });
        } catch (e) {
          console.warn("[discussions] plain digest failed:", (e as Error).message);
        }
      }
      const discId = discSent?.key?.id ? String(discSent.key.id) : null;
      if (discId) {
        await insertQuestionWaMessage({
          questionId: result.questionId,
          shortId: result.shortId,
          groupJid: jid,
          waMessageId: discId,
          role: "statement"
        });
      }
      if (discussionCommentIds.length) {
        await markDiscussionCommentsSharedToWa(discussionCommentIds);
      }
    }
  }
}

function mimeToStatementFileExt(mimeType: string): string {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "bin";
}

/** Captura reply no grupo à mensagem do bot (ou a um comentário já na thread). */
async function maybeIngestDiscussionReply(
  msg: WAMessage,
  remoteJid: string,
  sender: string
): Promise<boolean> {
  if (!remoteJid.endsWith("@g.us") || msg.key.fromMe) return false;
  const ctx = extractContextInfo(msg);
  if (!ctx?.stanzaId) return false;
  const body = extractDiscussionBody(msg);
  if (!body) return false;

  try {
    let postId: number | null = null;
    let parentId: number | null = null;

    const anchor = await findQuestionByWaMessageId(remoteJid, ctx.stanzaId);
    if (anchor) {
      let post = await getDiscussionPostByQuestionId(anchor.questionId);
      if (!post) {
        post = await upsertDiscussionPost({
          questionId: anchor.questionId,
          shortId: anchor.shortId,
          groupJid: remoteJid,
          source: "gabarito"
        });
      }
      if (!post) return false;
      postId = post.id;
      parentId = null;
    } else {
      const parentComment = await findDiscussionCommentByWaMessageId(ctx.stanzaId);
      if (!parentComment) return false;
      postId = parentComment.postId;
      parentId = parentComment.id;
    }

    const waId = msg.key.id ? String(msg.key.id) : null;
    await insertDiscussionComment({
      postId,
      parentId,
      authorJid: sender,
      authorName: getDisplayName(msg, sender),
      body,
      source: "whatsapp",
      waMessageId: waId
    });
    return true;
  } catch (e) {
    console.warn("[discussions] ingest reply:", (e as Error).message);
    return false;
  }
}

async function repeatQuestionStatement(sock: WASocket, jid: string, shortId: string): Promise<void> {
  const row = await getQuestionForRepeat(shortId);
  if (!row) {
    await sock.sendMessage(jid, { text: `Questao #${shortId.toUpperCase()} nao encontrada.` });
    return;
  }

  const headerParts = [`Questao #${row.shortId} (repeticao)`];
  if (row.cadernoName) {
    headerParts.push(`Caderno: ${row.cadernoName}`);
  } else {
    headerParts.push(`Por: ${row.creatorName}`);
  }
  if (row.engagedNames.length > 0) {
    headerParts.push(
      row.engagedNames.length === 1
        ? `Engajado: ${row.engagedNames[0]}`
        : `Engajados: ${row.engagedNames.join(", ")}`
    );
  }
  const header = headerParts.join("\n");
  const body = row.statementText?.trim() ?? "";

  if (row.statementMediaUrl && row.statementMediaMimeType) {
    const caption = [header, body].filter(Boolean).join("\n\n");
    if (row.statementMediaMimeType.startsWith("image/")) {
      await sock.sendMessage(jid, {
        image: { url: row.statementMediaUrl },
        caption
      });
      return;
    }

    await sock.sendMessage(jid, {
      document: { url: row.statementMediaUrl },
      mimetype: row.statementMediaMimeType,
      fileName: `questao-${row.shortId}.${mimeToStatementFileExt(row.statementMediaMimeType)}`,
      caption
    });
    return;
  }

  if (body) {
    await sock.sendMessage(jid, { text: `${header}\n\n${body}` });
    return;
  }

  await sock.sendMessage(jid, {
    text: `${header}\n(Sem enunciado armazenado para esta questao.)`
  });
}

async function buildCadernoProgressMessage(cadernoId: number): Promise<string> {
  const progress = await getCadernoProgress(cadernoId);
  if (!progress) {
    return `Caderno #${cadernoId} nao encontrado.`;
  }
  const { caderno, totalQuestions, publishedCount, resolvedByEngaged, withAnyAnswer, engagedCount } =
    progress;

  const pct = publishedCount === 0 ? 0 : Math.round((resolvedByEngaged / publishedCount) * 100);
  const pctLine =
    engagedCount > 0
      ? `Resolvidas pelos engajados: ${resolvedByEngaged}/${publishedCount} (${pct}%)`
      : `Resolvidas pelos engajados: — (nenhum engajado neste caderno; marque na edição do caderno no site)`;

  const scheduleLine =
    caderno.sendTimes && caderno.sendTimes.length >= caderno.questionsPerDay
      ? `Horários: ${caderno.sendTimes
          .slice(0, caderno.questionsPerDay)
          .map((t) => `${pad2(t.hour)}:${pad2(t.minute)}`)
          .join(", ")} (${caderno.questionsPerDay}/dia)`
      : `Horários: ${pad2(caderno.startHour)}:${pad2(caderno.startMinute)}–${pad2(caderno.endHour)}:${pad2(caderno.endMinute)} (${caderno.questionsPerDay}/dia, uniforme)`;

  const lines = [
    `Progresso do Caderno #${caderno.id} — "${caderno.name}"`,
    "",
    `Status: ${caderno.status}`,
    `Modo: ${caderno.randomOrder ? "ordem aleatória (entre todas as pendentes)" : "ordem do PDF"}`,
    scheduleLine,
    "",
    `Total no caderno: ${totalQuestions}`,
    `Enviadas: ${publishedCount}/${totalQuestions}`,
    pctLine,
    `Com pelo menos 1 resposta: ${withAnyAnswer}/${publishedCount}`,
    `Engajados no caderno: ${engagedCount}`,
    "",
    `Próximo envio: ${formatNextRunPretty(caderno.nextRunAt, caderno.timezone)}`,
    `Último envio: ${formatNextRunPretty(caderno.lastRunAt, caderno.timezone)}`
  ];
  return lines.join("\n");
}

type CadernoCommandArg = ReturnType<typeof parseCadernoCommand>;

async function handleCadernoCommand(
  sock: WASocket,
  remoteJid: string,
  senderJid: string,
  cmd: NonNullable<CadernoCommandArg>
): Promise<void> {
  if (cmd.kind === "list") {
    const cadernos = await listCadernosForOwner(senderJid);
    if (cadernos.length === 0) {
      await sock.sendMessage(remoteJid, {
        text:
          "Voce nao tem cadernos cadastrados.\n" +
          "Abra o site Papa Vagas e use o botao 'Cadernos' para enviar um PDF do Tec Concursos."
      });
      return;
    }
    const lines = ["Seus cadernos:", ""];
    for (const c of cadernos) {
      const next = c.status === "active" ? formatNextRunPretty(c.nextRunAt, c.timezone) : "—";
      lines.push(
        `#${c.id} ${c.name}`,
        `  status: ${c.status}`,
        `  envio: ${c.questionsPerRun} questao(oes) a cada ${c.intervalDays} dia(s), ${pad2(c.sendHour)}:${pad2(c.sendMinute)} (${c.timezone})`,
        `  proximo: ${next}`,
        `  progresso: cursor ${c.cursor}`,
        ""
      );
    }
    lines.push(
      "Comandos:",
      "  /caderno pause <id>    /caderno resume <id>",
      "  /caderno next <id>     /caderno delete <id>",
      "  reciclar caderno <id>  desativar caderno <id>"
    );
    await sock.sendMessage(remoteJid, { text: lines.join("\n") });
    return;
  }

  const caderno = await getCadernoById(cmd.id);
  if (!caderno) {
    await sock.sendMessage(remoteJid, { text: `Caderno #${cmd.id} nao encontrado.` });
    return;
  }
  if (caderno.createdByJid && caderno.createdByJid !== senderJid) {
    await sock.sendMessage(remoteJid, {
      text: `Voce nao e o dono do caderno #${cmd.id}.`
    });
    return;
  }

  switch (cmd.kind) {
    case "pause": {
      await setCadernoStatus(caderno.id, "inactive", { nextRunAt: null });
      await sock.sendMessage(remoteJid, {
        text: `Caderno #${caderno.id} ("${caderno.name}") pausado. Use /caderno resume ${caderno.id} para retomar.`
      });
      return;
    }
    case "resume": {
      const nextIso = computeNextRunAt(
        new Date(),
        caderno.sendHour,
        caderno.sendMinute,
        caderno.timezone,
        0
      ).toISOString();
      await setCadernoStatus(caderno.id, "active", { nextRunAt: nextIso });
      await sock.sendMessage(remoteJid, {
        text: `Caderno #${caderno.id} retomado. Proximo envio: ${formatNextRunPretty(nextIso, caderno.timezone)}.`
      });
      return;
    }
    case "next": {
      await sock.sendMessage(remoteJid, {
        text: [
          `Forçando envio agora do caderno #${caderno.id}…`,
          `(Se já passou das 15h e for início de dia novo, agenda para amanhã.)`
        ].join("\n")
      });
      const fresh = await getCadernoById(caderno.id);
      if (fresh) await forceRunCaderno(sock, fresh);
      return;
    }
    case "recycle": {
      await resetCadernoPublishedQuestions(caderno.id);
      const nextIso = computeNextRunAt(
        new Date(),
        caderno.sendHour,
        caderno.sendMinute,
        caderno.timezone,
        0
      ).toISOString();
      await setCadernoStatus(caderno.id, "active", { nextRunAt: nextIso, cursor: 0 });
      await sock.sendMessage(remoteJid, {
        text: `Caderno #${caderno.id} reiniciado do começo. Próximo envio: ${formatNextRunPretty(nextIso, caderno.timezone)}.`
      });
      return;
    }
    case "deactivate": {
      await setCadernoStatus(caderno.id, "finished", { nextRunAt: null });
      await sock.sendMessage(remoteJid, {
        text: `Caderno #${caderno.id} encerrado.`
      });
      return;
    }
    case "delete": {
      await sock.sendMessage(remoteJid, {
        text:
          `Para excluir o caderno #${caderno.id}, use o site Papa Vagas (botao "Excluir").\n` +
          "O bot nao apaga cadernos pelo chat por seguranca."
      });
      return;
    }
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

async function startBot(): Promise<void> {
  if (isStarting) return;
  isStarting = true;
  activeSocketInstance += 1;
  const instanceId = activeSocketInstance;

  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (instanceId !== activeSocketInstance) {
      return;
    }

    if (qr) {
      console.log("QR recebido. Escaneie no WhatsApp.");
      qrcode.generate(qr, { small: true });
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(qr)}`;
      console.log("Se nao visualizar o QR no terminal, abra este link:");
      console.log(qrUrl);
    }

    if (connection === "close") {
      stopCadernoScheduler();
      stopFlashcardsBot();
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
        ?.statusCode;
      const reason = (lastDisconnect?.error as Error | undefined)?.message ?? "sem motivo";
      const nonReconnectStatuses = new Set<number>([
        DisconnectReason.loggedOut,
        DisconnectReason.connectionReplaced,
        DisconnectReason.badSession,
        440 /** Stream erro (conflict): outra instancia usando a mesma sessao WhatsApp */
      ]);
      const shouldReconnect = statusCode ? !nonReconnectStatuses.has(statusCode) : true;
      console.log(
        `Conexao fechada (instancia ${instanceId}). status=${statusCode ?? "n/a"} motivo=${reason}. Reconectar: ${shouldReconnect}`
      );
      isStarting = false;

      if (statusCode === DisconnectReason.connectionReplaced || statusCode === 440) {
        console.log(
          "Conflito de sessao detectado (440). Feche outras sessoes do bot, apague a pasta auth e pareie novamente."
        );
      }

      if (shouldReconnect && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void startBot();
        }, 1500);
      }
    }

    if (connection === "open") {
      console.log(`Bot conectado no WhatsApp. (instancia ${instanceId})`);
      isStarting = false;
      registerWebAnswerSideEffect(async (s, shortId) => {
        await maybePostAutoGabaritoToGroup(s, shortId);
      });
      startCadernoScheduler(sock);
      startFlashcardsBot(sock);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.key.remoteJid || !msg.message) continue;

        const text = extractText(msg);
        const repeatQuestionCmd = parseRepeatQuestionCommand(text);
        if (
          msg.key.fromMe &&
          !isSlashSessionCommand(text) &&
          !repeatQuestionCmd &&
          !parseGabaritoCommand(text)
        ) {
          continue;
        }

        const remoteJid = msg.key.remoteJid;
        const fromGroup = remoteJid.endsWith("@g.us");
        const fromPrivate = isPrivateChatJid(remoteJid);
        const messageId = msg.key.id ?? "sem_id";
        const resolvedActor = resolveActorJid(remoteJid, msg.key);
        /** Evita \"\" com participant vazio ou edge cases LID (`??` não substitui string vazia). */
        const sender = resolvedActor.trim().length > 0 ? resolvedActor : remoteJid;
        if (fromGroup && sender.endsWith("@g.us")) {
          console.warn(
            "[msg] Grupo sem participant resolvido para este evento; comandos podem ser ignorados. id=",
            messageId
          );
        }
        const sentAt = toIsoTimestamp(msg.messageTimestamp);
        const messageKind = fromGroup ? "grupo" : fromPrivate ? "privado" : "outro";

        console.log(
          `[msg] tipo=${messageKind} remote=${remoteJid} sender=${sender} id=${messageId} texto="${text || "(sem texto)"}"`
        );

        if (fromGroup) {
          await maybeIngestDiscussionReply(msg, remoteJid, sender);
        }

        if (repeatQuestionCmd && (fromGroup || fromPrivate)) {
          await repeatQuestionStatement(sock, remoteJid, repeatQuestionCmd.shortId);
          continue;
        }

        if (fromGroup && parseSyncMembrosCommand(text)) {
          try {
            const metaGm = await sock.groupMetadata(remoteJid);
            const parts = metaGm.participants as { id?: string; name?: string; notify?: string }[];
            const members = parts
              .map((p) => {
                const id = String(p.id || "");
                if (!id || id.endsWith("@g.us")) return null;
                const label =
                  (p.name && String(p.name).trim()) ||
                  (p.notify && String(p.notify).trim()) ||
                  id.split("@")[0] ||
                  id;
                return { userJid: id, userLabel: label };
              })
              .filter(Boolean) as { userJid: string; userLabel: string }[];
            await upsertGroupMembersFromSync(remoteJid, members);
            await sock.sendMessage(remoteJid, {
              text: [
                `Sincronizados ${members.length} membros.`,
                "No site Papa Vagas, abra Engajamento e marque quem participa do fechamento automático do gabarito.",
                "O bot posta o resultado quando todos os engajados (exceto quem criou a questão) responderem."
              ].join("\n")
            });
          } catch (syncErr) {
            await sock.sendMessage(remoteJid, {
              text: `Erro ao sincronizar: ${(syncErr as Error).message}`
            });
          }
          continue;
        }

        let quizModePrivateEnabled = false;
        if (fromPrivate) {
          if (!msg.key.fromMe) {
            const gastosHandled = await tryHandleGastos(sock, msg, remoteJid);
            if (gastosHandled) continue;
          }

          const flashcardsHandled = await handleFlashcardsPrivateMessage(
            sock,
            remoteJid,
            sender,
            text
          );
          if (flashcardsHandled) continue;

          const omissasWaitingEarly = omissasOfferByUser.get(sender);
          if (omissasWaitingEarly) {
            const normalizedOm = normalizeInput(text);
            if (normalizedOm === "sim" || normalizedOm === "s") {
              omissasOfferByUser.delete(sender);
              for (const sid of omissasWaitingEarly) {
                await repeatQuestionStatement(sock, remoteJid, sid);
                await delayMs(650);
              }
              await sock.sendMessage(remoteJid, {
                text: "Responda com letra + número (ex: c 12). Use /gabarito 12 para ver o resultado completo."
              });
              continue;
            }
            if (normalizedOm === "nao" || normalizedOm === "não" || normalizedOm === "n") {
              omissasOfferByUser.delete(sender);
              await sock.sendMessage(remoteJid, { text: "Ok." });
              continue;
            }
            await sock.sendMessage(remoteJid, {
              text: 'Responda "sim" para receber os enunciados aqui ou "nao" para cancelar.'
            });
            continue;
          }

          // Confirmação de compra do Portal (prioridade sobre outros sim/nao)
          try {
            if (await tryHandlePurchaseConfirm(sock, sender, text)) {
              continue;
            }
          } catch (ecoErr) {
            console.warn("[economy] purchase confirm:", (ecoErr as Error).message);
          }

          const ecoCmdEarly = parseEconomyCommand(text);
          if (ecoCmdEarly) {
            try {
              await handleEconomyCommand(sock, remoteJid, sender, getDisplayName(msg, sender), ecoCmdEarly);
            } catch (ecoErr) {
              await sock.sendMessage(remoteJid, { text: `Erro: ${(ecoErr as Error).message}` });
            }
            continue;
          }

          quizModePrivateEnabled = await getQuizModePrivate(sender);
          const slashPriv = parseSlashSessionCommand(text);

          if (!quizModePrivateEnabled) {
            if (slashPriv === "quiz") {
              await setQuizModePrivate(sender, true);
              quizModePrivateEnabled = true;
              await sock.sendMessage(remoteJid, { text: buildQuizFullGuide() });
              continue;
            }
            if (slashPriv === "help") {
              await sock.sendMessage(remoteJid, {
                text: [
                  "Para usar comandos aqui no privado (criar/responder questoes), ative:",
                  "",
                  "/quiz",
                  "",
                  "Sem modo quiz, só lemos aqui comandos neutros: gabarito, /q&a, quem respondeu, /omissas, /atrasadas e adiantar N."
                ].join("\n")
              });
              continue;
            }
            if (slashPriv === "quizoff") {
              await sock.sendMessage(remoteJid, {
                text: 'O modo quiz no privado ja esta desligado. Para ativar: envie /quiz.'
              });
              continue;
            }

            const passiveProbe = parsePrivateCommand(text);
            const respondentIdProbe = parseRespondentsCommand(text);
            const ecoProbe = parseEconomyCommand(text);
            const passiveReadOnly =
              passiveProbe.kind === "ranking" ||
              passiveProbe.kind === "qa_stats" ||
              passiveProbe.kind === "answer_key" ||
              Boolean(respondentIdProbe) ||
              parseOmissasCommand(text) ||
              parseSemanaCommand(text) ||
              Boolean(parseAdiantarCommand(text)) ||
              parseQaCommand(text) ||
              Boolean(ecoProbe);

            if (!passiveReadOnly) {
              continue;
            }
          } else {
            if (slashPriv === "quizoff") {
              await setQuizModePrivate(sender, false);
              creationSessions.delete(sender);
              pendingAnswerChanges.delete(sender);
              await sock.sendMessage(remoteJid, {
                text: [
                  "Modo quiz desligado.",
                  "Suas mensagens normais nao serao mais interpretadas como comandos.",
                  "Para ativar de novo no privado: /quiz"
                ].join("\n")
              });
              continue;
            }
            if (slashPriv === "help") {
              await sock.sendMessage(remoteJid, { text: buildQuizFullGuide() });
              continue;
            }
            if (slashPriv === "quiz") {
              await sock.sendMessage(remoteJid, {
                text: [
                  "Modo quiz ja esta ligado.",
                  "Guia completo: /ajuda",
                  "Para sair: /quizoff"
                ].join("\n")
              });
              continue;
            }
          }
        }

        if (fromGroup || fromPrivate) {
          if (parseSlashSessionCommand(text) === "help") {
            await sock.sendMessage(remoteJid, { text: buildQuizFullGuide() });
            continue;
          }

          const respondentQuestionId = parseRespondentsCommand(text);
          if (respondentQuestionId) {
            try {
              await sock.sendMessage(remoteJid, {
                text: await buildRespondentsReport(sock, respondentQuestionId)
              });
            } catch (respondErr) {
              await sock.sendMessage(remoteJid, {
                text: `Nao foi possivel listar respondentes: ${(respondErr as Error).message}`
              });
            }
            continue;
          }

          const progressoCmd = parseProgressoCommand(text);
          if (progressoCmd) {
            try {
              await sock.sendMessage(remoteJid, {
                text: await buildCadernoProgressMessage(progressoCmd.cadernoId)
              });
            } catch (progErr) {
              await sock.sendMessage(remoteJid, {
                text: `Erro ao consultar progresso: ${(progErr as Error).message}`
              });
            }
            continue;
          }

          if (fromPrivate) {
            const cadernoCmd = parseCadernoCommand(text);
            if (cadernoCmd) {
              try {
                await handleCadernoCommand(sock, remoteJid, sender, cadernoCmd);
              } catch (cadErr) {
                await sock.sendMessage(remoteJid, {
                  text: `Erro no comando de caderno: ${(cadErr as Error).message}`
                });
              }
              continue;
            }
          }

          if (fromPrivate && parseSemanaCommand(text)) {
            try {
              const gj = getQuizTargetGroupJid();
              const reports = await buildSemanaReportForUser(sender, gj);
              await sock.sendMessage(remoteJid, {
                text: formatSemanaReportText(reports)
              });
            } catch (semErr) {
              await sock.sendMessage(remoteJid, {
                text: `Erro ao montar /semana: ${(semErr as Error).message}`
              });
            }
            continue;
          }

          if (fromPrivate && (parseOmissasCommand(text) || parseAtrasadasCommand(text))) {
            try {
              const gj = getQuizTargetGroupJid();
              const mode = parseAtrasadasCommand(text) ? "atrasadas" : "hoje";
              const { loadOmissasContext, buildOmissasPrivateMessage } = await import(
                "./economy/omissas"
              );
              const { buckets, locking } = await loadOmissasContext(sender, gj, {
                todayLimit: 30,
                atrasadasLimit: 30
              });
              const offerIds = mode === "hoje" ? buckets.today : buckets.atrasadas;
              if (offerIds.length === 0 && locking.length === 0) {
                const emptyMsg =
                  mode === "hoje"
                    ? buckets.atrasadas.length > 0
                      ? `Sem omissas de hoje. Há ${buckets.atrasadas.length} atrasada(s) — use /atrasadas.`
                      : "Voce nao tem omissas de hoje (engajado/passivo) ou ja respondeu a todas."
                    : buckets.today.length > 0
                      ? `Sem atrasadas. Hoje ainda faltam ${buckets.today.length} — use /omissas.`
                      : "Nenhuma omissa atrasada.";
                await sock.sendMessage(remoteJid, { text: emptyMsg });
                continue;
              }
              if (offerIds.length > 0) {
                omissasOfferByUser.set(sender, offerIds);
              }
              const webLink =
                offerIds.length > 0
                  ? await tryCreateOmissasWebLink({
                      userJid: sender,
                      userName: getDisplayName(msg, sender),
                      groupJid: gj,
                      mode,
                      shortIds: offerIds
                    })
                  : null;
              await sock.sendMessage(remoteJid, {
                text: buildOmissasPrivateMessage({
                  buckets,
                  locking,
                  mode,
                  webLink,
                  studyAppLink: await buildStudyAppOmissasLink(webLink, sender)
                })
              });
            } catch (omErr) {
              await sock.sendMessage(remoteJid, {
                text: `Erro ao listar omissas: ${(omErr as Error).message}`
              });
            }
            continue;
          }

          const adiantarCmd = fromPrivate ? parseAdiantarCommand(text) : null;
          if (adiantarCmd) {
            try {
              const gj = getQuizTargetGroupJid();
              const cadernos = await listEngagedGroupCadernosForUser(sender, gj);
              if (cadernos.length === 0) {
                await sock.sendMessage(remoteJid, {
                  text: "Voce nao esta engajado em nenhum caderno ativo deste grupo. Marque-se na edicao do caderno no site."
                });
                continue;
              }
              const tz = cadernos[0]?.timezone || "America/Sao_Paulo";
              const todayIso = dateIsoInTimezone(new Date(), tz);
              let dayIsos: string[] | null = null;
              if (adiantarCmd.kind === "weekdays") {
                const { dayIsos: resolved, unknown } = resolveWeekdayNamesToIsos(
                  adiantarCmd.names,
                  todayIso
                );
                if (unknown.length) {
                  await sock.sendMessage(remoteJid, {
                    text: `Dia(s) nao reconhecido(s): ${unknown.join(", ")}. Use seg ter qua qui sex sab dom (ou nomes completos).`
                  });
                  continue;
                }
                dayIsos = resolved.filter((d) => d > todayIso);
                if (dayIsos.length === 0) {
                  await sock.sendMessage(remoteJid, {
                    text: "Nenhum dia futuro na semana atual para adiantar (dias passados/hoje nao entram). Use /omissas para hoje."
                  });
                  continue;
                }
              }

              const allShortIds: string[] = [];
              const summaries: string[] = [];
              const prepaidDays: string[] = [];
              for (const c of cadernos) {
                const result =
                  dayIsos != null
                    ? await adiantarCadernoDays(c, dayIsos, sender)
                    : await adiantarCadernoQuestions(
                        c,
                        adiantarCmd.kind === "count" ? adiantarCmd.days : 1,
                        sender
                      );
                summaries.push(result.message);
                allShortIds.push(...result.shortIds);
                prepaidDays.push(...(result.newlyPlannedDays || result.plannedDays || []));
              }
              if (prepaidDays.length) {
                try {
                  const { addPrepaidStreakDays } = await import("./economy/streak");
                  await addPrepaidStreakDays(sender, [...new Set(prepaidDays)]);
                } catch (e) {
                  console.warn("[economy] prepaid streak:", (e as Error).message);
                }
              }
              if (allShortIds.length === 0) {
                await sock.sendMessage(remoteJid, {
                  text: ["Nada a adiantar (ja feito ou sem questoes).", "", ...summaries].join(
                    "\n"
                  )
                });
                continue;
              }
              omissasOfferByUser.set(sender, allShortIds);
              const webLink = await tryCreateOmissasWebLink({
                userJid: sender,
                userName: getDisplayName(msg, sender),
                groupJid: gj,
                mode: "adiantar",
                shortIds: allShortIds
              });
              await sock.sendMessage(remoteJid, {
                text: [
                  ...summaries,
                  "",
                  "Questoes adiantadas:",
                  ...allShortIds.map((id, i) => `${i + 1}. #${id}`),
                  ...(webLink
                    ? ["", "🌐 Resolver no site (seu link pessoal):", webLink]
                    : []),
                  "",
                  "Deseja receber os enunciados agora? Responda sim ou nao.",
                  "(Entram em /omissas só no dia em que forem liberadas — não contam como omissa antes disso.)"
                ].join("\n")
              });
            } catch (adErr) {
              await sock.sendMessage(remoteJid, {
                text: `Erro ao adiantar: ${(adErr as Error).message}`
              });
            }
            continue;
          }

          const groupCommand = parsePrivateCommand(text);
          if (groupCommand.kind !== "unknown") {
            console.log(`[cmd] comando detectado em ${messageKind}:`, groupCommand);
          }
          if (groupCommand.kind === "answer_key") {
            const result = await getQuestionResult(groupCommand.questionId);
            await publishQuestionResult(sock, remoteJid, result, {
              discussionSource: fromGroup ? "gabarito" : undefined
            });
            continue;
          }

          if (groupCommand.kind === "ranking" || groupCommand.kind === "qa_stats" || parseQaCommand(text)) {
            const ecoRank = parseEconomyCommand(text);
            if (ecoRank && (ecoRank.kind === "ranking_eco" || text.trim().toLowerCase().startsWith("/ranking"))) {
              try {
                await handleEconomyCommand(sock, remoteJid, sender, getDisplayName(msg, sender), ecoRank.kind === "ranking_eco" ? ecoRank : { kind: "ranking_eco", board: "aura" });
              } catch (ecoErr) {
                await sock.sendMessage(remoteJid, { text: `Erro: ${(ecoErr as Error).message}` });
              }
              continue;
            }
            if (parseQaCommand(text) || groupCommand.kind === "qa_stats") {
              const groupJidForStats = fromGroup ? remoteJid : getQuizTargetGroupJid();
              const stats = await getQaStatsForGroup(groupJidForStats);
              await sock.sendMessage(remoteJid, { text: formatQaStatsMessage(stats) });
              continue;
            }
            // "ranking" sem /q&a → ranking Aura
            try {
              await handleEconomyCommand(sock, remoteJid, sender, getDisplayName(msg, sender), {
                kind: "ranking_eco",
                board: "aura"
              });
            } catch (ecoErr) {
              await sock.sendMessage(remoteJid, { text: `Erro: ${(ecoErr as Error).message}` });
            }
            continue;
          }
        }

        if (fromPrivate && quizModePrivateEnabled) {
          if (await handlePendingCategoryResolve(sock, remoteJid, sender, text)) {
            continue;
          }

          const pending = pendingAnswerChanges.get(sender);
          if (pending) {
            const normalized = normalizeInput(text);
            if (normalized === "sim" || normalized === "s") {
              try {
                const updated = await updateUserAnswer({
                  questionShortId: pending.questionId,
                  userJid: sender,
                  userName: getDisplayName(msg, sender),
                  answerLetter: pending.newAnswerLetter,
                  answerComment: pending.newAnswerComment ?? null,
                  sentAt,
                  sourceMessageId: messageId
                });
                pendingAnswerChanges.delete(sender);
                try {
                  const { notifyStudyAppAnswer } = await import("./study-sync");
                  await notifyStudyAppAnswer({
                    shortId: pending.questionId,
                    userJid: sender,
                    answerLetter: pending.newAnswerLetter,
                    comment: pending.newAnswerComment ?? null,
                    confidenceLevel: "seguro",
                    tags: pending.categories ?? [],
                    syncSource: "whatsapp"
                  });
                } catch (syncErr) {
                  console.warn("[study-sync]", (syncErr as Error).message);
                }
                await sock.sendMessage(remoteJid, { text: "Resposta atualizada ✅" });
                if (pending.categories !== undefined) {
                  await beginCategoryResolve(
                    sock,
                    remoteJid,
                    sender,
                    pending.questionId,
                    updated.answerId,
                    pending.categories
                  );
                }
                await maybePostAutoGabaritoToGroup(sock, pending.questionId);
                await maybeWakeCadernoAfterAnswer(sock, pending.questionId);
                try {
                  const result = await getQuestionResult(pending.questionId);
                  await processEconomyAfterAnswer(sock, {
                    userJid: sender,
                    userName: getDisplayName(msg, sender),
                    questionShortId: pending.questionId,
                    questionId: pending.questionId,
                    answerLetter: pending.newAnswerLetter,
                    answerKey: result.answerKey,
                    groupJid: getQuizTargetGroupJid(),
                    wasUpdate: true,
                    previousLetter: pending.previousAnswerLetter ?? null
                  });
                } catch (ecoErr) {
                  console.warn("[economy] update answer:", (ecoErr as Error).message);
                }
              } catch (ansErr) {
                pendingAnswerChanges.delete(sender);
                if (ansErr instanceof SelfAnswerNotAllowedError) {
                  await sock.sendMessage(remoteJid, { text: ansErr.message });
                  continue;
                }
                throw ansErr;
              }
              continue;
            }

            if (normalized === "nao" || normalized === "não" || normalized === "n") {
              pendingAnswerChanges.delete(sender);
              await sock.sendMessage(remoteJid, { text: "Ok, mantendo sua resposta anterior." });
              continue;
            }

            await sock.sendMessage(remoteJid, {
              text: 'Voce ja respondeu essa questao. Deseja alterar? Responda "sim" ou "nao".'
            });
            continue;
          }

          const activeSession = creationSessions.get(sender);

          if (activeSession?.stage === "awaiting_type") {
            const selectedType = parseTypeSelection(text);
            if (!selectedType) {
              await sock.sendMessage(remoteJid, { text: "Resposta invalida. Envie 1 ou 2." });
              continue;
            }

            const quizGroupJid = getQuizTargetGroupJid();
            const materias = await listMateriasForGroup(quizGroupJid);
            if (!materias.length) {
              await sock.sendMessage(remoteJid, {
                text: [
                  "Nenhuma matéria cadastrada ainda.",
                  "No site, abra *Engajamento*, crie as matérias e marque os engajados de cada uma.",
                  'Depois envie "nova questao" de novo.'
                ].join("\n")
              });
              creationSessions.delete(sender);
              continue;
            }

            creationSessions.set(sender, { stage: "awaiting_materia", questionType: selectedType });
            const lines = materias.map((m, i) => `${i + 1}. ${m.name}`);
            await sock.sendMessage(remoteJid, {
              text: ["Escolha a matéria (envie o número):", "", ...lines].join("\n")
            });
            continue;
          }

          if (activeSession?.stage === "awaiting_materia") {
            const quizGroupJid = getQuizTargetGroupJid();
            const materias = await listMateriasForGroup(quizGroupJid);
            if (!materias.length) {
              await sock.sendMessage(remoteJid, {
                text: "Nenhuma matéria cadastrada. Crie no site (Engajamento) e tente de novo."
              });
              creationSessions.delete(sender);
              continue;
            }
            const n = Number(String(text || "").trim());
            if (!Number.isInteger(n) || n < 1 || n > materias.length) {
              await sock.sendMessage(remoteJid, {
                text: `Envie um número de 1 a ${materias.length}.`
              });
              continue;
            }
            const chosen = materias[n - 1];
            creationSessions.set(sender, {
              stage: "awaiting_statement",
              questionType: activeSession.questionType,
              materiaId: chosen.id
            });
            await sock.sendMessage(remoteJid, {
              text: [
                `Matéria: *${chosen.name}*`,
                "",
                "Envie o enunciado da questao.",
                "Pode ser texto, imagem, print ou PDF."
              ].join("\n")
            });
            continue;
          }

          if (activeSession?.stage === "awaiting_statement") {
            const statementText = text || null;
            const statementMedia = await extractMediaPayload(sock, msg);
            if (!statementText && !statementMedia) {
              await sock.sendMessage(remoteJid, {
                text: "Envie um enunciado com texto, imagem ou PDF."
              });
              continue;
            }

            creationSessions.set(sender, {
              stage: "awaiting_answer_key",
              draft: {
                creatorJid: sender,
                creatorName: getDisplayName(msg, sender),
                questionType: activeSession.questionType,
                materiaId: activeSession.materiaId,
                statementText,
                statementMedia
              }
            });

            const answerTip =
              activeSession.questionType === "true_false"
                ? 'Agora envie o gabarito: "C" (certo) ou "E" (errado).'
                : 'Agora envie o gabarito. Exemplo: "A".';
            await sock.sendMessage(remoteJid, { text: answerTip });
            continue;
          }

          if (activeSession?.stage === "awaiting_answer_key") {
            const answerKey = parseAnswerKeyByType(text, activeSession.draft.questionType);
            if (!answerKey) {
              const explain =
                activeSession.draft.questionType === "true_false"
                  ? "Envie apenas C (certo) ou E (errado). Voce pode escrever so a letra, ou palavras: certo / errado."
                  : 'Envie uma letra sozinha de A ate E (ex: "b" ou "B"). Sem numeros nem simbolos a mais.';
              await sock.sendMessage(remoteJid, {
                text: [
                  "Nao entendi o gabarito.",
                  "",
                  explain,
                  "",
                  "Tente novamente."
                ].join("\n")
              });
              continue;
            }

            creationSessions.set(sender, {
              stage: "awaiting_explanation",
              draft: { ...activeSession.draft, answerKey }
            });
            await sock.sendMessage(remoteJid, {
              text: [
                "Quer adicionar explicacao/comentario da questao?",
                "Pode enviar texto, imagem ou ambos.",
                'Se nao quiser, envie: "pular".'
              ].join("\n")
            });
            continue;
          }

          if (activeSession?.stage === "awaiting_explanation") {
            const shouldSkip = isSkipCommand(text);
            const explanationText = shouldSkip ? null : text || null;
            const explanationMedia = shouldSkip ? null : await extractMediaPayload(sock, msg);
            if (!shouldSkip && !explanationText && !explanationMedia) {
              await sock.sendMessage(remoteJid, {
                text: 'Envie comentario em texto/imagem ou "pular".'
              });
              continue;
            }

            const draft: QuestionDraft = {
              ...activeSession.draft,
              explanationText,
              explanationMedia
            };

            try {
              const quizGroupJid = getQuizTargetGroupJid();
              const created = await createQuestion({
                creatorJid: draft.creatorJid,
                creatorName: draft.creatorName,
                questionType: draft.questionType,
                materiaId: draft.materiaId,
                statementText: draft.statementText,
                statementMedia: draft.statementMedia,
                answerKey: draft.answerKey,
                explanationText: draft.explanationText,
                explanationMedia: draft.explanationMedia,
                targetGroupJid: quizGroupJid
              });

              const civilToday = dateIsoInTimezone(new Date(), ECONOMY_TZ);
              const deferredToTomorrow = created.omissaDayIso > civilToday;

              await publishQuestionToGroup(sock, quizGroupJid, created.shortId, draft, {
                deferredToTomorrow
              });
              creationSessions.delete(sender);

              if (deferredToTomorrow) {
                await sock.sendMessage(remoteJid, {
                  text: [
                    `Questao #${created.shortId} criada e publicada no grupo.`,
                    `Entrou na fila de *amanhã* (corte 15h) — não conta nas omissas de hoje.`
                  ].join("\n")
                });
              } else {
                await sock.sendMessage(remoteJid, {
                  text: `Questao #${created.shortId} criada e publicada no grupo.`
                });
                await notifyGroupOmissasEntered(sock, quizGroupJid, {
                  shortIds: [created.shortId],
                  source: "questao"
                });
              }
              await processEconomyAfterCreateQuestion(sock, {
                userJid: draft.creatorJid,
                userName: draft.creatorName,
                questionId: created.shortId,
                creatorIsBot: false,
                groupJid: quizGroupJid
              });
            } catch (createError) {
              creationSessions.delete(sender);
              const message = (createError as Error).message;
              await sock.sendMessage(remoteJid, {
                text: `Falha ao criar a questao: ${message}\nEnvie "nova questao" para tentar novamente.`
              });
              console.error("[wizard] falha na criacao da questao:", message);
            }
            continue;
          }

          const command = parsePrivateCommand(text);
          console.log("[cmd] comando privado interpretado:", command);

          if (command.kind === "new_question") {
            pendingAnswerChanges.delete(sender);
            pendingCategoryResolve.delete(sender);
            creationSessions.set(sender, { stage: "awaiting_type" });
            console.log(`[wizard] sessao iniciada para ${sender}`);
            await sock.sendMessage(remoteJid, {
              text: [
                "Qual o tipo da questao?",
                "1 - Multipla escolha",
                "2 - Certo ou errado"
              ].join("\n")
            });
            continue;
          }

          if (command.kind === "new_category") {
            try {
              const created = await createUserCategory(sender, command.name);
              await sock.sendMessage(remoteJid, {
                text: created.alreadyExisted
                  ? `Categoria "${created.name}" ja existia no seu catalogo.`
                  : `Categoria "${created.name}" criada.`
              });
            } catch (catErr) {
              await sock.sendMessage(remoteJid, {
                text: `Nao foi possivel criar a categoria: ${(catErr as Error).message}`
              });
            }
            continue;
          }

          if (command.kind === "set_categories") {
            const existing = await getUserAnswer(command.questionId, sender);
            if (!existing) {
              await sock.sendMessage(remoteJid, {
                text: `Voce ainda nao respondeu a #${command.questionId}. Responda antes de categorizar (ex: b ${command.questionId} //minha categoria).`
              });
              continue;
            }
            try {
              await beginCategoryResolve(
                sock,
                remoteJid,
                sender,
                command.questionId,
                existing.answerId,
                command.categories
              );
            } catch (catErr) {
              await sock.sendMessage(remoteJid, {
                text: `Erro ao categorizar: ${(catErr as Error).message}`
              });
            }
            continue;
          }

          if (command.kind === "answer") {
            const result = await getQuestionResult(command.questionId);
            if (!isValidUserAnswer(command.answer, result.questionType)) {
              await sock.sendMessage(remoteJid, {
                text: `Resposta invalida para a questao #${command.questionId}. Use ${buildOptionsLabel(result.questionType)}.`
              });
              continue;
            }

            const existing = await getUserAnswer(command.questionId, sender);
            if (existing) {
              pendingAnswerChanges.set(sender, {
                questionId: command.questionId,
                newAnswerLetter: command.answer,
                newAnswerComment: command.comment ?? null,
                previousAnswerLetter: existing.answerLetter,
                categories: command.categories
              });

              const commentNote = command.comment ? "\n(com comentario)" : "";
              const cats = command.categories;
              const catNote =
                cats !== undefined && cats !== null
                  ? cats.length
                    ? `\n(categorias: ${cats.join(", ")})`
                    : "\n(limpar categorias)"
                  : "";
              await sock.sendMessage(remoteJid, {
                text: `Voce ja respondeu essa questao.\nDeseja alterar sua ultima resposta para ${command.answer.toUpperCase()}?${commentNote}${catNote}\nResponda "sim" ou "nao".`
              });
              continue;
            }

            try {
              const saved = await insertAnswer({
                questionShortId: command.questionId,
                userJid: sender,
                userName: getDisplayName(msg, sender),
                answerLetter: command.answer,
                answerComment: command.comment ?? null,
                sentAt,
                sourceMessageId: messageId,
                confidenceLevel: command.confidence ?? "seguro",
                syncSource: "whatsapp"
              });
              try {
                const { notifyStudyAppAnswer } = await import("./study-sync");
                await notifyStudyAppAnswer({
                  shortId: command.questionId,
                  userJid: sender,
                  answerLetter: command.answer,
                  comment: command.comment ?? null,
                  confidenceLevel: command.confidence ?? "seguro",
                  tags: command.categories ?? [],
                  syncSource: "whatsapp"
                });
              } catch (syncErr) {
                console.warn("[study-sync]", (syncErr as Error).message);
              }
              await sock.sendMessage(remoteJid, {
                text: "Resposta salva."
              });
              if (command.categories !== undefined) {
                await beginCategoryResolve(
                  sock,
                  remoteJid,
                  sender,
                  command.questionId,
                  saved.answerId,
                  command.categories
                );
              }
            } catch (ansErr) {
              if (ansErr instanceof SelfAnswerNotAllowedError) {
                await sock.sendMessage(remoteJid, { text: ansErr.message });
                continue;
              }
              throw ansErr;
            }

            await maybePostAutoGabaritoToGroup(sock, command.questionId);
            await maybeWakeCadernoAfterAnswer(sock, command.questionId);
            try {
              await processEconomyAfterAnswer(sock, {
                userJid: sender,
                userName: getDisplayName(msg, sender),
                questionShortId: command.questionId,
                questionId: command.questionId,
                answerLetter: command.answer,
                answerKey: result.answerKey,
                groupJid: getQuizTargetGroupJid(),
                wasUpdate: false
              });
            } catch (ecoErr) {
              console.warn("[economy] insert answer:", (ecoErr as Error).message);
            }
            continue;
          }

          await sock.sendMessage(remoteJid, {
            text: buildPrivateInvalidFallback()
          });
        }
      } catch (error) {
        const err = error as Error;
        const targetJid = msg.key.remoteJid;
        console.error("Erro ao processar mensagem:", err.message);
        if (targetJid) {
          await sock.sendMessage(targetJid, {
            text: `Erro: ${err.message}`
          });
        }
      }
    }
  });
}

void startBot();

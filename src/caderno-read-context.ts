/**
 * Camada de leitura genérica para cadernos / publicações / fila / respostas.
 * Omissas, atrasadas e semanal apenas COMPÕEM estes loaders — sem contextos paralelos.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";
import { publishedDayIso, dateIsoInTimezone, formatDayLabelPt, weekDayIsos, parseSendTimesJson } from "./schedule";
import { ECONOMY_TZ } from "./economy/constants";
import type { CadernoRow, DayActivityStatus, UserCadernoDayStatus } from "./supabase";

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }
  return client;
}

export { publishedDayIso };

function jidComparableKey(jid: string): string {
  const at = jid.indexOf("@");
  if (at < 0) return jid.toLowerCase().trim();
  const userPart = jid.slice(0, at);
  const userNoDevice = userPart.includes(":") ? userPart.split(":")[0]! : userPart;
  const domain = jid.slice(at + 1).toLowerCase();
  return `${userNoDevice}@${domain}`;
}

const CADERNO_SELECT =
  "id, name, target_group_jid, created_by_jid, delivery_mode, status, questions_per_day, send_times, start_hour, start_minute, end_hour, end_minute, wait_for_answers, current_day_date, current_day_sent, questions_per_run, interval_days, send_hour, send_minute, timezone, cursor, random_order, last_run_at, next_run_at";

function mapCadernoRow(row: Record<string, unknown>): CadernoRow {
  const questionsPerDayRaw =
    row.questions_per_day != null ? Number(row.questions_per_day) : Number(row.questions_per_run);
  const startHourRaw =
    row.start_hour != null ? Number(row.start_hour) : Number(row.send_hour);
  const startMinuteRaw =
    row.start_minute != null ? Number(row.start_minute) : Number(row.send_minute);
  return {
    id: Number(row.id),
    name: String(row.name),
    targetGroupJid: String(row.target_group_jid),
    createdByJid: row.created_by_jid ? String(row.created_by_jid) : null,
    deliveryMode: (row.delivery_mode === "private" ? "private" : "group") as CadernoRow["deliveryMode"],
    status: String(row.status) as CadernoRow["status"],
    questionsPerDay: Number.isFinite(questionsPerDayRaw) ? questionsPerDayRaw : 3,
    sendTimes: parseSendTimesJson(row.send_times),
    startHour: Number.isFinite(startHourRaw) ? startHourRaw : 7,
    startMinute: Number.isFinite(startMinuteRaw) ? startMinuteRaw : 0,
    endHour: Number.isFinite(Number(row.end_hour)) ? Number(row.end_hour) : 15,
    endMinute: Number.isFinite(Number(row.end_minute)) ? Number(row.end_minute) : 0,
    waitForAnswers: Boolean(row.wait_for_answers),
    currentDayDate: row.current_day_date ? String(row.current_day_date) : null,
    currentDaySent: Number(row.current_day_sent || 0),
    questionsPerRun: Number(row.questions_per_run),
    intervalDays: Number(row.interval_days),
    sendHour: Number(row.send_hour),
    sendMinute: Number(row.send_minute),
    timezone: String(row.timezone || ECONOMY_TZ),
    cursor: Number(row.cursor || 0),
    randomOrder: Boolean(row.random_order),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
    nextRunAt: row.next_run_at ? String(row.next_run_at) : null
  };
}

export type CadernosContext = {
  cadernos: CadernoRow[];
  byId: Map<number, CadernoRow>;
  /** caderno_id → engaged_since ISO (null = desde sempre). Só preenchido se userJid foi passado. */
  engagedSinceMap: Map<number, string | null>;
  passiveCadernoIds: Set<number>;
  globallyEngaged: boolean;
};

export type PublishedQuestionPub = {
  cadernoId: number;
  publishedQuestionId: number;
  publishedAt: string;
};

export type PublishedQuestionsContext = {
  rows: PublishedQuestionPub[];
  byCaderno: Map<number, PublishedQuestionPub[]>;
  /** Todos os published_question_id. */
  allPublishedIds: Set<number>;
};

export type QueueItemLite = {
  cadernoId: number;
  publishedQuestionId: number | null;
  plannedDayIso: string;
  releasedAt: string | null;
  slotIndex: number;
};

export type QueueContext = {
  rows: QueueItemLite[];
  /** Liberados (released_at preenchido). */
  releasedQuestionIds: Set<number>;
  /** Ainda não liberados: questionId → planned_day_iso. */
  unreleasedPlannedDayByQuestionId: Map<number, string>;
  /** `${cadernoId}|${dayIso}` → published question ids (com published_question_id). */
  questionIdsByCadernoDay: Map<string, number[]>;
};

export type UserAnswersContext = {
  answeredQuestionIds: Set<number>;
};

export type ShortIdsContext = {
  shortIdByQuestionId: Map<number, string>;
};

function cadernoDayKey(cadernoId: number, dayIso: string): string {
  return `${cadernoId}|${dayIso}`;
}

/**
 * Cadernos do grupo (+ engagement do user se `userJid` for passado).
 * deliveryMode group-only por default (exclui private).
 */
export async function loadCadernosContext(
  groupJid: string,
  opts: { userJid?: string; activeOnly?: boolean; includePrivate?: boolean } = {}
): Promise<CadernosContext> {
  const supabase = db();
  let q = supabase.from("cadernos").select(CADERNO_SELECT).eq("target_group_jid", groupJid);
  if (opts.activeOnly !== false) {
    q = q.eq("status", "active");
  }
  if (!opts.includePrivate) {
    q = q.neq("delivery_mode", "private");
  }

  const { data, error } = await q.order("id", { ascending: true });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("relation") && msg.includes("does not exist")) {
      return {
        cadernos: [],
        byId: new Map(),
        engagedSinceMap: new Map(),
        passiveCadernoIds: new Set(),
        globallyEngaged: false
      };
    }
    throw new Error(`Erro ao listar cadernos: ${error.message}`);
  }

  const cadernos = (data ?? []).map((row) => mapCadernoRow(row as Record<string, unknown>));
  const byId = new Map(cadernos.map((c) => [c.id, c]));
  const cadernoIds = cadernos.map((c) => c.id);

  const engagedSinceMap = new Map<number, string | null>();
  const passiveCadernoIds = new Set<number>();
  let globallyEngaged = false;

  if (opts.userJid && cadernoIds.length > 0) {
    const userKey = jidComparableKey(opts.userJid);

    const engRes = await supabase
      .from("caderno_engagement")
      .select("caderno_id, user_jid, engaged, passive, engaged_since")
      .in("caderno_id", cadernoIds);

    if (engRes.error) {
      const msg = engRes.error.message.toLowerCase();
      if (!(msg.includes("relation") && msg.includes("does not exist"))) {
        // Fallback sem engaged_since / passive
        if (msg.includes("column")) {
          const fb = await supabase
            .from("caderno_engagement")
            .select("caderno_id, user_jid, engaged")
            .in("caderno_id", cadernoIds)
            .eq("engaged", true);
          if (!fb.error) {
            for (const row of fb.data ?? []) {
              if (jidComparableKey(String(row.user_jid || "")) !== userKey) continue;
              engagedSinceMap.set(Number(row.caderno_id), null);
            }
          }
        } else {
          throw new Error(`Erro ao ler engagement: ${engRes.error.message}`);
        }
      }
    } else {
      for (const row of engRes.data ?? []) {
        if (jidComparableKey(String(row.user_jid || "")) !== userKey) continue;
        const cid = Number(row.caderno_id);
        if (!Number.isFinite(cid)) continue;
        if (row.engaged) {
          const since =
            row.engaged_since != null && String(row.engaged_since).trim()
              ? String(row.engaged_since)
              : null;
          engagedSinceMap.set(cid, since);
        }
        if (row.passive) passiveCadernoIds.add(cid);
      }
    }

    const gRes = await supabase
      .from("group_member_engagement")
      .select("user_jid")
      .eq("group_jid", groupJid)
      .eq("engaged", true);
    if (!gRes.error) {
      globallyEngaged = (gRes.data ?? []).some(
        (r) => jidComparableKey(String(r.user_jid || "")) === userKey
      );
    }
  }

  return { cadernos, byId, engagedSinceMap, passiveCadernoIds, globallyEngaged };
}

/**
 * `.in()` paginado. Sem range o PostgREST devolve só 1000 linhas
 * e as publicações mais novas somem das omissas (tratadas como órfãs).
 */
async function fetchAllIn(
  table: string,
  select: string,
  column: string,
  ids: number[]
): Promise<Record<string, unknown>[]> {
  const supabase = db();
  const pageSize = 1000;
  const chunkSize = 80;
  const uniq = [...new Set(ids.filter((id) => Number.isFinite(id)))];
  const all: Record<string, unknown>[] = [];
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const part = uniq.slice(i, i + chunkSize);
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .in(column, part)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
      if (from > 200000) break;
    }
  }
  return all;
}

/** Bulk de questões publicadas dos cadernos. */
export async function loadPublishedQuestionsContext(
  cadernoIds: number[]
): Promise<PublishedQuestionsContext> {
  const empty: PublishedQuestionsContext = {
    rows: [],
    byCaderno: new Map(),
    allPublishedIds: new Set()
  };
  if (cadernoIds.length === 0) return empty;

  let data: Record<string, unknown>[];
  try {
    data = await fetchAllIn(
      "caderno_questions",
      "caderno_id, published_question_id, published_at",
      "caderno_id",
      cadernoIds
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String((error as { message?: string }).message || error);
    throw new Error(`Erro ao listar publicações: ${message}`);
  }

  const rows: PublishedQuestionPub[] = [];
  const byCaderno = new Map<number, PublishedQuestionPub[]>();
  const allPublishedIds = new Set<number>();

  for (const row of data ?? []) {
    const cadernoId = Number(row.caderno_id);
    const publishedQuestionId =
      row.published_question_id != null ? Number(row.published_question_id) : NaN;
    const publishedAt = row.published_at ? String(row.published_at) : "";
    if (!Number.isFinite(cadernoId) || !Number.isFinite(publishedQuestionId) || !publishedAt) {
      continue;
    }
    const pub: PublishedQuestionPub = { cadernoId, publishedQuestionId, publishedAt };
    rows.push(pub);
    allPublishedIds.add(publishedQuestionId);
    let list = byCaderno.get(cadernoId);
    if (!list) {
      list = [];
      byCaderno.set(cadernoId, list);
    }
    list.push(pub);
  }

  return { rows, byCaderno, allPublishedIds };
}

/**
 * published_question_id → dia civil no timezone dado.
 * Para omissas/economia: passar ECONOMY_TZ.
 * Para calendário do caderno: filtrar por caderno e usar caderno.timezone.
 */
export function mapPublishedDayByQuestionId(
  published: PublishedQuestionsContext,
  timeZone: string
): Map<number, string> {
  const out = new Map<number, string>();
  for (const row of published.rows) {
    out.set(row.publishedQuestionId, publishedDayIso(row.publishedAt, timeZone));
  }
  return out;
}

export function questionIdsPublishedOnDay(
  published: PublishedQuestionsContext,
  cadernoId: number,
  dayIso: string,
  timeZone: string
): number[] {
  const list = published.byCaderno.get(cadernoId) || [];
  const out: number[] = [];
  for (const row of list) {
    if (publishedDayIso(row.publishedAt, timeZone) === dayIso) {
      out.push(row.publishedQuestionId);
    }
  }
  return out;
}

export function questionIdsPublishedFromDay(
  published: PublishedQuestionsContext,
  cadernoId: number,
  fromDayIso: string,
  timeZone: string
): number[] {
  const list = published.byCaderno.get(cadernoId) || [];
  const out: number[] = [];
  for (const row of list) {
    if (publishedDayIso(row.publishedAt, timeZone) >= fromDayIso) {
      out.push(row.publishedQuestionId);
    }
  }
  return out;
}

/** Fila de envio dos cadernos; opcionalmente restringe a um conjunto de dias. */
export async function loadQueueContext(
  cadernoIds: number[],
  dayIsos?: string[]
): Promise<QueueContext> {
  const empty: QueueContext = {
    rows: [],
    releasedQuestionIds: new Set(),
    unreleasedPlannedDayByQuestionId: new Map(),
    questionIdsByCadernoDay: new Map()
  };
  if (cadernoIds.length === 0) return empty;

  let data: Record<string, unknown>[] = [];
  try {
    data = await fetchAllIn(
      "caderno_send_queue",
      "caderno_id, published_question_id, planned_day_iso, released_at, slot_index",
      "caderno_id",
      cadernoIds
    );
  } catch (error) {
    const msg = String((error as { message?: string }).message || error).toLowerCase();
    if (msg.includes("relation") && msg.includes("does not exist")) return empty;
    if (msg.includes("released_at") && msg.includes("does not exist")) return empty;
    throw new Error(`Erro ao listar fila: ${msg}`);
  }

  if (dayIsos && dayIsos.length > 0) {
    const allow = new Set(dayIsos);
    data = data.filter((row) => allow.has(String(row.planned_day_iso || "")));
  }

  const rows: QueueItemLite[] = [];
  const releasedQuestionIds = new Set<number>();
  const unreleasedPlannedDayByQuestionId = new Map<number, string>();
  const questionIdsByCadernoDay = new Map<string, number[]>();

  for (const row of data ?? []) {
    const cadernoId = Number(row.caderno_id);
    const plannedDayIso = row.planned_day_iso ? String(row.planned_day_iso) : "";
    const publishedQuestionId =
      row.published_question_id != null ? Number(row.published_question_id) : null;
    const releasedAt = row.released_at != null ? String(row.released_at) : null;
    const slotIndex = Number(row.slot_index || 0);
    if (!Number.isFinite(cadernoId) || !/^\d{4}-\d{2}-\d{2}$/.test(plannedDayIso)) continue;

    rows.push({
      cadernoId,
      publishedQuestionId: publishedQuestionId != null && Number.isFinite(publishedQuestionId)
        ? publishedQuestionId
        : null,
      plannedDayIso,
      releasedAt,
      slotIndex
    });

    if (publishedQuestionId != null && Number.isFinite(publishedQuestionId)) {
      if (releasedAt) {
        releasedQuestionIds.add(publishedQuestionId);
      } else {
        unreleasedPlannedDayByQuestionId.set(publishedQuestionId, plannedDayIso);
      }
      const key = cadernoDayKey(cadernoId, plannedDayIso);
      let list = questionIdsByCadernoDay.get(key);
      if (!list) {
        list = [];
        questionIdsByCadernoDay.set(key, list);
      }
      list.push(publishedQuestionId);
    }
  }

  return {
    rows,
    releasedQuestionIds,
    unreleasedPlannedDayByQuestionId,
    questionIdsByCadernoDay
  };
}

/**
 * Quais question_ids o usuário já respondeu.
 * Filtra por prefixo do JID no SQL e confirma comparable key em memória
 * (cobre variantes :device do WhatsApp sem puxar respostas de outros users).
 */
export async function loadUserAnswersContext(
  questionIds: number[],
  userJid: string
): Promise<UserAnswersContext> {
  const answeredQuestionIds = new Set<number>();
  if (questionIds.length === 0) return { answeredQuestionIds };

  const supabase = db();
  const userKey = jidComparableKey(userJid);
  const userPart = userKey.split("@")[0] || "";
  const CHUNK = 80;

  for (let i = 0; i < questionIds.length; i += CHUNK) {
    const chunk = questionIds.slice(i, i + CHUNK);
    let from = 0;
    const PAGE = 1000;
    for (;;) {
      let q = supabase
        .from("answers")
        .select("question_id, user_jid")
        .in("question_id", chunk)
        .range(from, from + PAGE - 1);
      if (userPart) {
        q = q.like("user_jid", `${userPart}%`);
      }
      const { data, error } = await q;
      if (error) throw new Error(`Erro ao listar respostas do usuario: ${error.message}`);
      const rows = data ?? [];
      for (const row of rows) {
        const qid = Number(row.question_id);
        const jid = row.user_jid ? String(row.user_jid) : "";
        if (!Number.isFinite(qid) || !jid) continue;
        if (jidComparableKey(jid) === userKey) answeredQuestionIds.add(qid);
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }

  return { answeredQuestionIds };
}

export async function loadShortIdsContext(questionIds: number[]): Promise<ShortIdsContext> {
  const shortIdByQuestionId = new Map<number, string>();
  if (questionIds.length === 0) return { shortIdByQuestionId };

  const supabase = db();
  const CHUNK = 120;
  for (let i = 0; i < questionIds.length; i += CHUNK) {
    const chunk = questionIds.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("questions").select("id, short_id").in("id", chunk);
    if (error) throw new Error(`Erro ao listar short_ids: ${error.message}`);
    for (const row of data ?? []) {
      const id = Number(row.id);
      const sid = row.short_id ? String(row.short_id).toUpperCase() : "";
      if (Number.isFinite(id) && sid) shortIdByQuestionId.set(id, sid);
    }
  }
  return { shortIdByQuestionId };
}

/** Resolve question IDs de um dia: fila tem prioridade sobre publicações do dia. */
export function resolveDayQuestionIdsFromContexts(
  caderno: CadernoRow,
  dayIso: string,
  published: PublishedQuestionsContext,
  queue: QueueContext
): number[] {
  const fromQueue = queue.questionIdsByCadernoDay.get(cadernoDayKey(caderno.id, dayIso));
  if (fromQueue && fromQueue.length > 0) {
    return [...new Set(fromQueue)];
  }
  const tz = caderno.timezone || ECONOMY_TZ;
  return questionIdsPublishedOnDay(published, caderno.id, dayIso, tz);
}

function weekdayLabelForIso(dayIso: string): string {
  const labels = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
  const [y, m, d] = dayIso.split("-").map(Number);
  const utcDay = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
  const idx = utcDay === 0 ? 6 : utcDay - 1;
  return labels[idx];
}

export function computeDayStatus(
  dayIso: string,
  todayIso: string,
  questionIds: number[],
  answered: UserAnswersContext,
  shortIds: ShortIdsContext
): UserCadernoDayStatus {
  const sids: string[] = [];
  let answeredCount = 0;
  for (const qid of questionIds) {
    const sid = shortIds.shortIdByQuestionId.get(qid);
    if (sid) sids.push(sid);
    if (answered.answeredQuestionIds.has(qid)) answeredCount += 1;
  }
  const totalCount = questionIds.length;
  const allDone = totalCount > 0 && answeredCount >= totalCount;

  let status: DayActivityStatus;
  if (dayIso === todayIso) {
    status = allDone ? "feito" : "hoje";
  } else if (dayIso < todayIso) {
    if (totalCount === 0) status = "passou";
    else if (allDone) status = "feito";
    else status = "atrasado";
  } else if (totalCount === 0) {
    status = "pendente";
  } else if (allDone) {
    status = "feito";
  } else {
    status = "pendente";
  }

  return {
    dayIso,
    status,
    questionIds,
    shortIds: sids,
    answeredCount,
    totalCount,
    label: `${weekdayLabelForIso(dayIso)} ${formatDayLabelPt(dayIso)}`
  };
}

export type SemanaCadernoReportLite = {
  caderno: CadernoRow;
  weekStart: string;
  weekEnd: string;
  todayIso: string;
  days: UserCadernoDayStatus[];
};

/**
 * Composição: calendário semanal do user nos cadernos engajados.
 * Round-trips ~ O(cadernos) bulk + 1 answers + 1 short_ids — não cresce com dias.
 */
export async function loadSemanaContext(
  userJid: string,
  groupJid: string,
  anchorIso?: string
): Promise<SemanaCadernoReportLite[]> {
  const cadernosCtx = await loadCadernosContext(groupJid, { userJid, activeOnly: true });
  const engaged = cadernosCtx.cadernos.filter((c) => cadernosCtx.engagedSinceMap.has(c.id));
  if (engaged.length === 0) return [];

  const cadernoIds = engaged.map((c) => c.id);
  const tz0 = engaged[0]?.timezone || ECONOMY_TZ;
  const todayIso = dateIsoInTimezone(new Date(), tz0);
  const anchor = anchorIso || todayIso;
  const daysList = weekDayIsos(anchor);

  const [published, queue] = await Promise.all([
    loadPublishedQuestionsContext(cadernoIds),
    loadQueueContext(cadernoIds, daysList)
  ]);

  const allQids = new Set<number>();
  const perCadernoDays = new Map<number, Map<string, number[]>>();
  for (const c of engaged) {
    const dayMap = new Map<string, number[]>();
    for (const dayIso of daysList) {
      const qids = resolveDayQuestionIdsFromContexts(c, dayIso, published, queue);
      dayMap.set(dayIso, qids);
      for (const id of qids) allQids.add(id);
    }
    perCadernoDays.set(c.id, dayMap);
  }

  const qidList = [...allQids];
  const [answered, shortIds] = await Promise.all([
    loadUserAnswersContext(qidList, userJid),
    loadShortIdsContext(qidList)
  ]);

  const reports: SemanaCadernoReportLite[] = [];
  for (const c of engaged) {
    const dayMap = perCadernoDays.get(c.id)!;
    const todayForCaderno = dateIsoInTimezone(new Date(), c.timezone || ECONOMY_TZ);
    const days: UserCadernoDayStatus[] = daysList.map((dayIso) =>
      computeDayStatus(dayIso, todayForCaderno, dayMap.get(dayIso) || [], answered, shortIds)
    );
    reports.push({
      caderno: c,
      weekStart: daysList[0],
      weekEnd: daysList[6],
      todayIso: todayForCaderno,
      days
    });
  }
  return reports;
}

export type GroupOmissasReadContext = {
  dayIso: string;
  cadernos: CadernosContext;
  published: PublishedQuestionsContext;
  queue: QueueContext;
  /** Dia civil ECONOMY_TZ por question id (streak/omissas). */
  pubDayEconomyByQuestionId: Map<number, string>;
  visibleCadernoQuestionIds: Set<number>;
  passiveTodayDbIds: Set<number>;
  engagedSinceAllowedDbIds: Set<number>;
  engagedRestrictedCadernos: Set<number>;
};

/**
 * Composição omissas: loaders base + mapas derivados em memória.
 * Não busca answers aqui — a listagem de candidatos ainda precisa do scan de questions.
 */
export async function loadGroupOmissasContext(
  userJid: string,
  groupJid: string,
  dayIso?: string
): Promise<GroupOmissasReadContext> {
  const resolvedDay = dayIso || dateIsoInTimezone(new Date(), ECONOMY_TZ);
  // Mesmo escopo do path antigo: todos os cadernos do grupo (sem filtrar active).
  const allCadernos = await loadCadernosContext(groupJid, {
    userJid,
    activeOnly: false,
    includePrivate: true
  });
  const groupCadernos = allCadernos.cadernos.filter((c) => c.deliveryMode !== "private");
  const cadernoIds = groupCadernos.map((c) => c.id);

  const [published, queue] = await Promise.all([
    loadPublishedQuestionsContext(cadernoIds),
    loadQueueContext(cadernoIds)
  ]);

  const pubDayEconomyByQuestionId = mapPublishedDayByQuestionId(published, ECONOMY_TZ);
  const visibleCadernoQuestionIds = new Set<number>([
    ...published.allPublishedIds,
    ...queue.releasedQuestionIds
  ]);

  const engagedCadernoIds = new Set(allCadernos.engagedSinceMap.keys());
  const passiveTodayDbIds = new Set<number>();
  for (const cadernoId of allCadernos.passiveCadernoIds) {
    if (engagedCadernoIds.has(cadernoId)) continue;
    const caderno = allCadernos.byId.get(cadernoId);
    const tz = caderno?.timezone || ECONOMY_TZ;
    for (const id of questionIdsPublishedOnDay(published, cadernoId, resolvedDay, tz)) {
      passiveTodayDbIds.add(id);
    }
  }

  const engagedSinceAllowedDbIds = new Set<number>();
  const engagedRestrictedCadernos = new Set<number>();
  for (const [cadernoId, sinceIso] of allCadernos.engagedSinceMap) {
    if (!sinceIso) continue;
    engagedRestrictedCadernos.add(cadernoId);
    const caderno = allCadernos.byId.get(cadernoId);
    const tz = caderno?.timezone || ECONOMY_TZ;
    const fromDay = publishedDayIso(sinceIso, tz);
    for (const id of questionIdsPublishedFromDay(published, cadernoId, fromDay, tz)) {
      engagedSinceAllowedDbIds.add(id);
    }
  }

  return {
    dayIso: resolvedDay,
    cadernos: {
      ...allCadernos,
      cadernos: groupCadernos,
      byId: new Map(groupCadernos.map((c) => [c.id, c]))
    },
    published,
    queue,
    pubDayEconomyByQuestionId,
    visibleCadernoQuestionIds,
    passiveTodayDbIds,
    engagedSinceAllowedDbIds,
    engagedRestrictedCadernos
  };
}

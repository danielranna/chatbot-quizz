/**
 * Atividades: calendário dia/semana/mês + adiantar + sessão omissas web.
 * Montado em omissas-web.js (limite Hobby de serverless functions).
 */
const crypto = require("crypto");
const {
  getClient,
  pickTargetGroupJid,
  maxNumericShortId,
  isShortIdUniqueViolation,
  fetchAllEq,
  fetchAllIn
} = require("./_lib.js");
const { sanitizePostgresText } = require("./_text-sanitize.js");
const {
  dateIsoInTimezone,
  startOfMonthIso,
  formatDayLabelPt,
  addDaysIso,
  publishedDayIso,
  getZonedParts
} = require("./_schedule.js");
const {
  ECONOMY_TZ,
  loadCadernosContext,
  loadCalendarContext,
  loadUserAnswersContext,
  loadShortIdsContext,
  listUnansweredOmissasForUser,
  weekDayIsos,
  monthDayIsos
} = require("./_caderno-read-context.js");

const TZ = ECONOMY_TZ;

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1e6) {
        reject(new Error("Body grande demais"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

async function listEngagedCadernos(supabase, userJid, groupJid) {
  const ctx = await loadCadernosContext(supabase, groupJid, { userJid, activeOnly: true });
  return ctx.cadernos.filter((c) => ctx.engagedSinceMap.has(c.id));
}

async function listQueueForDay(supabase, cadernoId, dayIso) {
  const { data, error } = await supabase
    .from("caderno_send_queue")
    .select("id, published_question_id, slot_index, planned_day_iso")
    .eq("caderno_id", cadernoId)
    .eq("planned_day_iso", dayIso)
    .order("slot_index", { ascending: true });
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("relation") && msg.includes("does not exist")) return [];
    throw error;
  }
  return data || [];
}

async function shortIdsForQuestionIds(supabase, questionIds) {
  const ctx = await loadShortIdsContext(supabase, questionIds);
  return questionIds.map((id) => ctx.shortIdByQuestionId.get(id)).filter(Boolean);
}

async function answersByUser(supabase, questionIds, userJid) {
  const ctx = await loadUserAnswersContext(supabase, questionIds, userJid);
  const out = new Map();
  for (const qid of ctx.answeredQuestionIds) out.set(qid, true);
  return out;
}

async function listQueuedCadernoQuestionIds(supabase, cadernoId) {
  const { data, error } = await supabase
    .from("caderno_send_queue")
    .select("caderno_question_id")
    .eq("caderno_id", cadernoId)
    .is("released_at", null);
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("relation") && msg.includes("does not exist")) return new Set();
    throw error;
  }
  return new Set((data || []).map((r) => Number(r.caderno_question_id)).filter(Boolean));
}

async function listNextPending(supabase, caderno, limit) {
  const exclude = await listQueuedCadernoQuestionIds(supabase, caderno.id);
  const { data, error } = await supabase
    .from("caderno_questions")
    .select(
      "id, caderno_id, position, tec_question_id, tec_url, banca, subject, question_type, statement_text, answer_key"
    )
    .eq("caderno_id", caderno.id)
    .is("published_question_id", null)
    .order("position", { ascending: true })
    .limit(Math.max(limit + exclude.size, limit));
  if (error) throw error;
  let rows = (data || []).filter((r) => !exclude.has(Number(r.id)));
  if (caderno.randomOrder) {
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
  }
  return rows.slice(0, limit);
}

/** Aloca o próximo short_id numérico, com retry se outra publicação pegar o mesmo número. */
async function allocateGroupShortId(supabase, dbId, cursor) {
  if (cursor.next == null) {
    cursor.next = (await maxNumericShortId(supabase)) + 1;
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const shortId = String(cursor.next);
    const { error } = await supabase.from("questions").update({ short_id: shortId }).eq("id", dbId);
    if (!error) {
      cursor.next += 1;
      return shortId;
    }
    if (!isShortIdUniqueViolation(error)) throw error;
    cursor.next = (await maxNumericShortId(supabase)) + 1;
  }
  throw new Error("Falha ao alocar número da questão (short_id duplicado). Tente de novo.");
}

async function createQuestionFromCaderno(supabase, caderno, question, shortIdCursor) {
  const creatorJid = `caderno:${caderno.id}@bot`;
  const explanation = [
    "Resolução completa no Tec Concursos:",
    question.tec_url || "",
    question.banca ? `\nBanca: ${question.banca}` : "",
    question.subject ? `\nMatéria: ${question.subject}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const { data, error } = await supabase
    .from("questions")
    .insert({
      creator_jid: creatorJid,
      creator_name: `Caderno: ${caderno.name}`,
      target_group_jid: caderno.targetGroupJid,
      question_type: question.question_type,
      statement_text: question.statement_text,
      statement_media_url: null,
      statement_media_mime_type: null,
      answer_key: String(question.answer_key || "").toUpperCase(),
      explanation_text: explanation,
      explanation_media_url: null,
      explanation_media_mime_type: null,
      group_jid: caderno.targetGroupJid,
      sender_jid: creatorJid,
      message_type: "text",
      text_content: question.statement_text,
      media_mime_type: null,
      wa_message_id: `caderno-${caderno.id}-${question.id}-${Date.now()}`,
      sent_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Falha ao criar questão");
  const dbId = Number(data.id);
  const shortId = await allocateGroupShortId(supabase, dbId, shortIdCursor);
  return { shortId, dbId };
}

async function adiantarCadernoDays(supabase, caderno, dayIsos, userJid, shortIdCursor) {
  const cursor = shortIdCursor || { next: null };
  const todayIso = dateIsoInTimezone(new Date(), caderno.timezone || TZ);
  const unique = [...new Set(dayIsos.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  const N = caderno.questionsPerDay;
  const dayResults = [];
  const offerShortIds = [];
  const newlyPlannedDays = [];

  for (const dayIso of unique) {
    if (dayIso <= todayIso) {
      dayResults.push({
        dayIso,
        status: "skipped",
        shortIds: [],
        message: `${formatDayLabelPt(dayIso)}: use omissas de hoje (ou dia já passou).`
      });
      continue;
    }

    const queue = await listQueueForDay(supabase, caderno.id, dayIso);
    if (queue.length) {
      const qids = queue
        .map((q) => (q.published_question_id != null ? Number(q.published_question_id) : null))
        .filter((id) => id != null);
      const shortIds = await shortIdsForQuestionIds(supabase, qids);
      const answered = await answersByUser(supabase, qids, userJid);
      const allDone = qids.length > 0 && qids.every((id) => answered.get(id));
      if (allDone) {
        dayResults.push({
          dayIso,
          status: "feito",
          shortIds: [],
          message: `${formatDayLabelPt(dayIso)}: já feito.`
        });
      } else {
        dayResults.push({
          dayIso,
          status: "pendente",
          shortIds,
          message: `${formatDayLabelPt(dayIso)}: pendente (${shortIds.length}).`
        });
        offerShortIds.push(...shortIds);
      }
      continue;
    }

    const pending = await listNextPending(supabase, caderno, N);
    if (!pending.length) {
      dayResults.push({
        dayIso,
        status: "error",
        shortIds: [],
        message: `${formatDayLabelPt(dayIso)}: sem questões no caderno.`
      });
      continue;
    }

    const shortIds = [];
    for (let slot = 0; slot < N && slot < pending.length; slot++) {
      const q = pending[slot];
      const { shortId, dbId } = await createQuestionFromCaderno(supabase, caderno, q, cursor);
      const { error } = await supabase.from("caderno_send_queue").insert({
        caderno_id: caderno.id,
        caderno_question_id: q.id,
        planned_day_iso: dayIso,
        slot_index: slot,
        published_question_id: dbId
      });
      if (error) throw error;
      shortIds.push(shortId);
    }
    newlyPlannedDays.push(dayIso);
    offerShortIds.push(...shortIds);
    dayResults.push({
      dayIso,
      status: "novo",
      shortIds,
      message: `${formatDayLabelPt(dayIso)}: ${shortIds.length} reservada(s).`
    });
  }

  return {
    shortIds: [...new Set(offerShortIds)],
    newlyPlannedDays,
    dayResults,
    message: [`Caderno #${caderno.id} "${caderno.name}":`, ...dayResults.map((r) => r.message)].join(
      "\n"
    )
  };
}

async function createWebSession(supabase, input) {
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const shortIds = [...new Set((input.shortIds || []).map((s) => String(s).toUpperCase()).filter(Boolean))];
  const { data, error } = await supabase
    .from("omissas_web_sessions")
    .insert({
      token,
      user_jid: input.userJid,
      user_name: input.userName || null,
      group_jid: input.groupJid,
      mode: input.mode || "adiantar",
      short_ids: shortIds,
      expires_at: expiresAt
    })
    .select("token")
    .single();
  if (error) throw error;
  return { token: String(data.token), shortIds };
}

async function addPrepaidDays(supabase, userJid, days) {
  if (!days.length) return;
  const { data, error } = await supabase
    .from("user_streak")
    .select("user_jid, prepaid_days")
    .eq("user_jid", userJid)
    .maybeSingle();
  if (error) {
    console.warn("[atividades] prepaid:", error.message);
    return;
  }
  const set = new Set([...(data?.prepaid_days || []), ...days]);
  if (data) {
    await supabase
      .from("user_streak")
      .update({ prepaid_days: [...set], updated_at: new Date().toISOString() })
      .eq("user_jid", userJid);
  }
}

async function listUnansweredToday(supabase, userJid, groupJid, dayIso) {
  const cal = await loadCalendarContext(supabase, userJid, groupJid, [dayIso], dayIso);
  const shortIds = [];
  const byCaderno = [];
  for (const day of cal.days) {
    for (const c of day.cadernos || []) {
      const pending = c.pendingShortIds || [];
      shortIds.push(...pending);
      byCaderno.push({
        cadernoId: c.cadernoId,
        name: c.name,
        status: c.status,
        answeredCount: c.answeredCount,
        totalCount: c.totalCount,
        pendingShortIds: pending
      });
    }
  }
  return { shortIds: [...new Set(shortIds)], byCaderno };
}

const MAX_ERRADAS = 200;
const HIST_PAGE = 40;

function normalizeLetter(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "certo") return "C";
  if (s === "errado") return "E";
  return s.slice(0, 1).toUpperCase();
}

function answerIsCorrect(answerLetter, answerKey) {
  const key = String(answerKey || "")
    .toUpperCase()
    .slice(0, 1);
  if (!key) return false;
  return normalizeLetter(answerLetter) === key;
}

function snippetOf(text) {
  const s = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length <= 180) return s;
  return `${s.slice(0, 177)}…`;
}

function clampDays(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 7;
  const i = Math.round(n);
  if (i < 1) return 1;
  if (i > 3650) return 3650;
  return i;
}

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

async function fetchAnswersForUser(supabase, userJid) {
  const selects = [
    "id, question_id, question_short_id, answer_letter, created_at, sent_at",
    "id, question_id, question_short_id, answer_letter, created_at"
  ];
  let lastErr = null;
  for (const sel of selects) {
    try {
      return await fetchAllEq(supabase, "answers", sel, "user_jid", userJid, { orderColumn: "id" });
    } catch (e) {
      lastErr = e;
      const msg = String(e.message || "");
      if (!/sent_at|column/i.test(msg)) throw e;
    }
  }
  throw lastErr || new Error("Falha ao ler respostas");
}

async function fetchQuestionsByIds(supabase, ids) {
  const withOpts =
    "id, short_id, question_type, statement_text, statement_media_url, statement_media_mime_type, answer_key, explanation_text, explanation_media_url, explanation_media_mime_type, options, creator_name";
  const plain =
    "id, short_id, question_type, statement_text, statement_media_url, statement_media_mime_type, answer_key, explanation_text, explanation_media_url, explanation_media_mime_type, creator_name";
  try {
    return await fetchAllIn(supabase, "questions", withOpts, "id", ids);
  } catch (e) {
    if (!/options|column/i.test(String(e.message || ""))) throw e;
    return await fetchAllIn(supabase, "questions", plain, "id", ids);
  }
}

async function fetchCadernoMetaByQuestion(supabase, questionIds) {
  const map = new Map();
  if (!questionIds.length) return map;
  const selects = [
    "published_question_id, caderno_id, tec_question_id, tec_url, banca, subject, options",
    "published_question_id, caderno_id, tec_question_id, tec_url, banca, subject",
    "published_question_id, caderno_id"
  ];
  let rows = [];
  let lastErr = null;
  for (const sel of selects) {
    try {
      rows = await fetchAllIn(supabase, "caderno_questions", sel, "published_question_id", questionIds);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      if (!/column|tec_|options/i.test(String(e.message || ""))) throw e;
    }
  }
  if (lastErr && !rows.length) {
    console.warn("[atividades] historico caderno_questions:", lastErr.message || lastErr);
    return map;
  }
  for (const row of rows) {
    const qid = Number(row.published_question_id);
    if (!Number.isFinite(qid)) continue;
    const prev = map.get(qid);
    const next = {
      cadernoId: Number(row.caderno_id) || null,
      tecQuestionId: row.tec_question_id != null ? String(row.tec_question_id).trim() : "",
      tecUrl: row.tec_url != null ? String(row.tec_url).trim() : "",
      banca: row.banca != null ? String(row.banca).trim() : "",
      subject: row.subject != null ? String(row.subject).trim() : "",
      options: Array.isArray(row.options) ? row.options : []
    };
    if (!prev) {
      map.set(qid, next);
      continue;
    }
    if (!prev.tecQuestionId && next.tecQuestionId) prev.tecQuestionId = next.tecQuestionId;
    if (!prev.tecUrl && next.tecUrl) prev.tecUrl = next.tecUrl;
    if (!prev.subject && next.subject) prev.subject = next.subject;
    if (!prev.banca && next.banca) prev.banca = next.banca;
    if (!prev.options.length && next.options.length) prev.options = next.options;
  }
  return map;
}

async function buildResolvedEntries(supabase, userJid) {
  const answers = await fetchAnswersForUser(supabase, userJid);
  const questionIds = [...new Set(answers.map((a) => Number(a.question_id)).filter((n) => Number.isFinite(n)))];
  const [questions, meta] = await Promise.all([
    fetchQuestionsByIds(supabase, questionIds),
    fetchCadernoMetaByQuestion(supabase, questionIds)
  ]);
  const qById = new Map(questions.map((q) => [Number(q.id), q]));
  const cadernoIds = [...new Set([...meta.values()].map((m) => m.cadernoId).filter(Boolean))];
  const cadernoNames = new Map();
  if (cadernoIds.length) {
    const { data, error } = await supabase.from("cadernos").select("id, name").in("id", cadernoIds);
    if (!error) {
      for (const row of data || []) cadernoNames.set(Number(row.id), String(row.name || ""));
    }
  }

  const entries = [];
  for (const row of answers) {
    const q = qById.get(Number(row.question_id));
    if (!q) continue;
    const answeredAt = row.sent_at || row.created_at || null;
    const key = String(q.answer_key || "")
      .toUpperCase()
      .slice(0, 1);
    const info = meta.get(Number(q.id)) || null;
    const correct = key ? answerIsCorrect(row.answer_letter, key) : false;
    entries.push({
      answerId: Number(row.id),
      questionId: Number(q.id),
      shortId: String(row.question_short_id || q.short_id || "").toUpperCase(),
      correct,
      yourLetter: normalizeLetter(row.answer_letter),
      answerKey: key || null,
      answeredAt,
      answeredDay: answeredAt ? publishedDayIso(answeredAt, TZ) : null,
      snippet: snippetOf(q.statement_text),
      subject: info && info.subject ? info.subject : "",
      cadernoName: info && info.cadernoId ? cadernoNames.get(info.cadernoId) || "" : "",
      questionType: q.question_type || "multiple_choice",
      sourceKey:
        info && info.tecQuestionId ? `tec:${info.tecQuestionId}` : `q:${q.id}`,
      question: q,
      meta: info
    });
  }
  entries.sort((a, b) => {
    const ta = a.answeredAt ? Date.parse(a.answeredAt) : 0;
    const tb = b.answeredAt ? Date.parse(b.answeredAt) : 0;
    return tb - ta;
  });
  return entries;
}

function publicHistoryItem(entry) {
  return {
    answerId: entry.answerId,
    questionId: entry.questionId,
    shortId: entry.shortId,
    correct: entry.correct,
    yourLetter: entry.yourLetter,
    answerKey: entry.answerKey,
    answeredAt: entry.answeredAt,
    answeredDay: entry.answeredDay,
    snippet: entry.snippet,
    subject: entry.subject,
    cadernoName: entry.cadernoName,
    questionType: entry.questionType
  };
}

async function handleHistorico(req, res, supabase, userJid) {
  const url = new URL(req.url || "/", "http://localhost");
  const outcome = String(url.searchParams.get("outcome") || "all");
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Math.min(80, Math.max(1, Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : HIST_PAGE));
  const entries = await buildResolvedEntries(supabase, userJid);
  const correctCount = entries.filter((e) => e.correct).length;
  const wrongCount = entries.length - correctCount;
  const filtered =
    outcome === "wrong"
      ? entries.filter((e) => !e.correct)
      : outcome === "correct"
        ? entries.filter((e) => e.correct)
        : entries;
  const page = filtered.slice(offset, offset + limit).map(publicHistoryItem);
  return res.status(200).json({
    view: "historico",
    total: entries.length,
    correctCount,
    wrongCount,
    outcome: outcome === "wrong" || outcome === "correct" ? outcome : "all",
    offset,
    limit,
    hasMore: offset + page.length < filtered.length,
    items: page
  });
}

function validAnswerKey(raw, questionType) {
  const key = String(raw || "")
    .toUpperCase()
    .slice(0, 1);
  if (questionType === "true_false") return key === "C" || key === "E" ? key : null;
  return "ABCDE".includes(key) ? key : null;
}

async function linkPublishedQuestion(supabase, link, nowIso) {
  let { error } = await supabase
    .from("caderno_questions")
    .update({ published_question_id: link.qId, published_at: nowIso })
    .eq("id", link.cqId);
  if (error && /published_at/i.test(error.message || "")) {
    const retry = await supabase
      .from("caderno_questions")
      .update({ published_question_id: link.qId })
      .eq("id", link.cqId);
    error = retry.error;
  }
  if (error) throw error;
}

async function insertChunks(supabase, table, rows, select, chunkSize = 40) {
  const saved = [];
  const size = Math.max(1, chunkSize);
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    let { data, error } = await supabase.from(table).insert(chunk).select(select);
    if (error && /options/i.test(error.message || "")) {
      const stripped = chunk.map(({ options: _o, ...rest }) => rest);
      const retry = await supabase.from(table).insert(stripped).select(select);
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    saved.push(...(data || []));
  }
  return saved;
}

async function rollbackErradas(supabase, cadernoId, questionIds) {
  if (cadernoId) {
    const { error } = await supabase.from("cadernos").delete().eq("id", cadernoId);
    if (error) console.warn("[atividades] rollback caderno:", error.message);
  }
  const ids = (questionIds || []).filter((id) => Number.isFinite(id));
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const { error } = await supabase.from("questions").delete().in("id", part);
    if (error) console.warn("[atividades] rollback questions:", error.message);
  }
}

function pickLatestWrong(entries, startIso, todayIso) {
  const inWindow = entries.filter((e) => e.answeredDay && e.answeredDay >= startIso && e.answeredDay <= todayIso);
  const latest = new Map();
  for (const entry of inWindow) {
    const prev = latest.get(entry.sourceKey);
    if (!prev) {
      latest.set(entry.sourceKey, entry);
      continue;
    }
    const ta = entry.answeredAt ? Date.parse(entry.answeredAt) : 0;
    const tb = prev.answeredAt ? Date.parse(prev.answeredAt) : 0;
    if (ta >= tb) latest.set(entry.sourceKey, entry);
  }
  return [...latest.values()]
    .filter((e) => {
      const text = String(e.question.statement_text || "").trim();
      return (
        text &&
        !e.correct &&
        validAnswerKey(e.question.answer_key, e.question.question_type)
      );
    })
    .sort((a, b) => {
      const ta = a.answeredAt ? Date.parse(a.answeredAt) : 0;
      const tb = b.answeredAt ? Date.parse(b.answeredAt) : 0;
      return tb - ta;
    });
}

async function createErradasCaderno(supabase, res, input) {
  const { userJid, userName, groupJid } = input;
  const days = clampDays(input.days);
  const todayIso = dateIsoInTimezone(new Date(), TZ);
  const startIso = addDaysIso(todayIso, -(days - 1));
  const entries = await buildResolvedEntries(supabase, userJid);
  const wrong = pickLatestWrong(entries, startIso, todayIso);
  if (!wrong.length) {
    return res.status(200).json({
      token: null,
      count: 0,
      days,
      startIso,
      todayIso,
      message: `Nenhuma questão errada entre ${formatDayLabelPt(startIso)} e ${formatDayLabelPt(todayIso)}.`
    });
  }

  const truncated = wrong.length > MAX_ERRADAS;
  const picked = wrong.slice(0, MAX_ERRADAS);
  const z = getZonedParts(new Date(), TZ);
  const name = `Erradas · ${days} dia${days === 1 ? "" : "s"} · ${pad2(z.day)}/${pad2(z.month)} ${pad2(z.hour)}:${pad2(z.minute)}`;
  const perDay = Math.min(24, Math.max(1, picked.length));

  const { data: cadernoRow, error: cadernoErr } = await supabase
    .from("cadernos")
    .insert({
      name,
      target_group_jid: groupJid,
      created_by_jid: userJid,
      delivery_mode: "private",
      questions_per_day: perDay,
      start_hour: 7,
      start_minute: 0,
      end_hour: 7,
      end_minute: 0,
      send_times: [{ hour: 7, minute: 0 }],
      wait_for_answers: false,
      current_day_date: null,
      current_day_sent: 0,
      questions_per_run: Math.min(20, perDay),
      interval_days: 1,
      send_hour: 7,
      send_minute: 0,
      timezone: TZ,
      status: "inactive",
      cursor: 0,
      random_order: false,
      next_run_at: null
    })
    .select("id")
    .single();

  if (cadernoErr || !cadernoRow) {
    throw new Error(cadernoErr?.message || "Falha ao criar o caderno");
  }

  const cadernoId = Number(cadernoRow.id);
  const publishedIds = [];
  try {
    const cqRows = picked.map((entry, i) => {
      const q = entry.question;
      const meta = entry.meta;
      const qType = q.question_type === "true_false" ? "true_false" : "multiple_choice";
      const options =
        meta && Array.isArray(meta.options) && meta.options.length
          ? meta.options
          : Array.isArray(q.options)
            ? q.options
            : [];
      return {
        caderno_id: cadernoId,
        position: i + 1,
        tec_question_id: sanitizePostgresText(meta && meta.tecQuestionId ? meta.tecQuestionId : null),
        tec_url: sanitizePostgresText(
          (meta && meta.tecUrl) || "https://www.tecconcursos.com.br"
        ),
        banca: sanitizePostgresText(meta && meta.banca ? meta.banca : null),
        subject: sanitizePostgresText(meta && meta.subject ? meta.subject : null),
        question_type: qType,
        statement_text: sanitizePostgresText(q.statement_text || ""),
        answer_key: validAnswerKey(q.answer_key, qType),
        options
      };
    });
    const savedCq = await insertChunks(
      supabase,
      "caderno_questions",
      cqRows,
      "id, position"
    );
    if (savedCq.length !== picked.length) {
      throw new Error("Nem todas as questões entraram no caderno. Tente de novo.");
    }
    const cqByPos = new Map(savedCq.map((row) => [Number(row.position), Number(row.id)]));

    const stamp = Date.now();
    const qRows = picked.map((entry, i) => {
      const q = entry.question;
      const meta = entry.meta;
      const qType = q.question_type === "true_false" ? "true_false" : "multiple_choice";
      const position = i + 1;
      const shortId = `${position}-${cadernoId}`.toUpperCase();
      const explanation =
        sanitizePostgresText(q.explanation_text) ||
        [
          "Revisão de questão errada.",
          meta && meta.tecUrl ? meta.tecUrl : "",
          meta && meta.banca ? `Banca: ${meta.banca}` : "",
          meta && meta.subject ? `Matéria: ${meta.subject}` : ""
        ]
          .filter(Boolean)
          .join("\n");
      return {
        creator_jid: `caderno:${cadernoId}@bot`,
        creator_name: `Caderno: ${name}`,
        target_group_jid: userJid,
        question_type: qType,
        statement_text: sanitizePostgresText(q.statement_text || ""),
        statement_media_url: q.statement_media_url || null,
        statement_media_mime_type: q.statement_media_mime_type || null,
        answer_key: validAnswerKey(q.answer_key, qType),
        explanation_text: explanation,
        explanation_media_url: q.explanation_media_url || null,
        explanation_media_mime_type: q.explanation_media_mime_type || null,
        options: Array.isArray(q.options) ? q.options : [],
        group_jid: userJid,
        sender_jid: `caderno:${cadernoId}@bot`,
        message_type: "text",
        text_content: sanitizePostgresText(q.statement_text || ""),
        media_mime_type: q.statement_media_mime_type || null,
        wa_message_id: `erradas-${cadernoId}-${position}-${stamp}`,
        short_id: shortId,
        sent_at: new Date().toISOString()
      };
    });
    const savedQ = await insertChunks(
      supabase,
      "questions",
      qRows,
      "id, short_id, wa_message_id",
      15
    );
    if (savedQ.length !== picked.length) {
      throw new Error("Nem todas as questões foram publicadas. Tente de novo.");
    }
    const qByPos = new Map();
    for (const row of savedQ) {
      const m = String(row.wa_message_id || "").match(/erradas-\d+-(\d+)-\d+/);
      const pos = m ? Number(m[1]) : 0;
      if (pos) qByPos.set(pos, row);
      publishedIds.push(Number(row.id));
    }

    const nowIso = new Date().toISOString();
    const links = [];
    const sends = [];
    if (qByPos.size !== picked.length || cqByPos.size !== picked.length) {
      throw new Error("Falha ao numerar as questões do caderno. Tente de novo.");
    }
    for (let pos = 1; pos <= picked.length; pos += 1) {
      const cqId = cqByPos.get(pos);
      const qRow = qByPos.get(pos);
      if (!cqId || !qRow) continue;
      links.push({ cqId, qId: Number(qRow.id) });
      sends.push({
        caderno_id: cadernoId,
        recipient_jid: userJid,
        caderno_question_id: cqId,
        published_question_id: Number(qRow.id),
        published_at: nowIso
      });
    }

    for (let i = 0; i < links.length; i += 20) {
      const chunk = links.slice(i, i + 20);
      await Promise.all(chunk.map((link) => linkPublishedQuestion(supabase, link, nowIso)));
    }

    if (sends.length) {
      const { error: sendErr } = await supabase.from("caderno_private_send").insert(sends);
      if (sendErr) console.warn("[atividades] erradas private_send:", sendErr.message);
    }

    const { error: recErr } = await supabase.from("caderno_private_recipients").insert({
      caderno_id: cadernoId,
      user_jid: userJid,
      active: false,
      questions_per_day: perDay,
      current_day_sent: 0,
      next_run_at: null
    });
    if (recErr) console.warn("[atividades] erradas recipient:", recErr.message);

    const { error: finErr } = await supabase
      .from("cadernos")
      .update({ status: "finished", cursor: picked.length })
      .eq("id", cadernoId);
    if (finErr) console.warn("[atividades] erradas finish:", finErr.message);

    const shortIds = picked.map((_, i) => `${i + 1}-${cadernoId}`.toUpperCase());
    const session = await createWebSession(supabase, {
      userJid,
      userName,
      groupJid,
      mode: "adiantar",
      shortIds
    });

    const extra = truncated
      ? ` Entraram as ${picked.length} mais recentes; havia ${wrong.length} no período.`
      : "";
    return res.status(200).json({
      ...session,
      cadernoId,
      name,
      days,
      startIso,
      todayIso,
      count: picked.length,
      truncated,
      message: `Caderno "${name}" criado com ${picked.length} questão(ões).${extra}`
    });
  } catch (e) {
    await rollbackErradas(supabase, cadernoId, publishedIds);
    throw e;
  }
}

async function handleAtividadesGet(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const view = url.searchParams.get("view") || "week";
  const userJid = String(url.searchParams.get("userJid") || "").trim();
  if (!userJid) return res.status(400).json({ error: "Informe userJid" });

  const groupJid = pickTargetGroupJid();
  if (!groupJid) return res.status(503).json({ error: "TARGET_GROUP_JIDS não configurado" });

  const supabase = getClient();
  const todayIso = dateIsoInTimezone(new Date(), TZ);

  if (view === "historico") return handleHistorico(req, res, supabase, userJid);

  if (view === "day") {
    const day = url.searchParams.get("day") || todayIso;
    const [omissas, buckets, engagedRows] = await Promise.all([
      listUnansweredToday(supabase, userJid, groupJid, day),
      listUnansweredOmissasForUser(supabase, userJid, groupJid, {
        dayIso: day,
        todayLimit: 80,
        atrasadasLimit: 80,
        includeAtrasadas: true
      }),
      listEngagedCadernos(supabase, userJid, groupJid)
    ]);
    const engaged = engagedRows.map((c) => ({ id: c.id, name: c.name }));
    const pendingToday = [...new Set([...(omissas.shortIds || []), ...(buckets.today || [])])];
    return res.status(200).json({
      view: "day",
      todayIso,
      dayIso: day,
      engaged,
      ...omissas,
      shortIds: pendingToday,
      todayShortIds: pendingToday,
      atrasadasShortIds: buckets.atrasadas,
      dueOnDayCount: buckets.dueOnDayCount,
      openOnDayCount: Math.max(Number(buckets.openOnDayCount) || 0, pendingToday.length)
    });
  }

  if (view === "month") {
    const month = url.searchParams.get("month") || todayIso.slice(0, 7);
    const daysList = monthDayIsos(month);
    const cal = await loadCalendarContext(supabase, userJid, groupJid, daysList, todayIso);
    const days = cal.days.map((d) => ({
      dayIso: d.dayIso,
      status: d.status,
      selectable: d.selectable,
      label: formatDayLabelPt(d.dayIso),
      cadernos: d.cadernos.map((c) => ({
        cadernoId: c.cadernoId,
        name: c.name,
        status: c.status,
        answeredCount: c.answeredCount,
        totalCount: c.totalCount
      }))
    }));
    const counts = {
      feito: days.filter((d) => d.status === "feito").length,
      atrasado: days.filter((d) => d.status === "atrasado").length,
      pendente: days.filter((d) => d.status === "pendente" || d.status === "hoje").length
    };
    return res.status(200).json({
      view: "month",
      todayIso,
      month: startOfMonthIso(month).slice(0, 7),
      counts,
      engaged: cal.engaged.map((c) => ({ id: c.id, name: c.name })),
      days
    });
  }

  // week (default)
  const weekStartParam = url.searchParams.get("weekStart");
  const anchor = weekStartParam || todayIso;
  const daysList = weekDayIsos(anchor);
  const cal = await loadCalendarContext(supabase, userJid, groupJid, daysList, todayIso);

  return res.status(200).json({
    view: "week",
    todayIso,
    weekStart: daysList[0],
    weekEnd: daysList[6],
    engaged: cal.engaged.map((c) => ({ id: c.id, name: c.name })),
    days: cal.days
  });
}

async function handleAtividadesPost(req, res) {
  const body = await readBody(req);
  const action = String(body.action || "").trim();
  const userJid = String(body.userJid || "").trim();
  const userName = body.userName != null ? String(body.userName) : null;
  if (!userJid) return res.status(400).json({ error: "Informe userJid" });

  const groupJid = pickTargetGroupJid();
  if (!groupJid) return res.status(503).json({ error: "TARGET_GROUP_JIDS não configurado" });

  const supabase = getClient();

  if (action === "erradas") {
    return createErradasCaderno(supabase, res, {
      userJid,
      userName,
      groupJid,
      days: body.days
    });
  }

  const cadernos = await listEngagedCadernos(supabase, userJid, groupJid);
  if (!cadernos.length) {
    return res.status(400).json({ error: "Você não está engajado em nenhum caderno ativo." });
  }

  const todayIso = dateIsoInTimezone(new Date(), TZ);

  if (action === "session") {
    const mode = body.mode === "atrasadas" ? "atrasadas" : "hoje";
    const dayIso = String(body.dayIso || todayIso);
    if (mode === "hoje") {
      const [omissas, buckets] = await Promise.all([
        listUnansweredToday(supabase, userJid, groupJid, dayIso),
        listUnansweredOmissasForUser(supabase, userJid, groupJid, {
          dayIso,
          todayLimit: 80,
          atrasadasLimit: 0,
          includeAtrasadas: false
        })
      ]);
      const shortIds = [...new Set([...(omissas.shortIds || []), ...(buckets.today || [])])];
      if (!shortIds.length) {
        return res.status(200).json({ token: null, shortIds: [], message: "Nada pendente hoje." });
      }
      const session = await createWebSession(supabase, {
        userJid,
        userName,
        groupJid,
        mode: "hoje",
        shortIds
      });
      return res.status(200).json({ ...session, message: "Sessão criada." });
    }
    // Atrasadas: composição omissas (mesma listagem do bot) — não loop 30×N.
    const buckets = await listUnansweredOmissasForUser(supabase, userJid, groupJid, {
      dayIso: todayIso,
      todayLimit: 1,
      atrasadasLimit: 80,
      includeAtrasadas: true
    });
    const uniq = [...new Set(buckets.atrasadas)];
    if (!uniq.length) {
      return res.status(200).json({ token: null, shortIds: [], message: "Sem atrasadas." });
    }
    const session = await createWebSession(supabase, {
      userJid,
      userName,
      groupJid,
      mode: "atrasadas",
      shortIds: uniq
    });
    return res.status(200).json({ ...session, message: "Sessão de atrasadas criada." });
  }

  if (action === "adiantar") {
    let dayIsos = Array.isArray(body.dayIsos)
      ? body.dayIsos.map((d) => String(d)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [];
    dayIsos = [...new Set(dayIsos)].filter((d) => d > todayIso).sort();
    if (!dayIsos.length) {
      return res.status(400).json({ error: "Selecione dias futuros para adiantar." });
    }
    if (dayIsos.length > 14) {
      return res.status(400).json({ error: "Máximo 14 dias por vez." });
    }

    const filterCadernoId =
      body.cadernoId != null && Number.isFinite(Number(body.cadernoId))
        ? Number(body.cadernoId)
        : null;
    const targets = filterCadernoId
      ? cadernos.filter((c) => c.id === filterCadernoId)
      : cadernos;
    if (!targets.length) return res.status(400).json({ error: "Caderno não encontrado." });

    const summaries = [];
    const allShortIds = [];
    const prepaid = [];
    const shortIdCursor = { next: null };
    for (const c of targets) {
      const result = await adiantarCadernoDays(supabase, c, dayIsos, userJid, shortIdCursor);
      summaries.push(result.message);
      allShortIds.push(...result.shortIds);
      prepaid.push(...result.newlyPlannedDays);
    }
    await addPrepaidDays(supabase, userJid, [...new Set(prepaid)]);

    const uniq = [...new Set(allShortIds)];
    if (!uniq.length) {
      return res.status(200).json({
        token: null,
        shortIds: [],
        summary: summaries.join("\n"),
        message: "Nada a adiantar (já feito ou sem questões)."
      });
    }

    const session = await createWebSession(supabase, {
      userJid,
      userName,
      groupJid,
      mode: "adiantar",
      shortIds: uniq
    });
    return res.status(200).json({
      ...session,
      summary: summaries.join("\n"),
      message: "Dias adiantados. Responda no quiz abaixo."
    });
  }

  return res.status(400).json({ error: "action inválida (adiantar|session|erradas)" });
}

async function handleAtividades(req, res) {
  try {
    if (req.method === "GET") return await handleAtividadesGet(req, res);
    if (req.method === "POST") return await handleAtividadesPost(req, res);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[atividades]", e);
    return res.status(500).json({ error: e.message || "Erro interno" });
  }
}

module.exports = { handleAtividades };

/**
 * Camada de leitura genérica (espelho de src/caderno-read-context.ts).
 * Omissas / atrasadas / semana / mês só COMPÕEM estes loaders.
 */
const { dateIsoInTimezone, publishedDayIso, weekDayIsos, monthDayIsos, formatDayLabelPt } = require("./_schedule.js");
const { fetchAllEq, fetchAllIn } = require("./_lib.js");

const ECONOMY_TZ = "America/Sao_Paulo";
const WEEKDAY_LABELS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

function jidKey(jid) {
  const raw = String(jid || "").trim().toLowerCase();
  const at = raw.indexOf("@");
  if (at < 0) return raw;
  return `${raw.slice(0, at).split(":")[0]}@${raw.slice(at + 1)}`;
}

function cadernoDayKey(cadernoId, dayIso) {
  return `${cadernoId}|${dayIso}`;
}

function weekdayLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const utcDay = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
  const idx = utcDay === 0 ? 6 : utcDay - 1;
  return WEEKDAY_LABELS[idx];
}

function mapCaderno(row) {
  return {
    id: Number(row.id),
    name: String(row.name || ""),
    timezone: row.timezone || ECONOMY_TZ,
    questionsPerDay: Math.max(1, Number(row.questions_per_day) || 1),
    randomOrder: Boolean(row.random_order),
    targetGroupJid: String(row.target_group_jid || ""),
    deliveryMode: row.delivery_mode === "private" ? "private" : "group",
    status: String(row.status || ""),
    waitForAnswers: Boolean(row.wait_for_answers)
  };
}

async function loadCadernosContext(supabase, groupJid, opts = {}) {
  const activeOnly = opts.activeOnly !== false;
  const includePrivate = Boolean(opts.includePrivate);
  let q = supabase
    .from("cadernos")
    .select(
      "id, name, timezone, questions_per_day, random_order, target_group_jid, status, delivery_mode, wait_for_answers"
    )
    .eq("target_group_jid", groupJid);
  if (activeOnly) q = q.eq("status", "active");
  if (!includePrivate) q = q.neq("delivery_mode", "private");

  const { data, error } = await q.order("id", { ascending: true });
  if (error) throw error;

  const cadernos = (data || []).map(mapCaderno);
  const byId = new Map(cadernos.map((c) => [c.id, c]));
  const cadernoIds = cadernos.map((c) => c.id);
  const engagedSinceMap = new Map();
  const passiveCadernoIds = new Set();
  let globallyEngaged = false;

  if (opts.userJid && cadernoIds.length) {
    const userK = jidKey(opts.userJid);
    const engRes = await supabase
      .from("caderno_engagement")
      .select("caderno_id, user_jid, engaged, passive, engaged_since")
      .in("caderno_id", cadernoIds);

    if (engRes.error) {
      const msg = String(engRes.error.message || "").toLowerCase();
      if (!(msg.includes("relation") && msg.includes("does not exist"))) {
        if (msg.includes("column")) {
          const fb = await supabase
            .from("caderno_engagement")
            .select("caderno_id, user_jid, engaged")
            .in("caderno_id", cadernoIds)
            .eq("engaged", true);
          if (fb.error) throw fb.error;
          for (const row of fb.data || []) {
            if (jidKey(row.user_jid) !== userK) continue;
            engagedSinceMap.set(Number(row.caderno_id), null);
          }
        } else {
          throw engRes.error;
        }
      }
    } else {
      for (const row of engRes.data || []) {
        if (jidKey(row.user_jid) !== userK) continue;
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
      globallyEngaged = (gRes.data || []).some((r) => jidKey(r.user_jid) === userK);
    }
  }

  return { cadernos, byId, engagedSinceMap, passiveCadernoIds, globallyEngaged };
}

async function loadPublishedQuestionsContext(supabase, cadernoIds) {
  const empty = { rows: [], byCaderno: new Map(), allPublishedIds: new Set() };
  if (!cadernoIds.length) return empty;

  const data = await fetchAllIn(
    supabase,
    "caderno_questions",
    "caderno_id, published_question_id, published_at",
    "caderno_id",
    cadernoIds
  );

  const rows = [];
  const byCaderno = new Map();
  const allPublishedIds = new Set();
  for (const row of data || []) {
    const cadernoId = Number(row.caderno_id);
    const publishedQuestionId =
      row.published_question_id != null ? Number(row.published_question_id) : NaN;
    const publishedAt = row.published_at ? String(row.published_at) : "";
    if (!Number.isFinite(cadernoId) || !Number.isFinite(publishedQuestionId) || !publishedAt) continue;
    const pub = { cadernoId, publishedQuestionId, publishedAt };
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

function questionIdsPublishedOnDay(published, cadernoId, dayIso, timeZone) {
  const list = published.byCaderno.get(cadernoId) || [];
  const out = [];
  for (const row of list) {
    if (publishedDayIso(row.publishedAt, timeZone) === dayIso) out.push(row.publishedQuestionId);
  }
  return out;
}

function questionIdsPublishedFromDay(published, cadernoId, fromDayIso, timeZone) {
  const list = published.byCaderno.get(cadernoId) || [];
  const out = [];
  for (const row of list) {
    if (publishedDayIso(row.publishedAt, timeZone) >= fromDayIso) out.push(row.publishedQuestionId);
  }
  return out;
}

function mapPublishedDayByQuestionId(published, timeZone) {
  const out = new Map();
  for (const row of published.rows) {
    out.set(row.publishedQuestionId, publishedDayIso(row.publishedAt, timeZone));
  }
  return out;
}

async function loadQueueContext(supabase, cadernoIds, dayIsos) {
  const empty = {
    rows: [],
    releasedQuestionIds: new Set(),
    unreleasedPlannedDayByQuestionId: new Map(),
    questionIdsByCadernoDay: new Map()
  };
  if (!cadernoIds.length) return empty;

  let data;
  try {
    data = await fetchAllIn(
      supabase,
      "caderno_send_queue",
      "caderno_id, published_question_id, planned_day_iso, released_at, slot_index",
      "caderno_id",
      cadernoIds
    );
  } catch (error) {
    const msg = String(error.message || error).toLowerCase();
    if (msg.includes("relation") && msg.includes("does not exist")) return empty;
    if (msg.includes("released_at")) return empty;
    throw error;
  }
  if (dayIsos && dayIsos.length) {
    const allow = new Set(dayIsos);
    data = data.filter((row) => allow.has(String(row.planned_day_iso || "")));
  }

  const rows = [];
  const releasedQuestionIds = new Set();
  const unreleasedPlannedDayByQuestionId = new Map();
  const questionIdsByCadernoDay = new Map();

  for (const row of data || []) {
    const cadernoId = Number(row.caderno_id);
    const plannedDayIso = row.planned_day_iso ? String(row.planned_day_iso) : "";
    const publishedQuestionId =
      row.published_question_id != null ? Number(row.published_question_id) : null;
    const releasedAt = row.released_at != null ? String(row.released_at) : null;
    if (!Number.isFinite(cadernoId) || !/^\d{4}-\d{2}-\d{2}$/.test(plannedDayIso)) continue;

    rows.push({
      cadernoId,
      publishedQuestionId:
        publishedQuestionId != null && Number.isFinite(publishedQuestionId)
          ? publishedQuestionId
          : null,
      plannedDayIso,
      releasedAt,
      slotIndex: Number(row.slot_index || 0)
    });

    if (publishedQuestionId != null && Number.isFinite(publishedQuestionId)) {
      if (releasedAt) releasedQuestionIds.add(publishedQuestionId);
      else unreleasedPlannedDayByQuestionId.set(publishedQuestionId, plannedDayIso);
      const key = cadernoDayKey(cadernoId, plannedDayIso);
      let list = questionIdsByCadernoDay.get(key);
      if (!list) {
        list = [];
        questionIdsByCadernoDay.set(key, list);
      }
      list.push(publishedQuestionId);
    }
  }

  return { rows, releasedQuestionIds, unreleasedPlannedDayByQuestionId, questionIdsByCadernoDay };
}

async function loadUserAnswersContext(supabase, questionIds, userJid) {
  const answeredQuestionIds = new Set();
  if (!questionIds.length) return { answeredQuestionIds };

  const userK = jidKey(userJid);
  const userPart = userK.split("@")[0] || "";
  const CHUNK = 80;
  for (let i = 0; i < questionIds.length; i += CHUNK) {
    const chunk = questionIds.slice(i, i + CHUNK);
    let q = supabase.from("answers").select("question_id, user_jid").in("question_id", chunk);
    if (userPart) q = q.like("user_jid", `${userPart}%`);
    const { data, error } = await q;
    if (error) throw error;
    for (const row of data || []) {
      if (jidKey(row.user_jid) !== userK) continue;
      answeredQuestionIds.add(Number(row.question_id));
    }
  }
  return { answeredQuestionIds };
}

async function loadShortIdsContext(supabase, questionIds) {
  const shortIdByQuestionId = new Map();
  if (!questionIds.length) return { shortIdByQuestionId };
  const CHUNK = 120;
  for (let i = 0; i < questionIds.length; i += CHUNK) {
    const chunk = questionIds.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("questions").select("id, short_id").in("id", chunk);
    if (error) throw error;
    for (const row of data || []) {
      const id = Number(row.id);
      const sid = row.short_id ? String(row.short_id).toUpperCase() : "";
      if (Number.isFinite(id) && sid) shortIdByQuestionId.set(id, sid);
    }
  }
  return { shortIdByQuestionId };
}

function resolveDayQuestionIdsFromContexts(caderno, dayIso, published, queue) {
  const fromQueue = queue.questionIdsByCadernoDay.get(cadernoDayKey(caderno.id, dayIso));
  if (fromQueue && fromQueue.length) return [...new Set(fromQueue)];
  return questionIdsPublishedOnDay(published, caderno.id, dayIso, caderno.timezone || ECONOMY_TZ);
}

function computeDayStatus(dayIso, todayIso, questionIds, answered, shortIds) {
  const sids = [];
  const pendingShortIds = [];
  let answeredCount = 0;
  for (const qid of questionIds) {
    const sid = shortIds.shortIdByQuestionId.get(qid);
    if (sid) sids.push(sid);
    if (answered.answeredQuestionIds.has(qid)) answeredCount += 1;
    else if (sid) pendingShortIds.push(sid);
  }
  const totalCount = questionIds.length;
  const allDone = totalCount > 0 && answeredCount >= totalCount;

  let status;
  if (dayIso === todayIso) status = allDone ? "feito" : "hoje";
  else if (dayIso < todayIso) {
    if (totalCount === 0) status = "passou";
    else if (allDone) status = "feito";
    else status = "atrasado";
  } else if (totalCount === 0) status = "pendente";
  else if (allDone) status = "feito";
  else status = "pendente";

  return {
    dayIso,
    status,
    questionIds,
    shortIds: sids,
    pendingShortIds,
    answeredCount,
    totalCount,
    label: `${weekdayLabel(dayIso)} ${formatDayLabelPt(dayIso)}`,
    selectable: dayIso > todayIso && status !== "feito"
  };
}

function mergeStatus(statuses) {
  if (!statuses.length) return "passou";
  if (statuses.some((s) => s.status === "atrasado")) return "atrasado";
  if (statuses.some((s) => s.status === "hoje")) return "hoje";
  const withQ = statuses.filter((s) => s.totalCount > 0);
  if (withQ.length && withQ.every((s) => s.status === "feito")) return "feito";
  if (statuses.some((s) => s.status === "pendente")) return "pendente";
  if (statuses.every((s) => s.status === "feito")) return "feito";
  if (statuses.every((s) => s.status === "passou")) return "passou";
  return "pendente";
}

/**
 * Calendário week/month: O(cadernos) + batches — não M×N.
 */
async function loadCalendarContext(supabase, userJid, groupJid, daysList, todayIso) {
  const cadernosCtx = await loadCadernosContext(supabase, groupJid, {
    userJid,
    activeOnly: true
  });
  const engaged = cadernosCtx.cadernos.filter((c) => cadernosCtx.engagedSinceMap.has(c.id));
  if (!engaged.length) {
    return { engaged: [], days: daysList.map((dayIso) => ({ dayIso, status: "passou", cadernos: [] })) };
  }

  const cadernoIds = engaged.map((c) => c.id);
  const [published, queue] = await Promise.all([
    loadPublishedQuestionsContext(supabase, cadernoIds),
    loadQueueContext(supabase, cadernoIds, daysList)
  ]);

  const allQids = new Set();
  const perCadernoDays = new Map();
  for (const c of engaged) {
    const dayMap = new Map();
    for (const dayIso of daysList) {
      const qids = resolveDayQuestionIdsFromContexts(c, dayIso, published, queue);
      dayMap.set(dayIso, qids);
      for (const id of qids) allQids.add(id);
    }
    perCadernoDays.set(c.id, dayMap);
  }

  const qidList = [...allQids];
  const [answered, shortIds] = await Promise.all([
    loadUserAnswersContext(supabase, qidList, userJid),
    loadShortIdsContext(supabase, qidList)
  ]);

  const days = daysList.map((dayIso) => {
    const perCaderno = engaged.map((c) => {
      const qids = perCadernoDays.get(c.id).get(dayIso) || [];
      return computeDayStatus(dayIso, todayIso, qids, answered, shortIds);
    });
    const status = mergeStatus(perCaderno);
    return {
      dayIso,
      status,
      selectable: dayIso > todayIso && status !== "feito",
      label: `${weekdayLabel(dayIso)} ${formatDayLabelPt(dayIso)}`,
      weekday: weekdayLabel(dayIso),
      cadernos: perCaderno.map((s, i) => ({
        cadernoId: engaged[i].id,
        name: engaged[i].name,
        status: s.status,
        answeredCount: s.answeredCount,
        totalCount: s.totalCount,
        shortIds: s.shortIds,
        pendingShortIds: s.pendingShortIds || []
      }))
    };
  });

  return { engaged, days, answered, shortIds, published, queue, perCadernoDays };
}

function isBotCreatorJid(creatorJid) {
  return String(creatorJid || "").toLowerCase().startsWith("caderno:");
}

function parseCadernoIdFromCreatorJid(creatorJid) {
  const m = String(creatorJid || "").match(/^caderno:(\d+)@bot$/i);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function isPrivateCadernoShortId(shortId) {
  return /^\d+-\d+(-[A-Z0-9]+)?$/i.test(String(shortId || "").trim());
}

async function loadGroupOmissasContext(supabase, userJid, groupJid, dayIso) {
  const resolvedDay = dayIso || dateIsoInTimezone(new Date(), ECONOMY_TZ);
  const allCadernos = await loadCadernosContext(supabase, groupJid, {
    userJid,
    activeOnly: false,
    includePrivate: true
  });
  const groupCadernos = allCadernos.cadernos.filter((c) => c.deliveryMode !== "private");
  const cadernoIds = groupCadernos.map((c) => c.id);

  const [published, queue] = await Promise.all([
    loadPublishedQuestionsContext(supabase, cadernoIds),
    loadQueueContext(supabase, cadernoIds)
  ]);

  const pubDayEconomyByQuestionId = mapPublishedDayByQuestionId(published, ECONOMY_TZ);
  const visibleCadernoQuestionIds = new Set([
    ...published.allPublishedIds,
    ...queue.releasedQuestionIds
  ]);

  const engagedCadernoIds = new Set(allCadernos.engagedSinceMap.keys());
  const passiveTodayDbIds = new Set();
  for (const cadernoId of allCadernos.passiveCadernoIds) {
    if (engagedCadernoIds.has(cadernoId)) continue;
    const caderno = allCadernos.byId.get(cadernoId);
    const tz = (caderno && caderno.timezone) || ECONOMY_TZ;
    for (const id of questionIdsPublishedOnDay(published, cadernoId, resolvedDay, tz)) {
      passiveTodayDbIds.add(id);
    }
  }

  const engagedSinceAllowedDbIds = new Set();
  const engagedRestrictedCadernos = new Set();
  for (const [cadernoId, sinceIso] of allCadernos.engagedSinceMap) {
    if (!sinceIso) continue;
    engagedRestrictedCadernos.add(cadernoId);
    const caderno = allCadernos.byId.get(cadernoId);
    const tz = (caderno && caderno.timezone) || ECONOMY_TZ;
    const fromDay = publishedDayIso(sinceIso, tz);
    for (const id of questionIdsPublishedFromDay(published, cadernoId, fromDay, tz)) {
      engagedSinceAllowedDbIds.add(id);
    }
  }

  return {
    dayIso: resolvedDay,
    cadernos: allCadernos,
    published,
    queue,
    pubDayEconomyByQuestionId,
    visibleCadernoQuestionIds,
    passiveTodayDbIds,
    engagedSinceAllowedDbIds,
    engagedRestrictedCadernos
  };
}

/**
 * Listagem omissas (hoje + atrasadas) — mesma lógica do bot, via loaders.
 */
async function listUnansweredOmissasForUser(supabase, userJid, groupJid, opts = {}) {
  const todayLimit = Math.max(1, opts.todayLimit ?? 40);
  const atrasadasLimit = Math.max(0, opts.atrasadasLimit ?? 40);
  const includeAtrasadas = opts.includeAtrasadas !== false;
  const ctx = await loadGroupOmissasContext(supabase, userJid, groupJid, opts.dayIso);
  const dayIso = ctx.dayIso;
  const engagedCadernoIds = new Set(ctx.cadernos.engagedSinceMap.keys());

  let qRows = [];
  try {
    qRows = await fetchAllEq(
      supabase,
      "questions",
      "id, short_id, creator_jid, created_at, omissa_day_iso",
      "target_group_jid",
      groupJid
    );
  } catch (qErr) {
    if (!String(qErr.message || "").toLowerCase().includes("omissa_day_iso")) throw qErr;
    qRows = await fetchAllEq(
      supabase,
      "questions",
      "id, short_id, creator_jid, created_at",
      "target_group_jid",
      groupJid
    );
  }

  const candidates = [];
  for (const row of qRows || []) {
    if (!row.short_id) continue;
    const sid = String(row.short_id).toUpperCase();
    if (isPrivateCadernoShortId(sid)) continue;
    const qid = Number(row.id);
    const creatorJid = String(row.creator_jid || "");
    if (creatorJid && jidKey(creatorJid) === jidKey(userJid)) continue;

    const plannedFuture = ctx.queue.unreleasedPlannedDayByQuestionId.get(qid);
    const publishedDay = ctx.pubDayEconomyByQuestionId.get(qid);
    if (plannedFuture && plannedFuture > dayIso && !(publishedDay && publishedDay <= dayIso)) continue;

    if (isBotCreatorJid(creatorJid)) {
      const cadernoId = parseCadernoIdFromCreatorJid(creatorJid);
      if (cadernoId == null) continue;
      const isEngaged = engagedCadernoIds.has(cadernoId);
      const isPassiveToday = ctx.passiveTodayDbIds.has(qid);
      if (!isEngaged && !isPassiveToday) continue;
      if (isEngaged && !ctx.visibleCadernoQuestionIds.has(qid)) continue;
      if (
        isEngaged &&
        ctx.engagedRestrictedCadernos.has(cadernoId) &&
        !ctx.engagedSinceAllowedDbIds.has(qid)
      ) {
        continue;
      }
    } else if (!ctx.cadernos.globallyEngaged) {
      continue;
    }

    let pubDay = ctx.pubDayEconomyByQuestionId.get(qid);
    if (!pubDay && plannedFuture) pubDay = plannedFuture;
    if (!isBotCreatorJid(creatorJid) && row.omissa_day_iso) {
      pubDay = String(row.omissa_day_iso);
    } else if (!pubDay && row.omissa_day_iso) {
      pubDay = String(row.omissa_day_iso);
    }
    if (!pubDay && row.created_at) {
      pubDay = publishedDayIso(String(row.created_at), ECONOMY_TZ);
    }
    if (!pubDay || pubDay > dayIso) continue;
    candidates.push({ sid, qid, pubDay });
  }

  const answers = await loadUserAnswersContext(
    supabase,
    candidates.map((c) => c.qid),
    userJid
  );

  const today = [];
  const atrasadas = [];
  let dueOnDayCount = 0;
  let openOnDayCount = 0;
  for (const c of candidates) {
    const answered = answers.answeredQuestionIds.has(c.qid);
    if (c.pubDay === dayIso) {
      dueOnDayCount += 1;
      if (!answered) {
        openOnDayCount += 1;
        if (today.length < todayLimit) today.push(c.sid);
      }
      continue;
    }
    if (!includeAtrasadas || answered) continue;
    if (c.pubDay < dayIso && atrasadas.length < atrasadasLimit) atrasadas.push(c.sid);
  }

  return { today, atrasadas, dueOnDayCount, openOnDayCount, dayIso };
}

module.exports = {
  ECONOMY_TZ,
  jidKey,
  loadCadernosContext,
  loadPublishedQuestionsContext,
  loadQueueContext,
  loadUserAnswersContext,
  loadShortIdsContext,
  loadCalendarContext,
  loadGroupOmissasContext,
  listUnansweredOmissasForUser,
  resolveDayQuestionIdsFromContexts,
  computeDayStatus,
  mergeStatus,
  questionIdsPublishedOnDay,
  weekDayIsos,
  monthDayIsos,
  dateIsoInTimezone,
  publishedDayIso,
  formatDayLabelPt,
  weekdayLabel
};

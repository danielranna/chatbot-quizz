(function () {
  const IS_CADERNOS_PAGE = document.body?.dataset?.page === "cadernos";

  const API = {
    questions: "/api/questions",
    qaStats: "/api/qa-stats",
    reportData: "/api/report-data",
    detail: (id, userJid) => {
      let u = `/api/question-detail?shortId=${encodeURIComponent(id)}`;
      if (userJid) u += `&userJid=${encodeURIComponent(userJid)}`;
      return u;
    },
    submit: "/api/question-submit",
    userCategories: "/api/user-categories",
    answerCategories: "/api/answer-categories",
    engagement: "/api/engagement",
    cadernoEngagement: (cadernoId) =>
      `/api/engagement?cadernoId=${encodeURIComponent(cadernoId)}`,
    cadernos: "/api/cadernos",
    cadernoUpload: "/api/caderno-upload",
    cadernoDelete: "/api/caderno-delete",
    economy: "/api/economy",
    shop: "/api/economy?view=shop",
    shopPost: "/api/economy",
    diario: "/api/economy",
    rankings: "/api/economy"
  };

  const STORAGE_USER = "papaVagasHubUser";

  const els = {
    qaStatsTotals: document.getElementById("qa-stats-totals"),
    qaStatsTable: document.getElementById("qa-stats-table-body"),
    qaStatsTableWrap: document.getElementById("qa-stats-table-wrap"),
    qaStatsWarning: document.getElementById("qa-stats-warning"),
    questionsGrid: document.getElementById("questions-grid"),
    questionsMoreWrap: document.getElementById("questions-more-wrap"),
    btnQuestionsMore: document.getElementById("btn-questions-more"),
    loadErr: document.getElementById("load-error"),
    modal: document.getElementById("modal-overlay"),
    modalTitle: document.getElementById("modal-title"),
    modalAuthor: document.getElementById("modal-author"),
    modalStatement: document.getElementById("modal-statement"),
    modalChoices: document.getElementById("modal-choices"),
    modalFeedback: document.getElementById("modal-feedback"),
    modalRevealBtn: document.getElementById("modal-reveal-btn"),
    modalRevealBox: document.getElementById("modal-reveal-box"),
    modalGabarito: document.getElementById("modal-gabarito"),
    modalComment: document.getElementById("modal-comment"),
    modalCommentMedia: document.getElementById("modal-comment-media"),
    btnClose: document.getElementById("modal-close"),
    questionsFilters: document.getElementById("questions-filters"),
    filterPerson: document.getElementById("filter-person"),
    filterOutcome: document.getElementById("filter-outcome"),
    filtersHint: document.getElementById("filters-hint"),
    reportOverlay: document.getElementById("report-overlay"),
    reportClose: document.getElementById("report-close"),
    reportPerson: document.getElementById("report-person"),
    reportStatus: document.getElementById("report-status"),
    reportCaderno: document.getElementById("report-caderno"),
    reportDateFrom: document.getElementById("report-date-from"),
    reportDateTo: document.getElementById("report-date-to"),
    reportQidFrom: document.getElementById("report-qid-from"),
    reportQidTo: document.getElementById("report-qid-to"),
    reportOutcome: document.getElementById("report-outcome"),
    reportGenerate: document.getElementById("report-generate"),
    reportCatAdd: document.getElementById("report-cat-add"),
    reportCatRulesList: document.getElementById("report-cat-rules-list"),
    reportIncludeDiscussions: document.getElementById("report-include-discussions"),
    practiceUserSelect: document.getElementById("practice-user-select"),
    modalPrev: document.getElementById("modal-prev"),
    modalNext: document.getElementById("modal-next"),
    modalCategories: document.getElementById("modal-categories"),
    modalCategoriesHint: document.getElementById("modal-categories-hint"),
    modalCategoriesToggles: document.getElementById("modal-categories-toggles"),
    modalNewCat: document.getElementById("modal-new-cat"),
    modalSaveCats: document.getElementById("modal-save-cats"),
    newcatOverlay: document.getElementById("newcat-overlay"),
    newcatClose: document.getElementById("newcat-close"),
    newcatName: document.getElementById("newcat-name"),
    newcatStatus: document.getElementById("newcat-status"),
    newcatSave: document.getElementById("newcat-save"),
    btnReportOpen: document.getElementById("btn-report-open"),
    btnCadernosOpen: document.getElementById("btn-cadernos-open"),
    cadernosOverlay: document.getElementById("cadernos-overlay"),
    cadernosClose: document.getElementById("cadernos-close"),
    cadernosStatus: document.getElementById("cadernos-status"),
    cadernosList: document.getElementById("cadernos-list"),
    btnCadernoAdd: document.getElementById("btn-caderno-add"),
    cadernoAddOverlay: document.getElementById("caderno-add-overlay"),
    cadernoAddClose: document.getElementById("caderno-add-close"),
    cadernoName: document.getElementById("caderno-name"),
    cadernoPdf: document.getElementById("caderno-pdf"),
    cadernoMd: document.getElementById("caderno-md"),
    cadernoMdFile: document.getElementById("caderno-md-file"),
    cadernoPreviewBoxIa: document.getElementById("caderno-preview-box-ia"),
    btnCadernoPreviewIa: document.getElementById("btn-caderno-preview-ia"),
    btnCopyIaPrompt: document.getElementById("btn-copy-ia-prompt"),
    btnCopyIaExample: document.getElementById("btn-copy-ia-example"),
    cadernoPerDay: document.getElementById("caderno-per-day"),
    cadernoTime: document.getElementById("caderno-time"),
    cadernoEndTime: document.getElementById("caderno-end-time"),
    cadernoSendTimesList: document.getElementById("caderno-send-times-list"),
    btnCadernoFillUniform: document.getElementById("btn-caderno-fill-uniform"),
    cadernoAddGroupSchedule: document.getElementById("caderno-add-group-schedule"),
    cadernoAddStatus: document.getElementById("caderno-add-status"),
    cadernoPreviewBox: document.getElementById("caderno-preview-box"),
    cadernoRandom: document.getElementById("caderno-random"),
    cadernoWait: document.getElementById("caderno-wait"),
    cadernoDeliveryGroup: document.getElementById("caderno-delivery-group"),
    cadernoDeliveryPrivate: document.getElementById("caderno-delivery-private"),
    cadernoPrivateAddPanel: document.getElementById("caderno-private-add-panel"),
    cadernoAddPrivateList: document.getElementById("caderno-add-private-list"),
    btnCadernoAddLoadMembers: document.getElementById("btn-caderno-add-load-members"),
    btnCadernoPreview: document.getElementById("btn-caderno-preview"),
    btnCadernoSave: document.getElementById("btn-caderno-save"),
    btnCadernoSaveActivate: document.getElementById("btn-caderno-save-activate"),
    cadernoAddEngagementPanel: document.getElementById("caderno-add-engagement-panel"),
    cadernoAddEngagementList: document.getElementById("caderno-add-engagement-list"),
    cadernoAddEngagementStatus: document.getElementById("caderno-add-engagement-status"),
    btnCadernoAddLoadEngagement: document.getElementById("btn-caderno-add-load-engagement"),
    wizardPrev: document.getElementById("wizard-prev"),
    wizardNext: document.getElementById("wizard-next"),
    wizardSteps: document.getElementById("wizard-steps"),
    wizardStepCaption: document.getElementById("wizard-step-caption"),
    wizardSummary: document.getElementById("wizard-summary"),
    cadernoEditOverlay: document.getElementById("caderno-edit-overlay"),
    cadernoEditClose: document.getElementById("caderno-edit-close"),
    cadernoEditId: document.getElementById("caderno-edit-id"),
    cadernoEditName: document.getElementById("caderno-edit-name"),
    cadernoEditPerDay: document.getElementById("caderno-edit-per-day"),
    cadernoEditTime: document.getElementById("caderno-edit-time"),
    cadernoEditEndTime: document.getElementById("caderno-edit-end-time"),
    cadernoEditSendTimesList: document.getElementById("caderno-edit-send-times-list"),
    btnCadernoEditFillUniform: document.getElementById("btn-caderno-edit-fill-uniform"),
    cadernoEditGroupSchedule: document.getElementById("caderno-edit-group-schedule"),
    cadernoEditRandom: document.getElementById("caderno-edit-random"),
    cadernoEditWait: document.getElementById("caderno-edit-wait"),
    cadernoEditDeliveryGroup: document.getElementById("caderno-edit-delivery-group"),
    cadernoEditDeliveryPrivate: document.getElementById("caderno-edit-delivery-private"),
    cadernoEditPrivatePanel: document.getElementById("caderno-edit-private-panel"),
    cadernoEditPrivateList: document.getElementById("caderno-edit-private-list"),
    btnCadernoEditLoadMembers: document.getElementById("btn-caderno-edit-load-members"),
    cadernoEditEngagementPanel: document.getElementById("caderno-edit-engagement-panel"),
    cadernoEditEngagementList: document.getElementById("caderno-edit-engagement-list"),
    cadernoEditEngagementStatus: document.getElementById("caderno-edit-engagement-status"),
    btnCadernoEditLoadEngagement: document.getElementById("btn-caderno-edit-load-engagement"),
    cadernoEditStatus: document.getElementById("caderno-edit-status"),
    btnCadernoEditSave: document.getElementById("btn-caderno-edit-save"),
    btnCadernoEditCancel: document.getElementById("btn-caderno-edit-cancel")
  };

  let cadernosCache = [];
  let cadernoUploadInFlight = false;
  const cadernosUi = {
    search: "",
    status: "current",
    mode: "all",
    sort: "name",
    showAll: false
  };
  /** Aviso da API ou erro de carga; vazio quando a lista carregou. */
  let cadernosLoadMessage = "";

  let questionsList = [];
  const QUESTIONS_PREVIEW_LIMIT = 9;
  let questionsShowAll = false;
  /** @type {null | { questions: any[], answers: any[], participants: any[], warning?: string }} */
  let reportData = null;

  let currentShortId = null;
  let submitPayload = null;
  /** @type {Map<string, any>} */
  const practiceDetailCache = new Map();
  let modalOpenGen = 0;
  /** @type {{ id: number, name: string }[]} */
  let modalUserCategories = [];
  /** @type {Set<number>} */
  let modalSelectedCategoryIds = new Set();
  let modalHasAnswer = false;
  /** @type {{ userJid: string, userName: string }[]} */
  let practiceMembersCache = [];
  /** @type {{ key: string, mode: "filter" | "incremental" }[]} */
  let reportCategoryRules = [];
  /** @type {{ userJid: string, userLabel: string | null, displayLabel?: string | null, engaged: boolean, passive?: boolean }[]} */
  let engagementMembersCache = [];
  /** @type {{ userJid: string, userLabel: string | null, displayLabel?: string | null, engaged: boolean, passive?: boolean }[]} */
  let cadernoEngagementCache = [];
  let cadernoEngagementEditId = null;
  /** Seleção provisória de engajados/passivos no wizard (antes do caderno existir). */
  let cadernoAddEngagementDraft = [];
  let wizardStep = 0;
  let wizardSource = "";

  async function fetchJson(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const method = (options.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const r = await fetch(url, {
      ...options,
      headers
    });
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text || r.statusText);
    }
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function escAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function truncate(text, max) {
    if (!text || typeof text !== "string") return "";
    const t = text.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
  }

  function renderQaStats(data) {
    if (data.warning) {
      els.qaStatsWarning.textContent = data.warning;
      els.qaStatsWarning.classList.remove("hidden");
    } else {
      els.qaStatsWarning.textContent = "";
      els.qaStatsWarning.classList.add("hidden");
    }

    const totals = data.totals || { questionsCreated: 0, answersRecorded: 0 };
    const botCount = data.botCreatedCount ?? 0;
    if (els.qaStatsTotals) {
      els.qaStatsTotals.innerHTML = `
        <div class="qa-total-card">
          <span class="qa-total-num">${totals.questionsCreated}</span>
          <span class="qa-total-label">questões no grupo</span>
        </div>
        <div class="qa-total-card">
          <span class="qa-total-num">${totals.answersRecorded}</span>
          <span class="qa-total-label">respostas registradas</span>
        </div>
        <div class="qa-total-card qa-total-bot">
          <span class="qa-total-num">${botCount}</span>
          <span class="qa-total-label">do bot (cadernos)</span>
        </div>`;
    }

    const participants = data.participants || [];
    if (!participants.length) {
      if (els.qaStatsTable) {
        els.qaStatsTable.innerHTML =
          '<tr><td colspan="3" class="loading">Nenhum participante com criação ou resposta ainda.</td></tr>';
      }
      return;
    }

    els.qaStatsTable.innerHTML = participants
      .map((p) => {
        const c = p.cosmetics || {};
        const css = (c.css || []).join(" ");
        const emoji = c.emoji ? `${c.emoji} ` : "";
        const title = c.title ? ` <span class="qa-title-badge">${esc(c.title)}</span>` : "";
        return `
        <tr>
          <td class="qa-name ${esc(css)}">${emoji}${esc(p.userLabel)}${title}</td>
          <td>${p.createdCount}</td>
          <td>${p.answeredCount}</td>
        </tr>`;
      })
      .join("");
    if (els.qaStatsTableWrap) els.qaStatsTableWrap.style.display = "";
  }

  function renderQuestions(list) {
    if (!list.length) {
      els.questionsGrid.innerHTML =
        '<p class="loading">Nenhuma questão cadastrada ou nenhuma combina com os filtros.</p>';
      return;
    }
    els.questionsGrid.innerHTML = list
      .map((q) => {
        const typeLabel = q.questionType === "true_false" ? "Certo / errado" : "Múltipla escolha";
        const mediaHint = q.hasMedia ? " · com mídia" : "";
        return `
      <button type="button" class="q-card" data-short="${esc(q.shortId)}">
        <div class="id">#${esc(q.shortId)}</div>
        <div class="author">Por ${esc(q.creatorName)}</div>
        <div class="preview">${esc(q.statementPreview || "(sem texto)")}</div>
        <div class="meta">${typeLabel}${mediaHint}</div>
      </button>`;
      })
      .join("");

    els.questionsGrid.querySelectorAll(".q-card").forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.dataset.short));
    });
  }

  function jidKey(jid) {
    const raw = String(jid || "")
      .trim()
      .toLowerCase();
    const at = raw.indexOf("@");
    if (at < 0) return raw;
    return `${raw.slice(0, at).split(":")[0]}@${raw.slice(at + 1)}`;
  }

  function looksLikeRawParticipantName(s) {
    const t = String(s || "").trim();
    if (!t) return true;
    if (/^participante$/i.test(t)) return true;
    if (/^caderno:/i.test(t)) return true;
    if (/^\d{8,}$/.test(t) || /^\+?\d{8,20}$/.test(t)) return true;
    if (t.includes("@")) return true;
    return false;
  }

  function normalizePersonName(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  function participantIdentityKey(p) {
    const name = String(p.userName || "").trim();
    if (!looksLikeRawParticipantName(name)) return `name:${normalizePersonName(name)}`;
    return `jid:${jidKey(p.userJid || p.userJidKey)}`;
  }

  function uniqueParticipantsFromAnswers(answers) {
    const m = new Map();
    for (const a of answers) {
      if (!m.has(a.userJid)) m.set(a.userJid, { userJid: a.userJid, userName: a.userName });
    }
    return Array.from(m.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName, "pt-BR")
    );
  }

  function mergedParticipants() {
    const parts =
      reportData && reportData.participants && reportData.participants.length
        ? reportData.participants
        : uniqueParticipantsFromAnswers((reportData && reportData.answers) || []);
    const byKey = new Map();
    for (const p of parts) {
      const key = participantIdentityKey(p);
      const cur = byKey.get(key);
      if (!cur) {
        byKey.set(key, {
          userJid: p.userJid,
          userName: p.userName,
          aliasJids: [p.userJid]
        });
        continue;
      }
      if (!cur.aliasJids.includes(p.userJid)) cur.aliasJids.push(p.userJid);
      if (looksLikeRawParticipantName(cur.userName) && !looksLikeRawParticipantName(p.userName)) {
        cur.userName = p.userName;
        cur.userJid = p.userJid;
      }
    }
    if (reportData && reportData.answers) {
      for (const a of reportData.answers) {
        if (looksLikeRawParticipantName(a.userName)) continue;
        const key = `name:${normalizePersonName(a.userName)}`;
        const cur = byKey.get(key);
        if (!cur) continue;
        if (!cur.aliasJids.includes(a.userJid)) cur.aliasJids.push(a.userJid);
      }
    }
    return Array.from(byKey.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName, "pt-BR")
    );
  }

  function aliasKeysForScope(scopeJid) {
    const keys = new Set([jidKey(scopeJid)]);
    const hit = mergedParticipants().find(
      (p) =>
        p.userJid === scopeJid ||
        (p.aliasJids || []).some((j) => j === scopeJid || jidKey(j) === jidKey(scopeJid))
    );
    if (hit) {
      for (const j of hit.aliasJids || []) keys.add(jidKey(j));
    }
    const name = nomeParticipante(scopeJid);
    if (!looksLikeRawParticipantName(name)) {
      const nn = normalizePersonName(name);
      for (const a of (reportData && reportData.answers) || []) {
        if (normalizePersonName(a.userName) === nn) keys.add(jidKey(a.userJid));
      }
    }
    return keys;
  }

  function answerBelongsToScope(answer, scopeJid) {
    if (!scopeJid || scopeJid === "__all__") return true;
    return aliasKeysForScope(scopeJid).has(jidKey(answer.userJid || answer.userJidKey));
  }

  function pickAnswerForScope(answersHere, scopeJid) {
    const hits = (answersHere || []).filter((a) => answerBelongsToScope(a, scopeJid));
    if (!hits.length) return null;
    if (hits.length === 1) return hits[0];
    const withComment = hits.find((a) => a.answerComment);
    const base = withComment || hits[0];
    const catMap = new Map();
    for (const h of hits) {
      for (const c of h.categories || []) catMap.set(Number(c.id), c);
    }
    return { ...base, categories: [...catMap.values()] };
  }

  function userAnswerFor(shortId, userJid) {
    if (!reportData || !reportData.answers) return null;
    const here = reportData.answers.filter((a) => a.questionShortId === shortId);
    return pickAnswerForScope(here, userJid);
  }

  function categoriesForScope(scopeJid) {
    const byUser = (reportData && reportData.categoriesByUser) || {};
    const hit = mergedParticipants().find(
      (p) =>
        p.userJid === scopeJid ||
        (p.aliasJids || []).some((j) => j === scopeJid || jidKey(j) === jidKey(scopeJid))
    );
    const jids = hit ? hit.aliasJids : [scopeJid];
    const map = new Map();
    for (const j of jids) {
      for (const c of byUser[j] || []) map.set(Number(c.id), c);
    }
    return Array.from(map.values());
  }

  function questionPasses(shortId) {
    if (!reportData || !els.filterPerson || els.filterPerson.value === "__all__") return true;
    const person = els.filterPerson.value;
    const ua = userAnswerFor(shortId, person);
    const outcome = els.filterOutcome.value;
    if (outcome === "all") return true;
    if (outcome === "correct") return Boolean(ua && ua.correct);
    if (outcome === "wrong") return Boolean(ua && !ua.correct);
    if (outcome === "unanswered") return !ua;
    return true;
  }

  function applyFiltersAndRender() {
    const filtered = (questionsList || []).filter((q) => questionPasses(q.shortId));
    const hasMore = filtered.length > QUESTIONS_PREVIEW_LIMIT;
    const visible =
      questionsShowAll || !hasMore ? filtered : filtered.slice(0, QUESTIONS_PREVIEW_LIMIT);
    renderQuestions(visible);

    if (els.questionsMoreWrap && els.btnQuestionsMore) {
      if (hasMore) {
        els.questionsMoreWrap.classList.remove("hidden");
        els.btnQuestionsMore.textContent = questionsShowAll
          ? "Mostrar menos"
          : `Mostrar todas (${filtered.length})`;
      } else {
        els.questionsMoreWrap.classList.add("hidden");
      }
    }

    if (els.filtersHint) {
      if (!reportData || !questionsList.length) {
        els.filtersHint.textContent = "";
      } else if (els.filterPerson.value === "__all__") {
        els.filtersHint.textContent = questionsShowAll || !hasMore
          ? `${questionsList.length} questão(ões) no grupo.`
          : `Mostrando as ${QUESTIONS_PREVIEW_LIMIT} mais recentes de ${questionsList.length}.`;
      } else {
        els.filtersHint.textContent = questionsShowAll || !hasMore
          ? `Mostrando ${filtered.length} de ${questionsList.length} com os filtros atuais.`
          : `Mostrando ${visible.length} de ${filtered.length} com os filtros atuais.`;
      }
    }
  }

  function updateOutcomeOptions() {
    if (!els.filterOutcome || !els.filterPerson) return;
    const person = els.filterPerson.value;
    if (person === "__all__") {
      els.filterOutcome.innerHTML = '<option value="all">Todas as questões</option>';
      els.filterOutcome.disabled = true;
    } else {
      els.filterOutcome.disabled = false;
      els.filterOutcome.innerHTML = `
        <option value="all">Todas</option>
        <option value="correct">Só acertos</option>
        <option value="wrong">Só erros</option>
        <option value="unanswered">Sem resposta (esta pessoa)</option>`;
    }
  }

  function populateFilters() {
    if (!els.filterPerson || !els.questionsFilters) return;
    if (!reportData || !reportData.questions || !reportData.questions.length) {
      els.questionsFilters.classList.add("hidden");
      return;
    }
    els.questionsFilters.classList.remove("hidden");
    const parts = mergedParticipants();

    els.filterPerson.innerHTML =
      '<option value="__all__">Todos</option>' +
      parts
        .map(
          (p) =>
            `<option value="${escAttr(p.userJid)}">${esc(p.userName)}</option>`
        )
        .join("");

    updateOutcomeOptions();
  }

  function populateReportSelect() {
    if (!els.reportPerson) return;
    if (!reportData || !(reportData.questions && reportData.questions.length)) {
      els.reportPerson.innerHTML = '<option value="">— Sem dados —</option>';
      if (els.reportCaderno) {
        els.reportCaderno.innerHTML = '<option value="__all__">Todos</option>';
      }
      return;
    }
    const parts = mergedParticipants();

    els.reportPerson.innerHTML =
      '<option value="__all__">Todos (tabela consolidada)</option>' +
      parts
        .map(
          (p) =>
            `<option value="${escAttr(p.userJid)}">${esc(p.userName)}</option>`
        )
        .join("");

    if (els.reportCaderno) {
      const byCaderno = new Map();
      for (const q of reportData.questions) {
        if (q.cadernoId != null) {
          const id = Number(q.cadernoId);
          if (!byCaderno.has(id)) {
            byCaderno.set(id, q.cadernoName || `Caderno #${id}`);
          }
        }
      }
      const opts = ['<option value="__all__">Todos</option>', '<option value="__manual__">Manuais / sem caderno</option>'];
      for (const [id, name] of [...byCaderno.entries()].sort((a, b) => a[0] - b[0])) {
        opts.push(`<option value="${id}">${esc(name)} (#${id})</option>`);
      }
      els.reportCaderno.innerHTML = opts.join("");
    }
  }

  async function populatePracticeUserSelect() {
    if (!els.practiceUserSelect) return;
    const saved = localStorage.getItem(STORAGE_USER) || "";
    els.practiceUserSelect.innerHTML = '<option value="">— Selecione —</option>';
    try {
      const res = await fetch(`${API.economy}?view=members`);
      const data = await res.json();
      const members = data.members || [];
      practiceMembersCache = members
        .map((m) => ({
          userJid: m.userJid || m.jid || m.user_jid || "",
          userName:
            m.displayLabel ||
            m.displayName ||
            m.quizDisplayName ||
            m.userLabel ||
            m.name ||
            "Participante"
        }))
        .filter((m) => m.userJid);
      for (const m of practiceMembersCache) {
        const opt = document.createElement("option");
        opt.value = m.userJid;
        opt.textContent = m.userName;
        if (m.userJid === saved) opt.selected = true;
        els.practiceUserSelect.appendChild(opt);
      }
    } catch {
      /* ignore */
    }
  }

  function getPracticeUserJid() {
    return els.practiceUserSelect ? String(els.practiceUserSelect.value || "").trim() : "";
  }

  function getPracticeUserName() {
    const jid = getPracticeUserJid();
    if (!jid || !els.practiceUserSelect) return "";
    const opt = els.practiceUserSelect.selectedOptions[0];
    return opt ? String(opt.textContent || "").trim() : "";
  }

  function getNavigableShortIds() {
    return (questionsList || [])
      .filter((q) => questionPasses(q.shortId))
      .map((q) => String(q.shortId).toUpperCase());
  }

  function navigateModal(delta) {
    const ids = getNavigableShortIds();
    if (!ids.length || !currentShortId) return;
    const cur = String(currentShortId).toUpperCase();
    const idx = ids.indexOf(cur);
    if (idx < 0) {
      openModal(ids[0]);
      return;
    }
    const next = ids[idx + delta];
    if (next) openModal(next);
  }

  function questionPassesGeneralFilters(q, scopeJid) {
    if (els.reportCaderno) {
      const cVal = els.reportCaderno.value;
      if (cVal === "__manual__") {
        if (q.cadernoId != null) return false;
      } else if (cVal && cVal !== "__all__") {
        if (Number(q.cadernoId) !== Number(cVal)) return false;
      }
    }

    if (!questionPassesDateFilter(q, scopeJid)) return false;

    const sidNum = /^\d+$/.test(String(q.shortId || "")) ? Number(q.shortId) : null;
    if (els.reportQidFrom && els.reportQidFrom.value.trim()) {
      const fromRaw = els.reportQidFrom.value.trim().toUpperCase();
      if (/^\d+$/.test(fromRaw) && sidNum != null) {
        if (sidNum < Number(fromRaw)) return false;
      } else if (String(q.shortId || "").toUpperCase() < fromRaw) {
        return false;
      }
    }
    if (els.reportQidTo && els.reportQidTo.value.trim()) {
      const toRaw = els.reportQidTo.value.trim().toUpperCase();
      if (/^\d+$/.test(toRaw) && sidNum != null) {
        if (sidNum > Number(toRaw)) return false;
      } else if (String(q.shortId || "").toUpperCase() > toRaw) {
        return false;
      }
    }
    return true;
  }

  const REPORT_TZ = "America/Sao_Paulo";

  function civilDayIso(value) {
    if (value == null || value === "") return "";
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
    }
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: REPORT_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(d);
      const y = parts.find((p) => p.type === "year")?.value;
      const m = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;
      if (y && m && day) return `${y}-${m}-${day}`;
    } catch {
      /* ignore */
    }
    return raw.slice(0, 10);
  }

  function questionDaysForReport(q, scopeJid) {
    const days = new Set();
    const pub = q.publishedDay || civilDayIso(q.createdAt);
    if (pub) days.add(pub);
    const answers = (reportData && reportData.answers) || [];
    const sid = String(q.shortId || "").toUpperCase();
    for (const a of answers) {
      if (String(a.questionShortId || "").toUpperCase() !== sid) continue;
      if (scopeJid && scopeJid !== "__all__" && !answerBelongsToScope(a, scopeJid)) continue;
      const ad = a.answeredDay || civilDayIso(a.answeredAt || a.createdAt || a.sentAt);
      if (ad) days.add(ad);
    }
    return days;
  }

  function questionPassesDateFilter(q, scopeJid) {
    const from = els.reportDateFrom && els.reportDateFrom.value;
    const to = els.reportDateTo && els.reportDateTo.value;
    if (!from && !to) return true;
    const days = questionDaysForReport(q, scopeJid);
    if (!days.size) return true;
    for (const day of days) {
      if (from && day < from) continue;
      if (to && day > to) continue;
      return true;
    }
    return false;
  }

  function answerMatchesCategoryRule(ua, ruleKey) {
    const cats = (ua && Array.isArray(ua.categories) ? ua.categories : []) || [];
    if (ruleKey === "__all__") return true;
    if (ruleKey === "__none__") return cats.length === 0;
    const id = Number(ruleKey);
    if (!Number.isFinite(id)) return false;
    return cats.some((c) => Number(c.id) === id);
  }

  function questionPassesOutcome(q, scopeJid) {
    const outcome = els.reportOutcome ? els.reportOutcome.value : "all";
    if (outcome === "all" || !scopeJid || scopeJid === "__all__") return true;
    const ua = userAnswerFor(q.shortId, scopeJid);
    if (outcome === "correct") return Boolean(ua && ua.correct);
    if (outcome === "wrong") return Boolean(ua && !ua.correct);
    if (outcome === "unanswered") return !ua;
    return true;
  }

  function selectQuestionsForReport(qsAll, scopeJid) {
    const general = qsAll.filter((q) => questionPassesGeneralFilters(q, scopeJid));
    const filters = reportCategoryRules.filter((r) => r.mode === "filter");
    const incrementals = reportCategoryRules.filter((r) => r.mode === "incremental");

    const base = general.filter((q) => {
      if (!questionPassesOutcome(q, scopeJid)) return false;
      if (!filters.length) return true;
      if (!scopeJid || scopeJid === "__all__") return true;
      const ua = userAnswerFor(q.shortId, scopeJid);
      for (const rule of filters) {
        if (rule.key === "__all__") continue;
        if (!answerMatchesCategoryRule(ua, rule.key)) return false;
      }
      return true;
    });

    const byId = new Map(base.map((q) => [String(q.shortId).toUpperCase(), q]));

    if (scopeJid && scopeJid !== "__all__") {
      for (const rule of incrementals) {
        for (const q of general) {
          const sid = String(q.shortId).toUpperCase();
          if (byId.has(sid)) continue;
          const ua = userAnswerFor(sid, scopeJid);
          if (!ua) continue;
          if (answerMatchesCategoryRule(ua, rule.key)) {
            byId.set(sid, q);
          }
        }
      }
    }

    return Array.from(byId.values());
  }

  function questionPassesReportFilters(q, scopeJid) {
    return selectQuestionsForReport([q], scopeJid).length > 0;
  }

  function collectReportCategoryRulesFromDom() {
    reportCategoryRules = [];
    if (!els.reportCatRulesList) return;
    els.reportCatRulesList.querySelectorAll(".report-cat-rule").forEach((row) => {
      const catSel = row.querySelector(".report-cat-key");
      const modeSel = row.querySelector(".report-cat-mode");
      if (!catSel || !modeSel) return;
      const key = String(catSel.value || "");
      const mode = modeSel.value === "incremental" ? "incremental" : "filter";
      if (!key) return;
      reportCategoryRules.push({ key, mode });
    });
  }

  function categoryOptionsHtml(selectedKey) {
    const scopeJid = els.reportPerson ? els.reportPerson.value : "";
    const catalog =
      scopeJid && scopeJid !== "__all__" ? categoriesForScope(scopeJid) : [];
    const opts = [
      `<option value="__all__">Todas</option>`,
      `<option value="__none__">Sem categorias</option>`,
      ...catalog.map(
        (c) => `<option value="${esc(String(c.id))}">${esc(c.name)}</option>`
      )
    ];
    const html = opts.join("");
    // re-select after build
    return { html, selectedKey: selectedKey || "__all__" };
  }

  function renderReportCategoryRules() {
    if (!els.reportCatRulesList) return;
    if (!reportCategoryRules.length) {
      els.reportCatRulesList.innerHTML =
        '<p class="filters-hint">Nenhuma regra de categoria. O relatório usa só resultado/caderno/data.</p>';
      return;
    }
    els.reportCatRulesList.innerHTML = reportCategoryRules
      .map((rule, idx) => {
        const { html } = categoryOptionsHtml(rule.key);
        return `
        <div class="report-cat-rule" data-idx="${idx}">
          <select class="report-cat-key" aria-label="Categoria">${html}</select>
          <select class="report-cat-mode" aria-label="Modo">
            <option value="filter">Filtro (AND)</option>
            <option value="incremental">Incremental (OR)</option>
          </select>
          <button type="button" class="btn-remove-rule" data-idx="${idx}" aria-label="Remover">×</button>
        </div>`;
      })
      .join("");

    els.reportCatRulesList.querySelectorAll(".report-cat-rule").forEach((row) => {
      const idx = Number(row.dataset.idx);
      const rule = reportCategoryRules[idx];
      if (!rule) return;
      const catSel = row.querySelector(".report-cat-key");
      const modeSel = row.querySelector(".report-cat-mode");
      if (catSel) catSel.value = rule.key;
      if (modeSel) modeSel.value = rule.mode;
      if (catSel) {
        catSel.addEventListener("change", () => {
          rule.key = catSel.value;
        });
      }
      if (modeSel) {
        modeSel.addEventListener("change", () => {
          rule.mode = modeSel.value === "incremental" ? "incremental" : "filter";
        });
      }
    });
    els.reportCatRulesList.querySelectorAll(".btn-remove-rule").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        reportCategoryRules.splice(idx, 1);
        renderReportCategoryRules();
      });
    });
  }

  function resetModal() {
    els.modalFeedback.classList.add("hidden");
    els.modalFeedback.classList.remove("ok", "bad");
    els.modalRevealBox.classList.add("hidden");
    els.modalRevealBtn.classList.add("hidden");
    els.modalCommentMedia.innerHTML = "";
    submitPayload = null;
    els.modalChoices.innerHTML = "";
    modalUserCategories = [];
    modalSelectedCategoryIds = new Set();
    modalHasAnswer = false;
    if (els.modalCategories) els.modalCategories.classList.add("hidden");
    if (els.modalSaveCats) els.modalSaveCats.classList.add("hidden");
    if (els.modalCategoriesToggles) els.modalCategoriesToggles.innerHTML = "";
    if (els.modalCategoriesHint) els.modalCategoriesHint.textContent = "";
  }

  function renderModalCategoryToggles() {
    if (!els.modalCategoriesToggles) return;
    if (!modalUserCategories.length) {
      els.modalCategoriesToggles.innerHTML =
        '<p class="filters-hint">Nenhuma categoria ainda. Crie uma com “Nova categoria”.</p>';
      return;
    }
    els.modalCategoriesToggles.innerHTML = modalUserCategories
      .map((c) => {
        const on = modalSelectedCategoryIds.has(Number(c.id));
        return `<button type="button" class="cat-toggle ${on ? "is-on" : ""}" data-id="${esc(
          String(c.id)
        )}">${esc(c.name)}</button>`;
      })
      .join("");
    els.modalCategoriesToggles.querySelectorAll(".cat-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        if (modalSelectedCategoryIds.has(id)) modalSelectedCategoryIds.delete(id);
        else modalSelectedCategoryIds.add(id);
        btn.classList.toggle("is-on");
        if (els.modalSaveCats && modalHasAnswer) els.modalSaveCats.classList.remove("hidden");
      });
    });
  }

  function showCategoriesPanel(hint) {
    if (!els.modalCategories) return;
    els.modalCategories.classList.remove("hidden");
    if (els.modalCategoriesHint) els.modalCategoriesHint.textContent = hint || "";
    renderModalCategoryToggles();
  }

  function practiceCacheKey(shortId, userJid) {
    return `${String(shortId || "").toUpperCase()}|${userJid || ""}`;
  }

  function paintModalQuestion(q, userJid) {
    els.modalTitle.textContent = `Questão #${q.shortId}`;
    els.modalAuthor.textContent = `Por ${q.creatorName}`;

    let html = "";
    if (q.statementText) html += `<div class="statement-text">${esc(q.statementText)}</div>`;

    if (q.statementMediaUrl && q.statementMediaMimeType) {
      if (q.statementMediaMimeType.startsWith("image/")) {
        html += `<img src="${esc(q.statementMediaUrl)}" alt="Enunciado" crossorigin="anonymous" />`;
      } else {
        html += `<p><a href="${esc(q.statementMediaUrl)}" target="_blank" rel="noopener">Abrir documento (PDF/arquivo)</a></p>`;
      }
    }
    els.modalStatement.innerHTML = html || "<p>(Sem enunciado)</p>";

    const isTf = q.questionType === "true_false";
    els.modalChoices.classList.toggle("tf", isTf);

    modalUserCategories = Array.isArray(q.userCategories) ? q.userCategories : [];
    modalSelectedCategoryIds = new Set(
      (q.categories || []).map((c) => Number(c.id)).filter((n) => Number.isFinite(n))
    );

    const existingLetter = q.existingAnswer
      ? String(q.existingAnswer.letter || "").toLowerCase()
      : "";
    modalHasAnswer = Boolean(q.existingAnswer);

    if (isTf) {
      els.modalChoices.innerHTML = `
            <button type="button" class="btn-choice" data-letter="c">C — Certo</button>
            <button type="button" class="btn-choice" data-letter="e">E — Errado</button>`;
    } else {
      els.modalChoices.innerHTML = ["A", "B", "C", "D", "E"]
        .map(
          (L) =>
            `<button type="button" class="btn-choice" data-letter="${L.toLowerCase()}">${L}</button>`
        )
        .join("");
    }
    els.modalChoices.querySelectorAll(".btn-choice").forEach((b) => {
      if (existingLetter && b.dataset.letter === existingLetter) b.classList.add("selected");
      b.addEventListener("click", () => onAnswer(b.dataset.letter));
    });

    if (!userJid) {
      showCategoriesPanel(
        modalHasAnswer
          ? "Selecione “Quem sou eu” para editar categorias."
          : 'Selecione “Quem sou eu” acima para salvar resposta e categorias.'
      );
    } else if (modalHasAnswer) {
      showCategoriesPanel("Resposta já registrada — clique outra letra para alterar, ou ajuste as categorias.");
      if (els.modalSaveCats) els.modalSaveCats.classList.remove("hidden");
    } else {
      showCategoriesPanel("Marque categorias (opcional) e responda. A resposta será salva.");
    }
  }

  function prefetchPracticeNeighbors(shortId, userJid) {
    const ids = getNavigableShortIds();
    const cur = String(shortId).toUpperCase();
    const idx = ids.indexOf(cur);
    if (idx < 0) return;
    [ids[idx + 1], ids[idx - 1]].filter(Boolean).forEach((sid) => {
      const key = practiceCacheKey(sid, userJid);
      if (practiceDetailCache.has(key)) return;
      void fetchJson(API.detail(sid, userJid || undefined))
        .then((q) => {
          practiceDetailCache.set(key, q);
        })
        .catch(() => {});
    });
  }

  async function openModal(shortId) {
    const gen = ++modalOpenGen;
    currentShortId = shortId;
    resetModal();
    els.modal.classList.add("open");
    els.modal.setAttribute("aria-hidden", "false");

    const userJid = getPracticeUserJid();
    const key = practiceCacheKey(shortId, userJid);
    const cached = practiceDetailCache.get(key);
    if (cached) paintModalQuestion(cached, userJid);
    else els.modalStatement.innerHTML = '<p class="loading">Carregando…</p>';

    try {
      const q = await fetchJson(API.detail(shortId, userJid || undefined));
      if (gen !== modalOpenGen) return;
      practiceDetailCache.set(key, q);
      paintModalQuestion(q, userJid);
      prefetchPracticeNeighbors(shortId, userJid);
    } catch (e) {
      if (gen !== modalOpenGen) return;
      if (!cached) {
        els.modalStatement.innerHTML = `<p class="error-banner">${esc(e.message)}</p>`;
      }
    }
  }

  function closeModal() {
    els.modal.classList.remove("open");
    els.modal.setAttribute("aria-hidden", "true");
    currentShortId = null;
  }

  function rememberPracticeAnswer(shortId, letter, userJid, data) {
    const key = practiceCacheKey(shortId, userJid);
    const cached = practiceDetailCache.get(key);
    if (cached) {
      cached.existingAnswer = {
        letter: String((data && data.yourAnswer) || letter).toLowerCase()
      };
      if (Array.isArray(data && data.categories)) cached.categories = data.categories;
    }
    if (!reportData || !userJid || !(data && data.persisted)) return;
    const sid = String(shortId).toUpperCase();
    const existing = (reportData.answers || []).find(
      (a) => a.questionShortId === sid && a.userJid === userJid
    );
    const cats = (data && data.categories) || [];
    if (existing) {
      existing.answerLetter = String(letter).toLowerCase();
      existing.answerLetterDisplay = String((data && data.yourAnswer) || letter).toUpperCase();
      if (data && data.correct != null) existing.correct = Boolean(data.correct);
      existing.categories = cats;
    } else {
      reportData.answers = reportData.answers || [];
      reportData.answers.push({
        questionShortId: sid,
        userJid,
        userName: getPracticeUserName(),
        answerLetter: String(letter).toLowerCase(),
        answerLetterDisplay: String((data && data.yourAnswer) || letter).toUpperCase(),
        correct: Boolean(data && data.correct),
        categories: cats
      });
    }
  }

  function onAnswer(letter) {
    if (!currentShortId) return;
    const shortId = currentShortId;
    const userJid = getPracticeUserJid();
    const body = { shortId, letter };
    if (userJid) {
      body.userJid = userJid;
      body.userName = getPracticeUserName();
      body.categoryIds = Array.from(modalSelectedCategoryIds);
    }

    rememberPracticeAnswer(shortId, letter, userJid, { persisted: Boolean(userJid), yourAnswer: letter });
    navigateModal(1);

    void fetchJson(API.submit, {
      method: "POST",
      body: JSON.stringify(body)
    })
      .then((data) => {
        submitPayload = data;
        rememberPracticeAnswer(shortId, letter, userJid, data);
      })
      .catch((e) => {
        if (String(currentShortId || "").toUpperCase() !== String(shortId).toUpperCase()) return;
        els.modalFeedback.classList.remove("hidden");
        els.modalFeedback.classList.add("bad");
        els.modalFeedback.textContent = e.message || "Erro ao enviar.";
        els.modalChoices.querySelectorAll(".btn-choice").forEach((b) => {
          b.disabled = false;
        });
      });
  }

  async function saveModalCategories() {
    const userJid = getPracticeUserJid();
    if (!userJid || !currentShortId) {
      if (els.modalCategoriesHint) {
        els.modalCategoriesHint.textContent = 'Selecione “Quem sou eu” para salvar.';
      }
      return;
    }
    try {
      const data = await fetchJson(API.answerCategories, {
        method: "POST",
        body: JSON.stringify({
          userJid,
          shortId: currentShortId,
          categoryIds: Array.from(modalSelectedCategoryIds)
        })
      });
      modalSelectedCategoryIds = new Set((data.categories || []).map((c) => Number(c.id)));
      renderModalCategoryToggles();
      if (els.modalSaveCats) els.modalSaveCats.classList.add("hidden");
      if (els.modalCategoriesHint) els.modalCategoriesHint.textContent = "Categorias atualizadas.";
      if (reportData) {
        const shortId = String(currentShortId).toUpperCase();
        const existing = (reportData.answers || []).find(
          (a) => a.questionShortId === shortId && a.userJid === userJid
        );
        if (existing) existing.categories = data.categories || [];
      }
    } catch (e) {
      if (els.modalCategoriesHint) els.modalCategoriesHint.textContent = e.message || "Erro ao salvar.";
    }
  }

  function openNewCatModal() {
    if (!els.newcatOverlay) return;
    if (!getPracticeUserJid()) {
      if (els.modalCategoriesHint) {
        els.modalCategoriesHint.textContent = 'Selecione “Quem sou eu” antes de criar categoria.';
      }
      return;
    }
    if (els.newcatName) els.newcatName.value = "";
    if (els.newcatStatus) els.newcatStatus.textContent = "";
    els.newcatOverlay.classList.add("open");
    els.newcatOverlay.setAttribute("aria-hidden", "false");
  }

  function closeNewCatModal() {
    if (!els.newcatOverlay) return;
    els.newcatOverlay.classList.remove("open");
    els.newcatOverlay.setAttribute("aria-hidden", "true");
  }

  async function createNewCategoryFromModal() {
    const userJid = getPracticeUserJid();
    const name = els.newcatName ? els.newcatName.value.trim() : "";
    if (!userJid || !name) {
      if (els.newcatStatus) els.newcatStatus.textContent = "Informe o nome.";
      return;
    }
    try {
      const data = await fetchJson(API.userCategories, {
        method: "POST",
        body: JSON.stringify({ userJid, name })
      });
      const cat = data.category;
      if (cat && !modalUserCategories.some((c) => Number(c.id) === Number(cat.id))) {
        modalUserCategories.push(cat);
        modalUserCategories.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      }
      if (cat) modalSelectedCategoryIds.add(Number(cat.id));
      renderModalCategoryToggles();
      if (els.modalSaveCats && modalHasAnswer) els.modalSaveCats.classList.remove("hidden");
      closeNewCatModal();
    } catch (e) {
      if (els.newcatStatus) els.newcatStatus.textContent = e.message || "Erro ao criar.";
    }
  }

  function showReveal() {
    if (!submitPayload) return;
    els.modalRevealBtn.classList.add("hidden");
    els.modalRevealBox.classList.remove("hidden");
    els.modalGabarito.textContent = `Gabarito oficial: ${submitPayload.answerKey}`;
    els.modalComment.textContent = submitPayload.explanationText || "Sem comentário do autor.";

    els.modalCommentMedia.innerHTML = "";
    if (submitPayload.explanationMediaUrl && submitPayload.explanationMediaMimeType) {
      if (submitPayload.explanationMediaMimeType.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = submitPayload.explanationMediaUrl;
        img.alt = "Comentário";
        els.modalCommentMedia.appendChild(img);
      } else {
        const a = document.createElement("a");
        a.href = submitPayload.explanationMediaUrl;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Abrir comentário (arquivo)";
        els.modalCommentMedia.appendChild(a);
      }
    }
  }

  /* ——— Relatório ZIP ——— */

  function mimeToExt(mime) {
    if (!mime) return "bin";
    const m = String(mime).toLowerCase();
    if (m.includes("jpeg") || m === "image/jpg") return "jpg";
    if (m === "image/png") return "png";
    if (m === "image/webp") return "webp";
    if (m === "image/gif") return "gif";
    if (m === "application/pdf") return "pdf";
    return "bin";
  }

  function urlBasename(url) {
    if (!url) return "arquivo";
    try {
      const u = new URL(url);
      const seg = u.pathname.split("/").filter(Boolean).pop() || "arquivo";
      return decodeURIComponent(seg.split("?")[0]);
    } catch {
      return "arquivo";
    }
  }

  function mdCell(t) {
    return String(t ?? "")
      .replace(/\|/g, "\\|")
      .replace(/\r?\n/g, " ");
  }

  function formatGabarito(q) {
    const k = String(q.answerKey || "").toUpperCase().slice(0, 1);
    if (q.questionType === "true_false") {
      return k === "C" ? "C (certo)" : "E (errado)";
    }
    return k;
  }

  function formatMarcada(letterDisplay, q) {
    const L = String(letterDisplay || "").toUpperCase().slice(0, 1);
    if (q.questionType === "true_false") {
      return L === "C" ? "C (certo)" : "E (errado)";
    }
    return L;
  }

  async function fetchBlobMaybe(url) {
    const r = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.blob();
  }

  async function addMediaToZip(zip, folder, logicalName, url, mime, errors) {
    if (!url) return null;
    const ext = mimeToExt(mime);
    const safeName = `${logicalName}.${ext}`;
    const path = `${folder}/${safeName}`;
    try {
      const blob = await fetchBlobMaybe(url);
      zip.file(path, blob);
      return safeName;
    } catch (e) {
      errors.push({ url, path, err: e.message || String(e) });
      return null;
    }
  }

  function slugName(s) {
    const t = String(s || "usuario")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 48);
    return t || "usuario";
  }

  async function ensureJSZip() {
    if (typeof JSZip !== "undefined") return;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-jszip-loader="1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("JSZip não carregou. Recarregue a página.")),
          { once: true }
        );
        return;
      }
      const s = document.createElement("script");
      s.src = "/js/jszip.min.js";
      s.async = true;
      s.dataset.jszipLoader = "1";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("JSZip não carregou. Recarregue a página."));
      document.head.appendChild(s);
    });
    if (typeof JSZip === "undefined") {
      throw new Error("JSZip não carregou. Recarregue a página.");
    }
  }

  function formatBrDate(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso ? String(iso) : "";
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function formatDurationMs(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const sec = Math.round(n / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      return `${h}h ${String(m % 60).padStart(2, "0")}min`;
    }
    if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
    return `${s}s`;
  }

  function formatConfidenceLabel(level) {
    if (level === "chute") return "Chute";
    if (level === "inseguro") return "Inseguro";
    return "Seguro";
  }

  function formatAnsweredAt(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: REPORT_TZ,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(d);
    } catch {
      return String(value);
    }
  }

  function categoryRuleLabel(key, scopeJid) {
    if (key === "__all__") return "Todas";
    if (key === "__none__") return "Sem categorias";
    const id = Number(key);
    const catalog = scopeJid && scopeJid !== "__all__" ? categoriesForScope(scopeJid) : [];
    const hit = catalog.find((c) => Number(c.id) === id);
    return hit ? hit.name : `Categoria #${key}`;
  }

  function describeReportFilters(scopeJid) {
    const lines = ["## Filtros usados", ""];
    const person =
      scopeJid === "__all__"
        ? "Todos os participantes (consolidado)"
        : nomeParticipante(scopeJid);
    lines.push(`- **Participante:** ${mdCell(person)}`);
    const cadOpt = els.reportCaderno && els.reportCaderno.selectedOptions[0];
    lines.push(`- **Caderno:** ${mdCell(cadOpt ? cadOpt.textContent.trim() : "Todos")}`);
    const from = els.reportDateFrom && els.reportDateFrom.value;
    const to = els.reportDateTo && els.reportDateTo.value;
    lines.push(`- **Data de:** ${from ? formatBrDate(from) : "sem filtro"}`);
    lines.push(`- **Data até:** ${to ? formatBrDate(to) : "sem filtro"}`);
    const qFrom = els.reportQidFrom && els.reportQidFrom.value.trim();
    const qTo = els.reportQidTo && els.reportQidTo.value.trim();
    lines.push(`- **Questão de (#):** ${qFrom ? mdCell(qFrom) : "sem filtro"}`);
    lines.push(`- **Questão até (#):** ${qTo ? mdCell(qTo) : "sem filtro"}`);
    const outcomeLabels = {
      all: "Todas",
      correct: "Certas",
      wrong: "Erradas",
      unanswered: "Sem resposta"
    };
    const outcome = els.reportOutcome ? els.reportOutcome.value : "all";
    lines.push(`- **Resultado:** ${outcomeLabels[outcome] || outcome}`);
    if (scopeJid === "__all__" && outcome !== "all") {
      lines.push("- Resultado por acerto/erro só entra quando o relatório é de uma pessoa.");
    }
    if (!reportCategoryRules.length) {
      lines.push("- **Categorias:** nenhuma regra");
    } else {
      lines.push("- **Categorias:**");
      for (const rule of reportCategoryRules) {
        const mode = rule.mode === "incremental" ? "incremental (OR)" : "filtro (AND)";
        lines.push(`  - ${mdCell(categoryRuleLabel(rule.key, scopeJid))} — ${mode}`);
      }
    }
    const withDiscussions = Boolean(
      els.reportIncludeDiscussions && els.reportIncludeDiscussions.checked
    );
    lines.push(`- **Discussões no arquivo:** ${withDiscussions ? "sim" : "não"}`);
    lines.push("");
    return lines;
  }

  async function buildReportZip(scopeJid) {
    await ensureJSZip();

    const qsAll = reportData.questions || [];
    const qs = selectQuestionsForReport(qsAll, scopeJid);
    const qIds = new Set(qs.map((q) => q.shortId));
    const ans = (reportData.answers || []).filter((a) => qIds.has(a.questionShortId));
    if (!qs.length) throw new Error("Nenhuma questão combina com os filtros atuais.");

    const zip = new JSZip();
    const midiasFolder = "midias";
    const errors = [];
    const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

    const lines = [];
    lines.push("# Relatório Papa Vagas — Quiz");
    lines.push("");
    lines.push(`> Gerado em: ${stamp}`);
    lines.push(`> Escopo: ${scopeJid === "__all__" ? "Todos os participantes (consolidado)" : nomeParticipante(scopeJid)}`);
    lines.push(`> Questões neste arquivo: ${qs.length} de ${qsAll.length}`);
    lines.push("");
    lines.push(...describeReportFilters(scopeJid));
    lines.push(
      "Este relatório usa respostas gravadas na tabela `answers` (WhatsApp, omissas/site e app de estudo, quando a identidade foi salva). Comentário da resposta entra em Discussões se não houver o mesmo texto na thread."
    );
    lines.push("");

    if (scopeJid === "__all__") {
      lines.push("## Sumário");
      lines.push("");
      lines.push(`- Questões no relatório: **${qs.length}**`);
      lines.push(`- Registros de resposta: **${ans.length}**`);
      lines.push(`- Participantes distintos: **${new Set(ans.map((a) => participantIdentityKey(a))).size}**`);
      lines.push("");
    } else {
      const mine = ans.filter((a) => answerBelongsToScope(a, scopeJid));
      const byQ = new Map();
      for (const a of mine) {
        if (!byQ.has(a.questionShortId)) byQ.set(a.questionShortId, a);
      }
      const uniqueMine = [...byQ.values()];
      const ok = uniqueMine.filter((a) => a.correct).length;
      const bad = uniqueMine.filter((a) => !a.correct).length;
      lines.push("## Sumário (esta pessoa)");
      lines.push("");
      lines.push(`- Respostas registradas: **${uniqueMine.length}**`);
      lines.push(`- Acertos: **${ok}** · Erros: **${bad}**`);
      lines.push("");
    }

    for (const q of qs) {
      const shortId = q.shortId;
      lines.push(`---`);
      lines.push("");
      lines.push(`## Questão #${shortId}`);
      lines.push("");
      lines.push(
        `- **Tipo:** ${q.questionType === "true_false" ? "Certo / errado" : "Múltipla escolha"}`
      );
      lines.push(`- **Autor:** ${mdCell(q.creatorName)}`);
      if (q.cadernoName) lines.push(`- **Caderno:** ${mdCell(q.cadernoName)} (#${q.cadernoId})`);
      if (q.tecQuestionId) lines.push(`- **TEC id:** ${mdCell(q.tecQuestionId)}`);
      if (q.banca) lines.push(`- **Banca:** ${mdCell(q.banca)}`);
      if (q.subject) lines.push(`- **Matéria:** ${mdCell(q.subject)}`);
      if (q.publishedDay) lines.push(`- **Publicada em:** ${formatBrDate(q.publishedDay)}`);
      if (q.tecUrl) lines.push(`- **URL TEC:** ${q.tecUrl}`);
      lines.push("");

      let stmtMediaName = null;
      if (q.statementText && q.statementText.trim()) {
        lines.push("### Enunciado (texto)");
        lines.push("");
        lines.push(q.statementText.trim());
        lines.push("");
      }

      if (q.statementMediaUrl) {
        stmtMediaName = await addMediaToZip(
          zip,
          midiasFolder,
          `questao_${shortId}_enunciado`,
          q.statementMediaUrl,
          q.statementMediaMimeType,
          errors
        );
        lines.push("### Enunciado (arquivo)");
        lines.push("");
        if (stmtMediaName) {
          lines.push(
            `- **Arquivo no ZIP:** \`midias/${stmtMediaName}\` (${mdCell(q.statementMediaMimeType || "tipo desconhecido")})`
          );
        } else {
          lines.push(
            `- **Referência:** não foi possível copiar o arquivo (CORS ou rede). Nome sugerido: \`${mdCell(urlBasename(q.statementMediaUrl))}\`. URL: ${q.statementMediaUrl}`
          );
        }
        lines.push("");
      }

      lines.push(`- **Gabarito oficial:** ${formatGabarito(q)}`);
      lines.push("");

      if (q.explanationText && String(q.explanationText).trim()) {
        lines.push("### Comentário / resolução (texto)");
        lines.push("");
        lines.push(String(q.explanationText).trim());
        lines.push("");
      }

      let expMediaName = null;
      if (q.explanationMediaUrl) {
        expMediaName = await addMediaToZip(
          zip,
          midiasFolder,
          `questao_${shortId}_comentario`,
          q.explanationMediaUrl,
          q.explanationMediaMimeType,
          errors
        );
        lines.push("### Comentário (arquivo)");
        lines.push("");
        if (expMediaName) {
          lines.push(`- **Arquivo no ZIP:** \`midias/${expMediaName}\``);
        } else {
          lines.push(
            `- **Referência:** download falhou; nome sugerido \`${mdCell(urlBasename(q.explanationMediaUrl))}\`. URL: ${q.explanationMediaUrl}`
          );
        }
        lines.push("");
      }

      const answersHere = ans.filter((a) => a.questionShortId === shortId);

      if (scopeJid === "__all__") {
        lines.push("### Respostas");
        lines.push("");
        lines.push(
          "| Participante | Marcou | Gabarito | Resultado | Confiança | Tempo | Respondida em | Discutir | Comentário | Categorias |"
        );
        lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
        const rowsForTable = mergedParticipants()
          .map((p) => {
            const row = pickAnswerForScope(answersHere, p.userJid);
            return row ? { ...row, userName: p.userName } : null;
          })
          .filter(Boolean)
          .sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
        if (!rowsForTable.length) {
          lines.push("| — | — | — | Nenhuma resposta registrada | — | — | — | — | — | — |");
        } else {
          for (const row of rowsForTable) {
            const commentCell = row.answerComment ? mdCell(row.answerComment) : "—";
            const aiCell = row.answerAiComment ? mdCell(row.answerAiComment) : "";
            const confCell = mdCell(formatConfidenceLabel(row.confidenceLevel));
            const catsCell =
              Array.isArray(row.categories) && row.categories.length
                ? mdCell(row.categories.map((c) => c.name).join(", "))
                : "—";
            lines.push(
              `| ${mdCell(row.userName)} | ${formatMarcada(row.answerLetterDisplay, q)} | ${formatGabarito(q)} | ${row.correct ? "Certo" : "Errado"} | ${confCell} | ${formatDurationMs(row.durationMs)} | ${formatAnsweredAt(row.answeredAt)} | ${row.wantsDiscussion ? "sim" : "não"} | ${commentCell}${aiCell ? ` / IA: ${aiCell}` : ""} | ${catsCell} |`
            );
          }
        }
        lines.push("");
      } else {
        const row = pickAnswerForScope(answersHere, scopeJid);
        lines.push("### Esta pessoa");
        lines.push("");
        if (!row) {
          lines.push("*Sem resposta registrada para esta questão.*");
        } else {
          lines.push(`- **Marcou:** ${formatMarcada(row.answerLetterDisplay, q)}`);
          lines.push(`- **Confiança:** ${formatConfidenceLabel(row.confidenceLevel)}`);
          lines.push(`- **Tempo:** ${formatDurationMs(row.durationMs)}`);
          lines.push(`- **Respondida em:** ${formatAnsweredAt(row.answeredAt)}`);
          lines.push(`- **Discutir no grupo:** ${row.wantsDiscussion ? "sim" : "não"}`);
          if (row.answerComment) {
            lines.push(`- **Comentário:** ${row.answerComment}`);
          }
          if (row.answerAiComment) {
            lines.push(`- **IA:** ${row.answerAiComment}`);
          }
          const catNames =
            Array.isArray(row.categories) && row.categories.length
              ? row.categories.map((c) => c.name).join(", ")
              : "—";
          lines.push(`- **Categorias:** ${catNames}`);
          lines.push(`- **Gabarito:** ${formatGabarito(q)}`);
          lines.push(`- **Resultado:** ${row.correct ? "Certo" : "Errado"}`);
        }
        lines.push("");
      }

      if (els.reportIncludeDiscussions && els.reportIncludeDiscussions.checked) {
        const thread = (reportData.discussions && reportData.discussions[shortId]) || [];
        const seenBodies = new Set(
          thread.map((c) => String(c.body || "").trim().toLowerCase()).filter(Boolean)
        );
        const answerNotes = [];
        for (const a of answersHere) {
          if (scopeJid !== "__all__" && !answerBelongsToScope(a, scopeJid)) continue;
          const body = a.answerComment ? String(a.answerComment).trim() : "";
          if (!body) continue;
          const k = body.toLowerCase();
          if (seenBodies.has(k)) continue;
          seenBodies.add(k);
          answerNotes.push({ authorName: a.userName, body });
        }
        lines.push("### Discussões");
        lines.push("");
        if (!thread.length && !answerNotes.length) {
          lines.push("*Sem discussões registradas para esta questão.*");
          lines.push("");
        } else {
          const byId = new Map(thread.map((c) => [c.id, c]));
          const byParent = new Map();
          for (const c of thread) {
            const key = c.parentId == null ? "root" : String(c.parentId);
            if (!byParent.has(key)) byParent.set(key, []);
            byParent.get(key).push(c);
          }
          function walk(parentKey, depth) {
            const list = byParent.get(parentKey) || [];
            for (const c of list) {
              const indent = "  ".repeat(depth);
              const author = c.authorName || "Participante";
              const parent = c.parentId != null ? byId.get(c.parentId) : null;
              const replyTo = parent
                ? ` _(em resposta a ${mdCell(parent.authorName || "Participante")})_`
                : "";
              lines.push(
                `${indent}- **${mdCell(author)}**${replyTo} [${c.source || "?"}]: ${mdCell(c.body)}`
              );
              walk(String(c.id), depth + 1);
            }
          }
          walk("root", 0);
          for (const n of answerNotes) {
            lines.push(`- **${mdCell(n.authorName)}** [resposta]: ${mdCell(n.body)}`);
          }
          lines.push("");
        }
      }
    }

    if (errors.length) {
      lines.push("---");
      lines.push("");
      lines.push("## Mídias não baixadas");
      lines.push("");
      for (const e of errors) {
        lines.push(`- ${e.url} (${mdCell(e.err)})`);
      }
      lines.push("");
    }

    zip.file("relatorio.md", lines.join("\n"), { binary: false });

    const scopeSlug =
      scopeJid === "__all__" ? "consolidado" : slugName(nomeParticipante(scopeJid));
    const fname = `relatorio-papa-vagas-${scopeSlug}-${stamp.slice(0, 10)}.zip`;

    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function nomeParticipante(jid) {
    const merged = mergedParticipants().find(
      (p) => p.userJid === jid || (p.aliasJids || []).some((x) => x === jid || jidKey(x) === jidKey(jid))
    );
    if (merged) return merged.userName;
    const p = (reportData.participants || []).find(
      (x) => x.userJid === jid || jidKey(x.userJid) === jidKey(jid)
    );
    if (p) return p.userName;
    const a = (reportData.answers || []).find(
      (x) => x.userJid === jid || jidKey(x.userJid) === jidKey(jid)
    );
    return a ? a.userName : jid;
  }

  function openReportModal() {
    populateReportSelect();
    renderReportCategoryRules();
    if (els.reportStatus) els.reportStatus.textContent = "";
    els.reportOverlay.classList.add("open");
    els.reportOverlay.setAttribute("aria-hidden", "false");
  }

  function closeReportModal() {
    els.reportOverlay.classList.remove("open");
    els.reportOverlay.setAttribute("aria-hidden", "true");
  }

  function friendlyPersonLabel(mOrLabel, fallbackJid) {
    const raw =
      typeof mOrLabel === "string"
        ? mOrLabel
        : mOrLabel?.displayLabel || mOrLabel?.userLabel || "";
    const t = String(raw || "").trim();
    if (!t) return "Participante";
    if (/^Caderno:/i.test(t)) return "Participante";
    if (/^\d{8,}$/.test(t) || /^\+?\d{8,20}$/.test(t)) return "Participante";
    if (t.includes("@")) return "Participante";
    return t;
  }

  function formatStatusLabel(status) {
    switch (status) {
      case "active":
        return "Ativo";
      case "inactive":
        return "Inativo";
      case "paused_waiting_decision":
        return "Aguardando decisão";
      case "finished":
        return "Encerrado";
      default:
        return status || "—";
    }
  }

  function formatNextRunPretty(iso, timeZone) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: timeZone || "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(d);
    } catch {
      return iso;
    }
  }

  function pad2(n) {
    return n < 10 ? `0${n}` : String(n);
  }

  function parseTimeInputValue(raw, fallbackH, fallbackM) {
    const t = String(raw || "").trim();
    if (!t.includes(":")) return { hour: fallbackH, minute: fallbackM };
    const [hh, mm] = t.split(":");
    const hour = Number(hh);
    const minute = Number(mm);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return { hour: fallbackH, minute: fallbackM };
    return { hour, minute };
  }

  const MAX_RELEASE_HOUR = 15;

  function clampReleaseTime(hour, minute) {
    let h = Number.isFinite(hour) ? Math.round(hour) : 7;
    let m = Number.isFinite(minute) ? Math.round(minute) : 0;
    if (h < 0) h = 0;
    if (h > MAX_RELEASE_HOUR) h = MAX_RELEASE_HOUR;
    if (m < 0) m = 0;
    if (m > 59) m = 59;
    if (h >= MAX_RELEASE_HOUR) m = 0;
    return { hour: h, minute: m };
  }

  /** Lote do dia: N horários iguais ao horário de liberação. */
  function computeUniformSendTimes(n, startHour, startMinute, endHour, endMinute) {
    void endHour;
    void endMinute;
    const safeN = Math.max(1, Math.min(24, Number(n) || 1));
    const t = clampReleaseTime(startHour, startMinute);
    return Array.from({ length: safeN }, () => ({ hour: t.hour, minute: t.minute }));
  }

  function formatSendTimesForDisplay(times) {
    if (!times || !times.length) return "";
    return times.map((t) => `${pad2(t.hour)}:${pad2(t.minute)}`).join(", ");
  }

  function renderSendTimesList(container, count, times, labelPrefix) {
    if (!container) return;
    const n = Math.max(1, Math.min(24, Number(count) || 1));
    const existing = Array.isArray(times) ? times : [];
    const labels = [];
    for (let i = 0; i < n; i++) {
      const slot = existing[i] || { hour: 7, minute: 0 };
      const val = `${pad2(slot.hour)}:${pad2(slot.minute)}`;
      labels.push(
        `<label><span>${labelPrefix || "Questão"} ${i + 1}</span><input type="time" class="caderno-slot-time" value="${escAttr(
          val
        )}" /></label>`
      );
    }
    container.innerHTML = labels.join("");
  }

  function collectSendTimesFromList(container) {
    if (!container) return [];
    const out = [];
    container.querySelectorAll(".caderno-slot-time").forEach((inp) => {
      const raw = inp.value?.trim() ?? "";
      const { hour, minute } = parseTimeInputValue(raw, 0, 0);
      out.push({ hour, minute });
    });
    return out;
  }

  function validateSendTimesAscending(times) {
    if (!times || !times.length) return "Informe pelo menos um horário.";
    let prev = -1;
    for (let i = 0; i < times.length; i++) {
      const mins = times[i].hour * 60 + times[i].minute;
      if (mins < prev) {
        return `Horário da questão ${i + 1} deve ser igual ou depois da questão ${i}.`;
      }
      prev = mins;
    }
    return null;
  }

  function readGroupWindowFromEls(startEl, endEl) {
    void endEl;
    const start = parseTimeInputValue(startEl?.value, 7, 0);
    const t = clampReleaseTime(start.hour, start.minute);
    return { ...t, endHour: t.hour, endMinute: t.minute };
  }

  function syncEndHiddenFromStart(startEl, endEl) {
    if (!startEl || !endEl) return;
    const t = clampReleaseTime(
      ...(() => {
        const p = parseTimeInputValue(startEl.value, 7, 0);
        return [p.hour, p.minute];
      })()
    );
    const val = `${pad2(t.hour)}:${pad2(t.minute)}`;
    startEl.value = val;
    endEl.value = val;
  }

  function syncCadernoAddSendTimes(preserve) {
    const n = Number(els.cadernoPerDay?.value || 3);
    const w = readGroupWindowFromEls(els.cadernoTime, els.cadernoEndTime);
    let times = preserve ? collectSendTimesFromList(els.cadernoSendTimesList) : null;
    if (!times || times.length !== n) {
      times = computeUniformSendTimes(n, w.hour, w.minute, w.endHour, w.endMinute);
    }
    renderSendTimesList(els.cadernoSendTimesList, n, times, "Questão");
  }

  function syncCadernoEditSendTimes(preserve) {
    const n = Number(els.cadernoEditPerDay?.value || 3);
    const w = readGroupWindowFromEls(els.cadernoEditTime, els.cadernoEditEndTime);
    let times = preserve ? collectSendTimesFromList(els.cadernoEditSendTimesList) : null;
    if (!times || times.length !== n) {
      times = computeUniformSendTimes(n, w.hour, w.minute, w.endHour, w.endMinute);
    }
    renderSendTimesList(els.cadernoEditSendTimesList, n, times, "Questão");
  }

  function syncPrivateRowSendTimes(li, preserve) {
    if (!li) return;
    const box = li.querySelector(".caderno-priv-send-times");
    if (!box) return;
    const n = Math.max(1, Math.min(24, Number(li.querySelector(".caderno-priv-qpd")?.value || 5)));
    const start = parseTimeInputValue(li.querySelector(".caderno-priv-time")?.value, 7, 0);
    const end = parseTimeInputValue(li.querySelector(".caderno-priv-end-time")?.value, 22, 0);
    let times = preserve ? collectSendTimesFromList(box) : null;
    if (!times || times.length !== n) {
      times = computeUniformSendTimes(n, start.hour, start.minute, end.hour, end.minute);
    }
    renderSendTimesList(box, n, times, "Q");
  }

  function getCadernoAddDeliveryMode() {
    return els.cadernoDeliveryPrivate && els.cadernoDeliveryPrivate.checked ? "private" : "group";
  }

  function syncCadernoAddPrivatePanel() {
    const priv = getCadernoAddDeliveryMode() === "private";
    if (els.cadernoPrivateAddPanel) els.cadernoPrivateAddPanel.classList.toggle("hidden", !priv);
    if (els.cadernoAddEngagementPanel) els.cadernoAddEngagementPanel.classList.toggle("hidden", priv);
    if (els.cadernoAddGroupSchedule) els.cadernoAddGroupSchedule.classList.toggle("hidden", priv);
    const sendWrap = document.getElementById("caderno-send-times-wrap");
    if (sendWrap) sendWrap.classList.toggle("hidden", priv);
  }

  function wizardDotLabels() {
    if (wizardSource === "ia") return ["Origem", "IA", "Markdown", "Básicas", "Avançadas", "Concluir"];
    if (wizardSource === "tec") return ["Origem", "TEC", "PDF", "Básicas", "Avançadas", "Concluir"];
    return ["Origem", "Formato", "Arquivo", "Básicas", "Avançadas", "Concluir"];
  }

  function wizardCaption(step) {
    const labels =
      wizardSource === "ia"
        ? [
            "De onde vêm as questões",
            "Pedir questões para a IA",
            "Colar o Markdown",
            "Configurações básicas",
            "Configurações avançadas",
            "Conferir e salvar"
          ]
        : [
            "De onde vêm as questões",
            "Preparar PDF no TEC",
            "Enviar o PDF",
            "Configurações básicas",
            "Configurações avançadas",
            "Conferir e salvar"
          ];
    return `Passo ${step + 1} de 6 — ${labels[step] || ""}`;
  }

  function paintWizardDots() {
    if (!els.wizardSteps) return;
    const labels = wizardDotLabels();
    els.wizardSteps.innerHTML = labels
      .map((label, n) => {
        const cls = n === wizardStep ? "active" : n < wizardStep ? "done" : "";
        return `<li class="${cls}" data-step-dot="${n}">${esc(label)}</li>`;
      })
      .join("");
  }

  function unwrapMdFence(raw) {
    let text = String(raw || "").replace(/\r\n?/g, "\n").trim();
    const fenced = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
    if (fenced) text = fenced[1].trim();
    return text;
  }

  function pastedIaMarkdown() {
    if (wizardSource !== "ia" || !els.cadernoMd) return "";
    return unwrapMdFence(els.cadernoMd.value);
  }

  function iaMarkdownFile() {
    if (wizardSource !== "ia" || !els.cadernoMdFile || !els.cadernoMdFile.files) return null;
    return els.cadernoMdFile.files[0] || null;
  }

  async function copyWizardText(text, button) {
    const value = String(text || "");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        throw new Error("clipboard");
      }
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    if (!button) return;
    const previous = button.textContent;
    button.textContent = "Copiado";
    window.setTimeout(() => {
      button.textContent = previous;
    }, 1600);
  }

  function setWizardStep(step) {
    wizardStep = Math.max(0, Math.min(5, step));
    document.querySelectorAll("[data-wizard-step]").forEach((panel) => {
      const n = Number(panel.dataset.wizardStep);
      const source = panel.dataset.wizardSource || "";
      const sourceOk = !source || source === wizardSource;
      panel.classList.toggle("active", n === wizardStep && sourceOk);
    });
    paintWizardDots();
    if (els.wizardStepCaption) els.wizardStepCaption.textContent = wizardCaption(wizardStep);
    if (els.wizardPrev) els.wizardPrev.hidden = wizardStep <= 0;
    if (els.wizardNext) {
      els.wizardNext.hidden = wizardStep >= 5;
      if (wizardStep === 1 && wizardSource === "tec") els.wizardNext.textContent = "Entendi, continuar";
      else if (wizardStep === 1 && wizardSource === "ia") els.wizardNext.textContent = "Colar o Markdown";
      else els.wizardNext.textContent = "Continuar";
    }
    if (wizardStep === 3) syncCadernoAddSendTimes(true);
    if (wizardStep === 4) {
      syncCadernoAddPrivatePanel();
      if (
        getCadernoAddDeliveryMode() !== "private" &&
        !cadernoAddEngagementDraft.length &&
        els.btnCadernoAddLoadEngagement
      ) {
        void onCadernoAddLoadEngagement();
      }
    }
    if (wizardStep === 5) renderWizardSummary();
  }

  function validateWizardStep(step) {
    if (step === 0) {
      if (wizardSource !== "tec" && wizardSource !== "ia") {
        if (els.cadernoAddStatus) els.cadernoAddStatus.textContent = "Escolha caderno do TEC ou questões de IA.";
        return false;
      }
    }
    if (step === 2 && wizardSource === "ia") {
      const pasted = pastedIaMarkdown();
      const file = iaMarkdownFile();
      if (!pasted && !file) {
        if (els.cadernoAddStatus)
          els.cadernoAddStatus.textContent = "Cole o Markdown da IA ou envie o arquivo .md.";
        return false;
      }
      if (pasted && !/^##\s+Q\d+/im.test(pasted)) {
        if (els.cadernoAddStatus)
          els.cadernoAddStatus.textContent =
            "Não achei ## Q1, ## Q2… Cole o Markdown no formato do exemplo.";
        return false;
      }
    } else if (step === 2) {
      const file = els.cadernoPdf && els.cadernoPdf.files && els.cadernoPdf.files[0];
      if (!file) {
        if (els.cadernoAddStatus) els.cadernoAddStatus.textContent = "Selecione o PDF do TEC para continuar.";
        return false;
      }
    }
    if (step === 3) {
      const name = ((els.cadernoName && els.cadernoName.value) || "").trim();
      if (!name) {
        if (els.cadernoAddStatus) els.cadernoAddStatus.textContent = "Informe um nome para o caderno.";
        return false;
      }
      if (getCadernoAddDeliveryMode() !== "private") {
        const qpd = Number((els.cadernoPerDay && els.cadernoPerDay.value) || 3);
        const times = collectSendTimesFromList(els.cadernoSendTimesList);
        const timesErr = validateSendTimesAscending(times);
        if (timesErr || !times || times.length !== qpd) {
          if (els.cadernoAddStatus)
            els.cadernoAddStatus.textContent =
              timesErr || `Informe ${qpd} horário(s), um por questão do dia.`;
          return false;
        }
      }
    }
    if (step === 4) {
      if (getCadernoAddDeliveryMode() === "private") {
        const recs = collectAddPrivateRecipients();
        const hasActive = (recs || []).some((r) => r.active !== false && r.userJid);
        if (!hasActive) {
          if (els.cadernoAddStatus)
            els.cadernoAddStatus.textContent =
              "Modo privado: carregue membros e marque ao menos um destinatário.";
          return false;
        }
      } else {
        if (!cadernoAddEngagementDraft.length) {
          if (els.cadernoAddStatus)
            els.cadernoAddStatus.textContent =
              "Carregue os membros do grupo e marque engajados ou passivos.";
          return false;
        }
        const hasRole = cadernoAddEngagementDraft.some((m) => m.engaged || m.passive);
        if (!hasRole) {
          if (els.cadernoAddStatus)
            els.cadernoAddStatus.textContent =
              "Marque ao menos um engajado ou passivo para continuar.";
          return false;
        }
      }
    }
    if (els.cadernoAddStatus) els.cadernoAddStatus.textContent = "";
    return true;
  }

  function renderWizardSummary() {
    if (!els.wizardSummary) return;
    const form = getCadernoFormPayload();
    const mode =
      form.deliveryMode === "private"
        ? "Privado (DM)"
        : "Coletivo (Diário + /omissas)";
    const fileName = form.markdownText
      ? "Markdown colado"
      : form.file && form.file.name
        ? form.file.name
        : "—";
    const engaged = cadernoAddEngagementDraft.filter((m) => m.engaged).length;
    const passive = cadernoAddEngagementDraft.filter((m) => m.passive).length;
    const privCount = (form.privateRecipients || []).filter((r) => r.active !== false).length;
    const times =
      form.schedule.sendTimes && form.schedule.sendTimes.length
        ? formatSendTimesForDisplay(form.schedule.sendTimes)
        : "—";
    els.wizardSummary.innerHTML = `
      <dl>
        <div><dt>Nome</dt><dd>${esc(form.name || "—")}</dd></div>
        <div><dt>Origem</dt><dd>${form.source === "ia" ? "Questões de IA" : "Caderno do TEC"}</dd></div>
        <div><dt>${form.source === "ia" ? "Markdown" : "PDF"}</dt><dd>${esc(fileName)}</dd></div>
        <div><dt>Envio</dt><dd>${esc(mode)}</dd></div>
        <div><dt>Q/dia</dt><dd>${esc(String(form.schedule.questionsPerDay))}</dd></div>
        <div><dt>Horários</dt><dd>${esc(
          form.deliveryMode === "private" ? `${privCount} destinatário(s)` : times
        )}</dd></div>
        <div><dt>Aleatório</dt><dd>${form.schedule.randomOrder ? "Sim" : "Não"}</dd></div>
        <div><dt>Esperar engajados</dt><dd>${form.schedule.waitForAnswers ? "Sim" : "Não"}</dd></div>
        ${
          form.deliveryMode !== "private"
            ? `<div><dt>Engajados / passivos</dt><dd>${engaged} / ${passive}</dd></div>`
            : ""
        }
      </dl>`;
  }

  function renderCadernoAddEngagementList() {
    if (!els.cadernoAddEngagementList) return;
    const members = cadernoAddEngagementDraft;
    if (!members.length) {
      els.cadernoAddEngagementList.innerHTML =
        '<li class="engagement-empty">Clique em “Carregar membros do grupo”.</li>';
      return;
    }
    els.cadernoAddEngagementList.innerHTML = members
      .map(
        (m) => `
      <li class="engagement-row" data-jid="${escAttr(m.userJid)}">
        <label class="engagement-label engagement-role">
          <input type="checkbox" class="caderno-add-eng-cb" ${m.engaged ? "checked" : ""} aria-label="Engajado" />
          <span class="engagement-role-tag">Engajado</span>
        </label>
        <label class="engagement-label engagement-role">
          <input type="checkbox" class="caderno-add-pass-cb" ${m.passive ? "checked" : ""} aria-label="Passivo" />
          <span class="engagement-role-tag">Passivo</span>
        </label>
        <span class="engagement-name" title="${escAttr(m.userJid)}">${esc(friendlyPersonLabel(m))}</span>
      </li>`
      )
      .join("");
  }

  async function onCadernoAddLoadEngagement() {
    if (els.cadernoAddEngagementStatus) els.cadernoAddEngagementStatus.textContent = "Carregando…";
    try {
      await ensureEngagementMembersLoaded();
      cadernoAddEngagementDraft = (engagementMembersCache || []).map((m) => ({
        userJid: m.userJid,
        displayLabel: m.displayLabel,
        userLabel: m.userLabel,
        engaged: false,
        passive: false
      }));
      if (!cadernoAddEngagementDraft.length) {
        if (els.cadernoAddEngagementStatus)
          els.cadernoAddEngagementStatus.textContent =
            "Lista vazia. Rode /sync-membros no grupo do WhatsApp.";
      } else if (els.cadernoAddEngagementStatus) {
        els.cadernoAddEngagementStatus.textContent = `${cadernoAddEngagementDraft.length} participante(s).`;
      }
      renderCadernoAddEngagementList();
    } catch (e) {
      if (els.cadernoAddEngagementStatus)
        els.cadernoAddEngagementStatus.textContent = e.message || "Falha ao carregar.";
    }
  }

  function onCadernoAddEngagementToggle(ev) {
    const cb = ev.target;
    if (!cb.classList) return;
    const isEng = cb.classList.contains("caderno-add-eng-cb");
    const isPass = cb.classList.contains("caderno-add-pass-cb");
    if (!isEng && !isPass) return;
    const row = cb.closest(".engagement-row");
    const jid = row && row.dataset.jid;
    const m = cadernoAddEngagementDraft.find((x) => x.userJid === jid);
    if (!m) return;
    if (isEng) {
      m.engaged = cb.checked;
      if (m.engaged) m.passive = false;
    } else {
      m.passive = cb.checked;
      if (m.passive) m.engaged = false;
    }
    renderCadernoAddEngagementList();
  }

  async function applyPendingEngagementAfterCreate(cadernoId) {
    if (getCadernoAddDeliveryMode() === "private") return;
    const pending = cadernoAddEngagementDraft.filter((m) => m.engaged || m.passive);
    for (const m of pending) {
      try {
        await fetchJson(API.cadernoEngagement(cadernoId), {
          method: "PATCH",
          body: JSON.stringify({
            cadernoId,
            userJid: m.userJid,
            engaged: Boolean(m.engaged),
            passive: Boolean(m.passive)
          })
        });
      } catch {
        /* segue para o próximo */
      }
    }
  }

  function getCadernoEditDeliveryMode() {
    return els.cadernoEditDeliveryPrivate && els.cadernoEditDeliveryPrivate.checked
      ? "private"
      : "group";
  }

  function syncCadernoEditPrivatePanel() {
    const priv = getCadernoEditDeliveryMode() === "private";
    if (els.cadernoEditPrivatePanel) els.cadernoEditPrivatePanel.classList.toggle("hidden", !priv);
    if (els.cadernoEditGroupSchedule) els.cadernoEditGroupSchedule.classList.toggle("hidden", priv);
    if (els.cadernoEditEngagementPanel) els.cadernoEditEngagementPanel.classList.toggle("hidden", priv);
  }

  function renderCadernoEngagementList() {
    if (!els.cadernoEditEngagementList) return;
    const members = cadernoEngagementCache;
    if (!members.length) {
      els.cadernoEditEngagementList.innerHTML =
        '<li class="engagement-empty">Nenhum membro na lista. Clique em "Carregar membros do grupo".</li>';
      return;
    }
    els.cadernoEditEngagementList.innerHTML = members
      .map(
        (m) => `
      <li class="engagement-row" data-jid="${escAttr(m.userJid)}">
        <label class="engagement-label engagement-role">
          <input type="checkbox" class="caderno-engagement-cb" ${m.engaged ? "checked" : ""} aria-label="Engajado neste caderno" />
          <span class="engagement-role-tag">Engajado</span>
        </label>
        <label class="engagement-label engagement-role">
          <input type="checkbox" class="caderno-passive-cb" ${m.passive ? "checked" : ""} aria-label="Passivo neste caderno" />
          <span class="engagement-role-tag">Passivo</span>
        </label>
        <span class="engagement-name" title="${escAttr(m.userJid)}">${esc(friendlyPersonLabel(m))}</span>
      </li>`
      )
      .join("");
  }

  async function loadCadernoEngagementForEdit(cadernoId) {
    if (!els.cadernoEditEngagementStatus) return;
    cadernoEngagementEditId = cadernoId;
    els.cadernoEditEngagementStatus.textContent = "Carregando engajados…";
    cadernoEngagementCache = [];
    renderCadernoEngagementList();
    try {
      const data = await fetchJson(API.cadernoEngagement(cadernoId));
      cadernoEngagementCache = data.members || [];
      if (data.warning) {
        els.cadernoEditEngagementStatus.textContent = data.warning;
      } else if (!cadernoEngagementCache.length) {
        els.cadernoEditEngagementStatus.textContent =
          "Lista vazia. Carregue os membros do grupo (rode /sync-membros no WhatsApp).";
      } else {
        const n = cadernoEngagementCache.filter((x) => x.engaged).length;
        const p = cadernoEngagementCache.filter((x) => x.passive).length;
        els.cadernoEditEngagementStatus.textContent = `${cadernoEngagementCache.length} participante(s), ${n} engajado(s), ${p} passivo(s).`;
      }
      renderCadernoEngagementList();
    } catch (e) {
      els.cadernoEditEngagementStatus.textContent = e.message || "Não foi possível carregar.";
      cadernoEngagementCache = [];
      renderCadernoEngagementList();
    }
  }

  async function onCadernoEditLoadEngagement() {
    const id = Number(els.cadernoEditId && els.cadernoEditId.value);
    if (!Number.isFinite(id) || id <= 0) return;
    try {
      await ensureEngagementMembersLoaded();
    } catch {
      /* segue com API do caderno */
    }
    await loadCadernoEngagementForEdit(id);
  }

  async function onCadernoEngagementToggle(ev) {
    const cb = ev.target;
    if (!cb.classList) return;
    const isEngagedCb = cb.classList.contains("caderno-engagement-cb");
    const isPassiveCb = cb.classList.contains("caderno-passive-cb");
    if (!isEngagedCb && !isPassiveCb) return;
    const cadernoId = cadernoEngagementEditId;
    if (!cadernoId) return;
    const row = cb.closest(".engagement-row");
    const jid = row && row.dataset.jid;
    if (!jid) return;
    const want = cb.checked;
    const body = isEngagedCb
      ? { cadernoId, userJid: jid, engaged: want, passive: want ? false : undefined }
      : { cadernoId, userJid: jid, passive: want, engaged: want ? false : undefined };
    cb.disabled = true;
    try {
      const patchRes = await fetchJson(API.cadernoEngagement(cadernoId), {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      const m = cadernoEngagementCache.find((x) => x.userJid === jid);
      if (m) {
        if (patchRes.member) {
          m.engaged = Boolean(patchRes.member.engaged);
          m.passive = Boolean(patchRes.member.passive);
          if (patchRes.member.displayLabel) m.displayLabel = patchRes.member.displayLabel;
        } else if (isEngagedCb) {
          m.engaged = want;
          if (want) m.passive = false;
        } else {
          m.passive = want;
          if (want) m.engaged = false;
        }
      }
      renderCadernoEngagementList();
      if (
        els.cadernoEditEngagementStatus &&
        !els.cadernoEditEngagementStatus.textContent.startsWith("Carregando")
      ) {
        const engagedN = cadernoEngagementCache.filter((x) => x.engaged).length;
        const passiveN = cadernoEngagementCache.filter((x) => x.passive).length;
        els.cadernoEditEngagementStatus.textContent = `${cadernoEngagementCache.length} participante(s), ${engagedN} engajado(s), ${passiveN} passivo(s).`;
      }
      const card = cadernosCache.find((x) => x.id === cadernoId);
      if (card) {
        card.engagedCount = cadernoEngagementCache.filter((x) => x.engaged).length;
        renderCadernos();
      }
    } catch (err) {
      cb.checked = !want;
      if (els.cadernoEditEngagementStatus) {
        els.cadernoEditEngagementStatus.textContent = err.message || "Erro ao salvar.";
      }
    } finally {
      cb.disabled = false;
    }
  }

  /** Mesma fonte de nomes do modal Engajamento (`/api/engagement`). */
  function resolveDisplayLabelForJid(userJid) {
    const jid = String(userJid || "").trim();
    if (!jid) return "";
    const m = engagementMembersCache.find((x) => x.userJid === jid);
    if (m) return friendlyPersonLabel(m);
    return "Participante";
  }

  async function ensureEngagementMembersLoaded() {
    if (engagementMembersCache.length > 0) return engagementMembersCache;
    const data = await fetchJson(API.engagement);
    engagementMembersCache = data.members || [];
    return engagementMembersCache;
  }

  function findPrivateRecipientLi(ul, userJid) {
    if (!ul) return null;
    const jid = String(userJid || "").trim();
    return [...ul.querySelectorAll("li[data-jid]")].find((li) => li.getAttribute("data-jid") === jid) || null;
  }

  function applyPrivateRecipientDisplayLabel(li, userJid, displayLabel) {
    if (!li) return;
    const jid = String(userJid || "").trim();
    const label = displayLabel || jid;
    const nameEl = li.querySelector(".caderno-priv-name");
    if (nameEl) nameEl.textContent = label;
    const lab = li.querySelector(".caderno-priv-label");
    if (lab) lab.setAttribute("title", jid);
    const meta = li.querySelector(".caderno-priv-meta");
    if (meta) {
      if (label !== jid) {
        meta.textContent = jid;
        meta.classList.remove("hidden");
      } else {
        meta.textContent = "";
        meta.classList.add("hidden");
      }
    }
  }

  function renderPrivateRecipientEditRow(r) {
    const jid = r.userJid || "";
    const label = r.displayLabel || r.userLabel || resolveDisplayLabelForJid(jid) || jid;
    const qpd =
      r.questionsPerDay != null && Number.isFinite(Number(r.questionsPerDay))
        ? String(r.questionsPerDay)
        : "5";
    const sh = r.startHour != null ? Number(r.startHour) : 7;
    const sm = r.startMinute != null ? Number(r.startMinute) : 0;
    const clamped = clampReleaseTime(sh, sm);
    const timeVal = `${pad2(clamped.hour)}:${pad2(clamped.minute)}`;
    const timeEndVal = timeVal;
    const qpdN = Math.max(1, Math.min(24, Number(qpd) || 5));
    const sendTimes = computeUniformSendTimes(qpdN, clamped.hour, clamped.minute, clamped.hour, clamped.minute);
    const slotsHtml = sendTimes
      .slice(0, qpdN)
      .map((slot, i) => {
        const val = `${pad2(slot.hour)}:${pad2(slot.minute)}`;
        return `<label class="hidden" hidden><span>Q${i + 1}</span><input type="time" class="caderno-slot-time" value="${escAttr(
          val
        )}" /></label>`;
      })
      .join("");
    const checked = r.active !== false ? "checked" : "";
    const metaHidden = label === jid ? " hidden" : "";
    return `<li data-jid="${escAttr(jid)}">
      <label class="caderno-priv-label" title="${escAttr(jid)}"><input type="checkbox" class="caderno-priv-active" ${checked} /> <span class="caderno-priv-name">${esc(
      label
    )}</span></label>
      <input class="caderno-priv-qpd" type="number" min="1" max="24" value="${escAttr(qpd)}" title="Questões/dia" />
      <input class="caderno-priv-time" type="time" value="${escAttr(timeVal)}" max="15:00" title="Hora de liberação do dia" />
      <input class="caderno-priv-end-time" type="hidden" value="${escAttr(timeEndVal)}" />
      <div class="caderno-priv-send-times hidden" hidden role="group" aria-label="Horários por questão">${slotsHtml}</div>
      <span class="caderno-priv-meta${metaHidden}">${esc(jid)}</span>
    </li>`;
  }

  function collectPrivateRecipientsFromList(ul) {
    if (!ul) return [];
    const out = [];
    ul.querySelectorAll("li[data-jid]").forEach((li) => {
      const userJid = li.getAttribute("data-jid") || "";
      if (!userJid) return;
      const active = li.querySelector(".caderno-priv-active")?.checked !== false;
      const qRaw = li.querySelector(".caderno-priv-qpd")?.value?.trim() ?? "";
      const tRaw = li.querySelector(".caderno-priv-time")?.value?.trim() ?? "";
      const tEndRaw = li.querySelector(".caderno-priv-end-time")?.value?.trim() ?? "";
      let questionsPerDay = null;
      if (qRaw !== "") {
        const n = Number(qRaw);
        if (Number.isFinite(n)) questionsPerDay = n;
      }
      let startHour = null;
      let startMinute = null;
      if (tRaw && tRaw.includes(":")) {
        const [hh, mm] = tRaw.split(":");
        const h = Number(hh);
        const m = Number(mm);
        if (Number.isFinite(h) && Number.isFinite(m)) {
          const t = clampReleaseTime(h, m);
          startHour = t.hour;
          startMinute = t.minute;
        }
      }
      const endHour = startHour;
      const endMinute = startMinute;
      const nTimes = questionsPerDay != null ? questionsPerDay : 3;
      const sendTimes =
        startHour != null
          ? computeUniformSendTimes(nTimes, startHour, startMinute, endHour, endMinute)
          : collectSendTimesFromList(li.querySelector(".caderno-priv-send-times"));
      void tEndRaw;
      out.push({
        userJid,
        active,
        questionsPerDay,
        sendTimes,
        startHour,
        startMinute,
        endHour,
        endMinute
      });
    });
    return out;
  }

  function collectEditPrivateRecipients() {
    return collectPrivateRecipientsFromList(els.cadernoEditPrivateList);
  }

  function collectAddPrivateRecipients() {
    return collectPrivateRecipientsFromList(els.cadernoAddPrivateList);
  }

  async function onCadernoEditLoadMembers() {
    if (!els.cadernoEditPrivateList || !els.cadernoEditStatus) return;
    els.cadernoEditStatus.textContent = "Carregando membros…";
    try {
      const data = await fetchJson(API.engagement);
      const members = data.members || [];
      engagementMembersCache = members;
      const existing = new Set(
        [...els.cadernoEditPrivateList.querySelectorAll("li[data-jid]")].map(
          (li) => li.getAttribute("data-jid") || ""
        )
      );
      for (const m of members) {
        const jid = m.userJid;
        if (!jid) continue;
        const displayLabel = m.displayLabel || m.userLabel || jid;
        if (existing.has(jid)) {
          const li = findPrivateRecipientLi(els.cadernoEditPrivateList, jid);
          applyPrivateRecipientDisplayLabel(li, jid, displayLabel);
          continue;
        }
        existing.add(jid);
        const row = renderPrivateRecipientEditRow({
          userJid: jid,
          active: true,
          displayLabel
        });
        els.cadernoEditPrivateList.insertAdjacentHTML("beforeend", row);
      }
      els.cadernoEditPrivateList.dataset.touched = "1";
      els.cadernoEditStatus.textContent = members.length
        ? `${members.length} membro(s) no grupo — adicionados os que faltavam na lista.`
        : "Lista vazia. Rode /sync-membros no WhatsApp.";
    } catch (e) {
      els.cadernoEditStatus.textContent = e.message || "Falha ao carregar.";
    }
  }

  function markCadernoEditPrivateRecipientsTouched() {
    if (els.cadernoEditPrivateList) els.cadernoEditPrivateList.dataset.touched = "1";
  }

  async function onCadernoEditDeliveryChange() {
    syncCadernoEditPrivatePanel();
    if (getCadernoEditDeliveryMode() === "private") {
      if (!els.cadernoEditPrivateList) return;
      const has = els.cadernoEditPrivateList.querySelector("li[data-jid]");
      if (!has) await onCadernoEditLoadMembers();
      return;
    }
    const id = Number(els.cadernoEditId && els.cadernoEditId.value);
    if (Number.isFinite(id) && id > 0) {
      await loadCadernoEngagementForEdit(id);
    }
  }

  async function onCadernoAddLoadMembers() {
    if (!els.cadernoAddPrivateList || !els.cadernoAddStatus) return;
    els.cadernoAddStatus.textContent = "Carregando membros…";
    try {
      const data = await fetchJson(API.engagement);
      const members = data.members || [];
      engagementMembersCache = members;
      const existing = new Set(
        [...els.cadernoAddPrivateList.querySelectorAll("li[data-jid]")].map(
          (li) => li.getAttribute("data-jid") || ""
        )
      );
      for (const m of members) {
        const jid = m.userJid;
        if (!jid) continue;
        const displayLabel = m.displayLabel || m.userLabel || jid;
        if (existing.has(jid)) {
          const li = findPrivateRecipientLi(els.cadernoAddPrivateList, jid);
          applyPrivateRecipientDisplayLabel(li, jid, displayLabel);
          continue;
        }
        existing.add(jid);
        const row = renderPrivateRecipientEditRow({
          userJid: jid,
          active: true,
          displayLabel
        });
        els.cadernoAddPrivateList.insertAdjacentHTML("beforeend", row);
      }
      els.cadernoAddStatus.textContent = members.length
        ? `${members.length} membro(s) no grupo — adicionados os que faltavam na lista.`
        : "Lista vazia. Rode /sync-membros no WhatsApp.";
    } catch (e) {
      els.cadernoAddStatus.textContent = e.message || "Falha ao carregar.";
    }
  }

  async function onCadernoAddDeliveryChange() {
    syncCadernoAddPrivatePanel();
    if (getCadernoAddDeliveryMode() !== "private" || !els.cadernoAddPrivateList) return;
    const has = els.cadernoAddPrivateList.querySelector("li[data-jid]");
    if (!has) await onCadernoAddLoadMembers();
  }

  function getCadernoNextIso(c) {
    if (c.deliveryMode === "private" && c.status === "active") {
      const times = (c.privateRecipients || [])
        .filter((r) => r.active && r.nextRunAt)
        .map((r) => new Date(r.nextRunAt).getTime())
        .filter((t) => !Number.isNaN(t));
      if (times.length) return new Date(Math.min(...times)).toISOString();
      return null;
    }
    return c.nextRunAt || null;
  }

  function isCadernoInDefaultView(c) {
    return c.status === "active" || c.status === "paused_waiting_decision";
  }

  function getFilteredCadernos() {
    const q = cadernosUi.search.trim().toLowerCase();
    let list = cadernosCache.slice();
    if (cadernosUi.status === "current" || (cadernosUi.status === "all" && !cadernosUi.showAll)) {
      list = list.filter(isCadernoInDefaultView);
    } else if (cadernosUi.status !== "all") {
      list = list.filter((c) => c.status === cadernosUi.status);
    }
    if (cadernosUi.mode !== "all") {
      list = list.filter((c) => (c.deliveryMode || "group") === cadernosUi.mode);
    }
    if (q) {
      list = list.filter(
        (c) =>
          String(c.name || "")
            .toLowerCase()
            .includes(q) || String(c.id).includes(q)
      );
    }
    list.sort((a, b) => {
      if (cadernosUi.sort === "status") return String(a.status).localeCompare(String(b.status));
      if (cadernosUi.sort === "id") return Number(b.id) - Number(a.id);
      if (cadernosUi.sort === "progress") {
        const pa = (Number(a.publishedCount ?? a.cursor) || 0) / Math.max(1, Number(a.totalQuestions) || 1);
        const pb = (Number(b.publishedCount ?? b.cursor) || 0) / Math.max(1, Number(b.totalQuestions) || 1);
        return pb - pa;
      }
      if (cadernosUi.sort === "next") {
        const ta = getCadernoNextIso(a) ? new Date(getCadernoNextIso(a)).getTime() : Infinity;
        const tb = getCadernoNextIso(b) ? new Date(getCadernoNextIso(b)).getTime() : Infinity;
        return ta - tb;
      }
      return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
    });
    return list;
  }

  function renderCadernosSummary() {
    const box = document.getElementById("cb-summary");
    if (!box) return;
    const total = cadernosCache.length;
    const active = cadernosCache.filter((c) => c.status === "active").length;
    const priv = cadernosCache.filter((c) => c.deliveryMode === "private").length;
    const waiting = cadernosCache.filter((c) => c.status === "paused_waiting_decision").length;
    box.innerHTML = `
      <div class="cb-stat-pill"><span>Total</span><strong>${total}</strong></div>
      <div class="cb-stat-pill"><span>Ativos</span><strong>${active}</strong></div>
      <div class="cb-stat-pill"><span>Privados</span><strong>${priv}</strong></div>
      <div class="cb-stat-pill"><span>Aguardando</span><strong>${waiting}</strong></div>`;
  }

  function integrationWarnText(reason) {
    if (reason === "missing_url" || reason === "missing_env") {
      return "Falta STUDY_APP_URL no Vercel do Papa Vagas (URL do app de estudo, sem barra no final). Sem isso as respostas nas omissas não voltam para o caderno.";
    }
    if (reason === "missing_secret") {
      return "Falta FLASHCARDS_BOT_INBOUND_SECRET no Vercel do Papa Vagas (mesmo valor de QUIZ_BOT_USERS_SECRET no app).";
    }
    if (reason === "http_401") {
      return "App recusou a chamada (secret diferente: FLASHCARDS_BOT_INBOUND_SECRET ≠ QUIZ_BOT_USERS_SECRET).";
    }
    if (reason && String(reason).startsWith("http_")) {
      return `App respondeu ${reason.replace("http_", "HTTP ")} ao buscar o roster.`;
    }
    return "App não alcançado. No Vercel do Papa Vagas, defina STUDY_APP_URL com a URL do app de estudo.";
  }

  function renderIntegrationBlock(c) {
    const integ = c.integration || {};
    const linked = Boolean(integ.linkedToApp || c.originNotebookId);
    if (!linked && !(integ.people && integ.people.length)) return "";
    const people = Array.isArray(integ.people) ? integ.people : [];
    const appNote =
      integ.appReachable === false
        ? `<p class="cb-integration-warn">${esc(integrationWarnText(integ.appUnreachableReason))}</p>`
        : "";
    const peopleHtml = people.length
      ? `<ul class="cb-integration-people">${people
          .map((p) => `<li>${esc(p.line || p.label || "")}</li>`)
          .join("")}</ul>`
      : `<p class="cb-integration-empty">Nenhuma pessoa listada ainda.</p>`;
    return `
      <div class="cb-integration">
        <p><strong>Integração</strong> ${
          linked
            ? `ligado ao app${c.originNotebookId ? ` · origem ${esc(String(c.originNotebookId).slice(0, 8))}…` : ""}`
            : "sem vínculo com o app"
        }</p>
        ${appNote}
        ${peopleHtml}
      </div>`;
  }

  function renderCadernosStatusLine() {
    if (!IS_CADERNOS_PAGE || !els.cadernosStatus) return;
    if (cadernosLoadMessage) {
      els.cadernosStatus.textContent = cadernosLoadMessage;
      return;
    }
    const ativos = cadernosCache.filter((c) => c.status === "active").length;
    const hidden = cadernosCache.filter((c) => !isCadernoInDefaultView(c)).length;
    const showingDefault = cadernosUi.status === "current" || (cadernosUi.status === "all" && !cadernosUi.showAll);
    if (showingDefault && hidden > 0 && !cadernosUi.search.trim() && cadernosUi.mode === "all") {
      const visible = cadernosCache.length - hidden;
      els.cadernosStatus.textContent = `${visible} em andamento — ${hidden} inativo(s) ou encerrado(s) oculto(s).`;
      return;
    }
    els.cadernosStatus.textContent = `${cadernosCache.length} caderno(s) — ${ativos} ativo(s).`;
  }

  function renderCadernos() {
    if (!els.cadernosList) return;
    renderCadernosSummary();
    renderCadernosStatusLine();
    const list = getFilteredCadernos();
    if (!cadernosCache.length) {
      els.cadernosList.innerHTML = IS_CADERNOS_PAGE
        ? `<li class="cb-empty"><strong>Nenhum caderno ainda</strong>Clique em “Importar caderno” para enviar um PDF do Tec ou um Markdown de IA.</li>`
        : '<li class="engagement-empty">Nenhum caderno cadastrado. Clique em "Importar caderno" para enviar um PDF.</li>';
      return;
    }
    if (!list.length) {
      const hiddenByDefault =
        IS_CADERNOS_PAGE &&
        (cadernosUi.status === "current" || (cadernosUi.status === "all" && !cadernosUi.showAll)) &&
        !cadernosUi.search.trim() &&
        cadernosUi.mode === "all" &&
        cadernosCache.some((c) => !isCadernoInDefaultView(c));
      els.cadernosList.innerHTML = IS_CADERNOS_PAGE
        ? hiddenByDefault
          ? `<li class="cb-empty"><strong>Nenhum caderno ativo ou aguardando decisão</strong>Marque “Mostrar todos” para ver inativos e encerrados.</li>`
          : `<li class="cb-empty"><strong>Nenhum resultado</strong>Ajuste busca ou filtros.</li>`
        : '<li class="engagement-empty">Nenhum caderno com esses filtros.</li>';
      return;
    }
    els.cadernosList.innerHTML = list
      .map((c) => {
        const published = typeof c.publishedCount === "number" ? c.publishedCount : c.cursor;
        const total = Number(c.totalQuestions) || 0;
        const answered = Number(c.answeredPublishedCount) || 0;
        const pct = total > 0 ? Math.min(100, Math.round((published / total) * 100)) : 0;
        const progressLabel = `Enviadas ${published}/${total} · Respondidas ${answered}/${published}`;
        const nextIso = getCadernoNextIso(c);
        const next =
          c.status === "active" ? formatNextRunPretty(nextIso, c.timezone) : "—";
        const last = c.lastRunAt ? formatNextRunPretty(c.lastRunAt, c.timezone) : "—";
        const perDay = c.questionsPerDay != null ? c.questionsPerDay : c.questionsPerRun;
        const startHour = c.startHour != null ? c.startHour : c.sendHour;
        const startMinute = c.startMinute != null ? c.startMinute : c.sendMinute;
        const scheduleText =
          c.deliveryMode === "private"
            ? `${(c.privateRecipients || []).filter((r) => r.active).length} destinatário(s)`
            : `${perDay} q./dia · liberação ${pad2(startHour)}:${pad2(startMinute)}`;
        const todaySent = Number(c.currentDaySent || 0);
        const todayText =
          c.currentDayDate && c.status === "active" ? `${todaySent}/${perDay}` : "—";
        const isActive = c.status === "active";
        const canPause = c.status === "active" || c.status === "paused_waiting_decision";
        const canResume = c.status !== "active" && c.status !== "finished";
        const canRecycle =
          c.status === "paused_waiting_decision" || c.status === "finished";
        const badges = [
          c.deliveryMode === "private"
            ? `<span class="cb-badge">Privado</span>`
            : `<span class="cb-badge">Coletivo</span>`,
          c.randomOrder ? `<span class="cb-badge">Aleatório</span>` : "",
          c.waitForAnswers ? `<span class="cb-badge">Esperar resposta</span>` : "",
          c.deliveryMode !== "private" && c.engagedCount > 0
            ? `<span class="cb-badge">${c.engagedCount} engajado(s)</span>`
            : "",
          c.originNotebookId || (c.integration && c.integration.linkedToApp)
            ? `<span class="cb-badge">App</span>`
            : ""
        ]
          .filter(Boolean)
          .join("");

        if (!IS_CADERNOS_PAGE) {
          return `
        <li class="caderno-card" data-id="${c.id}">
          <div class="caderno-card-head">
            <h4 class="caderno-card-name">${esc(c.name)} <small style="color:var(--muted);font-weight:500;">#${c.id}</small></h4>
            <span class="caderno-card-status status-${esc(c.status)}">${esc(formatStatusLabel(c.status))}</span>
          </div>
          <div class="caderno-card-meta">
            <div><strong>Envio:</strong> ${esc(scheduleText)}</div>
            <div><strong>Progresso:</strong> ${esc(progressLabel)}</div>
            <div><strong>Próximo:</strong> ${esc(next)}</div>
          </div>
          <div class="caderno-card-actions">
            <button type="button" data-action="edit">Editar</button>
            <button type="button" data-action="pause" ${canPause ? "" : "disabled"}>Pausar</button>
            <button type="button" data-action="resume" ${canResume ? "" : "disabled"}>Retomar</button>
          </div>
        </li>`;
        }

        return `
        <li class="cb-card caderno-card" data-id="${c.id}">
          <div class="cb-card-header">
            <div class="cb-card-title-block">
              <h2 class="cb-card-title">${esc(c.name)}</h2>
              <p class="cb-card-id">#${c.id}</p>
              <div class="cb-card-badges">${badges}</div>
            </div>
            <span class="cb-status-chip status-${esc(c.status)}">${esc(formatStatusLabel(c.status))}</span>
          </div>
          <div class="cb-card-body">
            <div class="cb-progress">
              <div class="cb-progress-top">
                <span>Progresso</span>
                <span>${esc(progressLabel)} · ${pct}%</span>
              </div>
              <div class="cb-progress-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
            </div>
            <div class="cb-stats">
              <div class="cb-stat"><span>Agenda</span><strong>${esc(scheduleText)}</strong></div>
              <div class="cb-stat"><span>Hoje</span><strong>${esc(todayText)}</strong></div>
              <div class="cb-stat"><span>Próximo envio</span><strong>${esc(next)}</strong></div>
              <div class="cb-stat"><span>Último envio</span><strong>${esc(last)}</strong></div>
            </div>
            ${renderIntegrationBlock(c)}
          </div>
          <div class="cb-card-actions caderno-card-actions">
            <button type="button" class="btn-primary-action" data-action="trigger" ${isActive ? "" : "disabled"} title="Envia a próxima questão agora (até 60s)">Enviar agora</button>
            <button type="button" data-action="edit">Editar</button>
            <button type="button" data-action="toggle-random" title="Clique para alternar">${c.randomOrder ? "Aleatório" : "Ordem do PDF"}</button>
            <button type="button" data-action="pause" ${canPause ? "" : "disabled"}>Pausar</button>
            <button type="button" data-action="resume" ${canResume ? "" : "disabled"}>${
          canRecycle ? "Retomar do começo" : "Retomar"
        }</button>
            <button type="button" data-action="recycle" ${canRecycle ? "" : "disabled"}>Reciclar</button>
            <button type="button" class="btn-caderno-danger" data-action="delete">Excluir</button>
          </div>
        </li>`;
      })
      .join("");
  }

  async function loadCadernos() {
    if (!els.cadernosList || !els.cadernosStatus) return;
    els.cadernosStatus.textContent = "Carregando…";
    try {
      const data = await fetchJson(API.cadernos);
      cadernosCache = data.cadernos || [];
      if (data.warning) {
        cadernosLoadMessage = data.warning;
      } else if (!cadernosCache.length) {
        cadernosLoadMessage = "Você ainda não tem cadernos cadastrados.";
      } else {
        cadernosLoadMessage = "";
      }
      renderCadernos();
    } catch (e) {
      cadernosLoadMessage = e.message || "Não foi possível carregar.";
      cadernosCache = [];
      renderCadernos();
    }
  }

  function openCadernosModal() {
    if (!els.cadernosOverlay) return;
    els.cadernosOverlay.classList.add("open");
    els.cadernosOverlay.setAttribute("aria-hidden", "false");
    loadCadernos();
  }

  function closeCadernosModal() {
    if (!els.cadernosOverlay) return;
    els.cadernosOverlay.classList.remove("open");
    els.cadernosOverlay.setAttribute("aria-hidden", "true");
  }

  async function patchCadernoStatus(id, payload) {
    return fetchJson(API.cadernos, {
      method: "PATCH",
      body: JSON.stringify({ id, ...payload })
    });
  }

  async function onCadernosListClick(ev) {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const card = btn.closest(".caderno-card");
    if (!card) return;
    const id = Number(card.dataset.id);
    if (!Number.isFinite(id)) return;
    const action = btn.dataset.action;
    const c = cadernosCache.find((x) => x.id === id);
    if (!c) return;

    const allButtons = card.querySelectorAll("button");
    allButtons.forEach((b) => (b.disabled = true));

    try {
      if (action === "edit") {
        await openCadernoEditModal(c);
        return;
      }
      if (action === "pause") {
        await patchCadernoStatus(id, { status: "inactive" });
      } else if (action === "resume") {
        await patchCadernoStatus(id, { status: "active", recomputeNextRun: true });
      } else if (action === "trigger") {
        if (els.cadernosStatus) {
          els.cadernosStatus.textContent =
            "Pedido enviado. O bot publica a próxima questão em até 60s.";
        }
        await patchCadernoStatus(id, { triggerNow: true });
      } else if (action === "toggle-random") {
        await patchCadernoStatus(id, { randomOrder: !c.randomOrder });
      } else if (action === "recycle") {
        if (
          !confirm(
            `Reciclar o caderno "${c.name}"? Todas as questões voltam a ficar disponíveis para envio (zera o cursor).`
          )
        ) {
          return;
        }
        await patchCadernoStatus(id, {
          status: "active",
          cursor: 0,
          recomputeNextRun: true,
          recyclePublished: true
        });
      } else if (action === "delete") {
        if (!confirm(`Excluir o caderno "${c.name}" e todas as suas questões? Esta ação é permanente.`)) {
          return;
        }
        await fetchJson(API.cadernoDelete, {
          method: "POST",
          body: JSON.stringify({ id })
        });
      }
      await loadCadernos();
    } catch (e) {
      els.cadernosStatus.textContent = e.message || "Falha na ação.";
    } finally {
      renderCadernos();
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });
  }

  function getCadernoFormPayload() {
    const file = els.cadernoPdf && els.cadernoPdf.files && els.cadernoPdf.files[0];
    const name = (els.cadernoName.value || "").trim();
    const questionsPerDay = Number((els.cadernoPerDay && els.cadernoPerDay.value) || 3);
    syncEndHiddenFromStart(els.cadernoTime, els.cadernoEndTime);
    const [hh, mm] = String((els.cadernoTime && els.cadernoTime.value) || "07:00").split(":");
    const clamped = clampReleaseTime(Number(hh), Number(mm));
    const startHour = clamped.hour;
    const startMinute = clamped.minute;
    const endHour = startHour;
    const endMinute = startMinute;
    const randomOrder = Boolean(els.cadernoRandom && els.cadernoRandom.checked);
    const waitForAnswers = Boolean(els.cadernoWait && els.cadernoWait.checked);
    const deliveryMode = getCadernoAddDeliveryMode();
    const sendTimes =
      deliveryMode === "group"
        ? computeUniformSendTimes(questionsPerDay, startHour, startMinute, endHour, endMinute)
        : null;
    const privateRecipients = deliveryMode === "private" ? collectAddPrivateRecipients() : [];
    const createdByJid =
      deliveryMode === "private"
        ? privateRecipients.find((r) => r.active !== false && r.userJid)?.userJid || null
        : null;
    const markdownText = pastedIaMarkdown();
    const iaFile = iaMarkdownFile();
    return {
      file: wizardSource === "ia" ? (markdownText ? null : iaFile) : file,
      markdownText,
      source: wizardSource,
      name,
      deliveryMode,
      createdByJid,
      privateRecipients,
      schedule: {
        questionsPerDay: Number.isFinite(questionsPerDay) ? questionsPerDay : 3,
        sendTimes,
        startHour: Number.isFinite(startHour) ? startHour : 7,
        startMinute: Number.isFinite(startMinute) ? startMinute : 0,
        endHour,
        endMinute,
        timezone: "America/Sao_Paulo",
        randomOrder,
        waitForAnswers
      }
    };
  }

  function renderCadernoPreview(result) {
    const boxes = [els.cadernoPreviewBox, els.cadernoPreviewBoxIa].filter(Boolean);
    if (!boxes.length) return;
    if (!result) {
      boxes.forEach((box) => {
        box.classList.add("hidden");
        box.innerHTML = "";
      });
      return;
    }
    const summary = result.summary || {};
    const lines = [];
    lines.push("<h4>Pré-visualização</h4>");
    lines.push(
      `<div><strong>Total de questões extraídas:</strong> ${result.totalQuestions}</div>`
    );
    lines.push(
      `<div><strong>Entradas no gabarito:</strong> ${result.totalGabaritoEntries ?? "?"}</div>`
    );
    lines.push(
      `<div><strong>Múltipla escolha / Certo-Errado:</strong> ${summary.multipleChoice || 0} / ${
        summary.trueFalse || 0
      }</div>`
    );
    if (summary.withoutAnswerKey) {
      lines.push(
        `<div class="caderno-preview-warning"><strong>${summary.withoutAnswerKey}</strong> questão(ões) sem gabarito mapeado.</div>`
      );
    }
    if (result.warnings && result.warnings.length) {
      lines.push(
        `<div style="margin-top:0.5rem"><strong>Avisos do parser:</strong></div><ul>${result.warnings
          .slice(0, 12)
          .map((w) => `<li>${esc(w)}</li>`)
          .join("")}${result.warnings.length > 12 ? "<li>…</li>" : ""}</ul>`
      );
    }
    if (result.preview && result.preview.length) {
      const first = result.preview[0];
      lines.push("<div style='margin-top:0.65rem'><strong>Primeira questão:</strong></div>");
      lines.push(`<div style="opacity:.8">${esc(first.banca || "")}</div>`);
      lines.push(`<div style="opacity:.8;margin-bottom:.35rem">${esc(first.subject || "")}</div>`);
      lines.push(`<pre style="white-space:pre-wrap;font:inherit;margin:0">${esc(first.statementText)}</pre>`);
      lines.push(
        `<div style="margin-top:.3rem"><strong>Gabarito:</strong> ${esc(first.answerKey || "?")}</div>`
      );
      lines.push(`<div><a href="${escAttr(first.tecUrl)}" target="_blank" rel="noreferrer">${esc(first.tecUrl)}</a></div>`);
    }
    const html = lines.join("");
    boxes.forEach((box) => {
      box.innerHTML = html;
      box.classList.remove("hidden");
    });
  }

  async function callCadernoUpload(extra) {
    const form = getCadernoFormPayload();
    if (!form.file && !form.markdownText) {
      throw new Error(
        form.source === "ia"
          ? "Cole o Markdown da IA ou envie o arquivo .md."
          : "Selecione um PDF do Tec ou um arquivo Markdown (.md)."
      );
    }
    if (!extra.previewOnly && !form.name) throw new Error("Informe um nome para o caderno.");
    const isMarkdown =
      Boolean(form.markdownText) ||
      (form.file &&
        (/\.md$/i.test(form.file.name || "") || /markdown|text\/plain/i.test(form.file.type || "")));
    const body = {
      name: form.name,
      schedule: form.schedule,
      deliveryMode: form.deliveryMode,
      createdByJid: form.createdByJid,
      ...extra
    };
    if (form.markdownText) {
      body.markdown = form.markdownText;
    } else if (isMarkdown) {
      body.markdown = unwrapMdFence(await form.file.text());
    } else {
      body.pdfBase64 = await readFileAsDataUrl(form.file);
    }
    if (form.deliveryMode === "private" && Array.isArray(form.privateRecipients)) {
      body.privateRecipients = form.privateRecipients;
    }
    return fetchJson(API.cadernoUpload, {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  async function onCadernoPreview() {
    if (cadernoUploadInFlight) return;
    cadernoUploadInFlight = true;
    els.cadernoAddStatus.textContent = "Lendo arquivo e extraindo…";
    renderCadernoPreview(null);
    try {
      const result = await callCadernoUpload({ previewOnly: true });
      els.cadernoAddStatus.textContent = `${result.totalQuestions} questão(ões) extraída(s).`;
      renderCadernoPreview(result);
    } catch (e) {
      els.cadernoAddStatus.textContent = e.message || "Falha no preview.";
    } finally {
      cadernoUploadInFlight = false;
    }
  }

  async function onCadernoSave(activate) {
    if (cadernoUploadInFlight) return;
    cadernoUploadInFlight = true;
    els.cadernoAddStatus.textContent = activate ? "Salvando e ativando…" : "Salvando…";
    try {
      const form = getCadernoFormPayload();
      if (form.deliveryMode !== "private") {
        const qpd = form.schedule.questionsPerDay;
        const timesErr = validateSendTimesAscending(form.schedule.sendTimes);
        if (timesErr || !form.schedule.sendTimes || form.schedule.sendTimes.length !== qpd) {
          els.cadernoAddStatus.textContent =
            timesErr || `Grupo: informe ${qpd} horário(s), um por questão do dia.`;
          return;
        }
        const hasRole = cadernoAddEngagementDraft.some((m) => m.engaged || m.passive);
        if (!hasRole) {
          els.cadernoAddStatus.textContent =
            "Marque ao menos um engajado ou passivo antes de salvar.";
          return;
        }
      }
      if (form.deliveryMode === "private") {
        const hasActive = (form.privateRecipients || []).some((r) => r.active !== false && r.userJid);
        if (!hasActive) {
          els.cadernoAddStatus.textContent =
            "Modo privado: use “Carregar membros do grupo” e marque ao menos um destinatário.";
          return;
        }
        for (const r of form.privateRecipients) {
          if (r.active === false || !r.userJid) continue;
          if (r.questionsPerDay == null || !r.sendTimes || r.sendTimes.length !== r.questionsPerDay) {
            els.cadernoAddStatus.textContent =
              "Privado: preencha Q/dia e um horário por questão em cada destinatário marcado.";
            return;
          }
          const privTimesErr = validateSendTimesAscending(r.sendTimes);
          if (privTimesErr) {
            els.cadernoAddStatus.textContent = `Privado (${r.userJid}): ${privTimesErr}`;
            return;
          }
        }
      }
      const result = await callCadernoUpload({ activate });
      if (result.cadernoId) await applyPendingEngagementAfterCreate(result.cadernoId);
      els.cadernoAddStatus.textContent = `Caderno #${result.cadernoId} salvo (${result.totalQuestions} questões).`;
      renderCadernoPreview(result);
      await loadCadernos();
      setTimeout(() => {
        closeCadernoAddModal();
      }, 1200);
    } catch (e) {
      els.cadernoAddStatus.textContent = e.message || "Falha ao salvar.";
    } finally {
      cadernoUploadInFlight = false;
    }
  }

  async function openCadernoEditModal(caderno) {
    if (!els.cadernoEditOverlay) return;
    const dm = caderno.deliveryMode === "private" ? "private" : "group";
    if (dm === "private") {
      try {
        await ensureEngagementMembersLoaded();
      } catch {
        /* lista segue com JID se engajamento falhar */
      }
    }
    els.cadernoEditId.value = String(caderno.id);
    els.cadernoEditName.value = caderno.name || "";
    const perDay =
      caderno.questionsPerDay != null
        ? Number(caderno.questionsPerDay)
        : Number(caderno.questionsPerRun || 3);
    const startHour =
      caderno.startHour != null ? Number(caderno.startHour) : Number(caderno.sendHour || 7);
    const startMinute =
      caderno.startMinute != null
        ? Number(caderno.startMinute)
        : Number(caderno.sendMinute || 0);
    els.cadernoEditPerDay.value = String(perDay);
    const clampedEdit = clampReleaseTime(startHour, startMinute);
    els.cadernoEditTime.value = `${pad2(clampedEdit.hour)}:${pad2(clampedEdit.minute)}`;
    if (els.cadernoEditEndTime) {
      els.cadernoEditEndTime.value = `${pad2(clampedEdit.hour)}:${pad2(clampedEdit.minute)}`;
    }
    const editTimes = computeUniformSendTimes(
      perDay,
      clampedEdit.hour,
      clampedEdit.minute,
      clampedEdit.hour,
      clampedEdit.minute
    );
    renderSendTimesList(els.cadernoEditSendTimesList, perDay, editTimes, "Questão");
    els.cadernoEditRandom.checked = Boolean(caderno.randomOrder);
    if (els.cadernoEditWait) els.cadernoEditWait.checked = Boolean(caderno.waitForAnswers);
    if (els.cadernoEditDeliveryGroup) els.cadernoEditDeliveryGroup.checked = dm === "group";
    if (els.cadernoEditDeliveryPrivate) els.cadernoEditDeliveryPrivate.checked = dm === "private";
    syncCadernoEditPrivatePanel();
    if (els.cadernoEditPrivateList) {
      els.cadernoEditPrivateList.dataset.touched = "0";
      els.cadernoEditPrivateList.innerHTML = (caderno.privateRecipients || [])
        .map((r) =>
          renderPrivateRecipientEditRow({
            userJid: r.userJid,
            active: r.active,
            questionsPerDay: r.questionsPerDay,
            startHour: r.startHour,
            startMinute: r.startMinute,
            endHour: r.endHour,
            endMinute: r.endMinute,
            sendTimes: r.sendTimes,
            displayLabel: resolveDisplayLabelForJid(r.userJid)
          })
        )
        .join("");
    }
    if (dm === "group") {
      await loadCadernoEngagementForEdit(caderno.id);
    } else {
      cadernoEngagementCache = [];
      cadernoEngagementEditId = null;
      renderCadernoEngagementList();
      if (els.cadernoEditEngagementStatus) els.cadernoEditEngagementStatus.textContent = "";
    }
    els.cadernoEditStatus.textContent = "";
    els.cadernoEditOverlay.classList.add("open");
    els.cadernoEditOverlay.setAttribute("aria-hidden", "false");
  }

  function closeCadernoEditModal() {
    if (!els.cadernoEditOverlay) return;
    els.cadernoEditOverlay.classList.remove("open");
    els.cadernoEditOverlay.setAttribute("aria-hidden", "true");
  }

  async function onCadernoEditSave() {
    const id = Number(els.cadernoEditId.value);
    if (!Number.isFinite(id) || id <= 0) return;
    const current = cadernosCache.find((x) => x.id === id);
    if (!current) {
      els.cadernoEditStatus.textContent = "Caderno não encontrado na lista.";
      return;
    }

    const name = (els.cadernoEditName.value || "").trim();
    const randomOrder = Boolean(els.cadernoEditRandom.checked);
    const waitForAnswers = Boolean(els.cadernoEditWait && els.cadernoEditWait.checked);
    const editDm = getCadernoEditDeliveryMode();
    const currentDm = current.deliveryMode === "private" ? "private" : "group";

    const currentPerDay =
      current.questionsPerDay != null ? Number(current.questionsPerDay) : Number(current.questionsPerRun);
    const currentStartHour =
      current.startHour != null ? Number(current.startHour) : Number(current.sendHour);
    const currentStartMinute =
      current.startMinute != null ? Number(current.startMinute) : Number(current.sendMinute);
    const currentEndHour = current.endHour != null ? Number(current.endHour) : currentStartHour;
    const currentEndMinute = current.endMinute != null ? Number(current.endMinute) : currentStartMinute;

    const payload = { id };
    if (name && name !== current.name) payload.name = name;
    if (randomOrder !== Boolean(current.randomOrder)) payload.randomOrder = randomOrder;
    if (waitForAnswers !== Boolean(current.waitForAnswers)) payload.waitForAnswers = waitForAnswers;

    if (editDm !== currentDm) payload.deliveryMode = editDm;

    if (editDm === "group") {
      const questionsPerDay = Number(els.cadernoEditPerDay.value || 3);
      syncEndHiddenFromStart(els.cadernoEditTime, els.cadernoEditEndTime);
      const [hh, mm] = String(els.cadernoEditTime.value || "07:00").split(":");
      const clamped = clampReleaseTime(Number(hh), Number(mm));
      const startHour = clamped.hour;
      const startMinute = clamped.minute;
      const endHour = startHour;
      const endMinute = startMinute;
      const sendTimes = computeUniformSendTimes(questionsPerDay, startHour, startMinute, endHour, endMinute);
      if (questionsPerDay !== currentPerDay) payload.questionsPerDay = questionsPerDay;
      if (Number.isFinite(startHour) && startHour !== currentStartHour) payload.startHour = startHour;
      if (Number.isFinite(startMinute) && startMinute !== currentStartMinute) payload.startMinute = startMinute;
      if (Number.isFinite(endHour) && endHour !== currentEndHour) payload.endHour = endHour;
      if (Number.isFinite(endMinute) && endMinute !== currentEndMinute) payload.endMinute = endMinute;
      const currentTimes = current.sendTimes || [];
      const timesChanged =
        sendTimes.length !== currentTimes.length ||
        sendTimes.some((t, i) => t.hour !== currentTimes[i]?.hour || t.minute !== currentTimes[i]?.minute);
      if (timesChanged) payload.sendTimes = sendTimes;
    } else {
      const pr = collectEditPrivateRecipients();
      if (pr.length === 0) {
        els.cadernoEditStatus.textContent =
          "Modo privado: marque ao menos um destinatário (use “Carregar membros do grupo”).";
        return;
      }
      const active = pr.filter((r) => r.active !== false && r.userJid);
      if (active.length === 0) {
        els.cadernoEditStatus.textContent = "Modo privado: marque ao menos um destinatário ativo.";
        return;
      }
      for (const r of active) {
        if (r.questionsPerDay == null || !r.sendTimes || r.sendTimes.length !== r.questionsPerDay) {
          els.cadernoEditStatus.textContent =
            "Privado: cada destinatário marcado precisa de Q/dia e horário por questão.";
          return;
        }
        const privTimesErr = validateSendTimesAscending(r.sendTimes);
        if (privTimesErr) {
          els.cadernoEditStatus.textContent = `Privado (${r.userJid}): ${privTimesErr}`;
          return;
        }
      }
      const lead = active[0];
      payload.privateRecipients = pr;
      if (lead.questionsPerDay !== currentPerDay) payload.questionsPerDay = lead.questionsPerDay;
      if (lead.startHour !== currentStartHour) payload.startHour = lead.startHour;
      if (lead.startMinute !== currentStartMinute) payload.startMinute = lead.startMinute;
      if (lead.endHour !== currentEndHour) payload.endHour = lead.endHour;
      if (lead.endMinute !== currentEndMinute) payload.endMinute = lead.endMinute;
    }

    if (Object.keys(payload).length === 1) {
      els.cadernoEditStatus.textContent = "Nada para salvar — sem alterações.";
      return;
    }

    els.btnCadernoEditSave.disabled = true;
    els.cadernoEditStatus.textContent = "Salvando…";
    try {
      await fetchJson(API.cadernos, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      els.cadernoEditStatus.textContent = "Alterações salvas.";
      await loadCadernos();
      setTimeout(() => closeCadernoEditModal(), 700);
    } catch (e) {
      els.cadernoEditStatus.textContent = e.message || "Falha ao salvar.";
    } finally {
      els.btnCadernoEditSave.disabled = false;
    }
  }

  function openCadernoAddModal() {
    if (!els.cadernoAddOverlay) return;
    if (els.cadernoName) els.cadernoName.value = "";
    if (els.cadernoPdf) els.cadernoPdf.value = "";
    if (els.cadernoMd) els.cadernoMd.value = "";
    if (els.cadernoMdFile) els.cadernoMdFile.value = "";
    wizardSource = "";
    document.querySelectorAll('input[name="caderno-source"]').forEach((input) => {
      input.checked = false;
    });
    if (els.cadernoPerDay) els.cadernoPerDay.value = "3";
    if (els.cadernoTime) els.cadernoTime.value = "07:00";
    if (els.cadernoEndTime) els.cadernoEndTime.value = "07:00";
    syncCadernoAddSendTimes(false);
    if (els.cadernoRandom) els.cadernoRandom.checked = false;
    if (els.cadernoWait) els.cadernoWait.checked = false;
    if (els.cadernoDeliveryGroup) els.cadernoDeliveryGroup.checked = true;
    if (els.cadernoDeliveryPrivate) els.cadernoDeliveryPrivate.checked = false;
    if (els.cadernoAddPrivateList) els.cadernoAddPrivateList.innerHTML = "";
    cadernoAddEngagementDraft = [];
    if (els.cadernoAddEngagementList) els.cadernoAddEngagementList.innerHTML = "";
    if (els.cadernoAddEngagementStatus) els.cadernoAddEngagementStatus.textContent = "";
    if (els.wizardSummary) els.wizardSummary.innerHTML = "";
    syncCadernoAddPrivatePanel();
    if (els.cadernoAddStatus) els.cadernoAddStatus.textContent = "";
    renderCadernoPreview(null);
    setWizardStep(0);
    els.cadernoAddOverlay.classList.add("open");
    els.cadernoAddOverlay.setAttribute("aria-hidden", "false");
  }

  function closeCadernoAddModal() {
    if (!els.cadernoAddOverlay) return;
    els.cadernoAddOverlay.classList.remove("open");
    els.cadernoAddOverlay.setAttribute("aria-hidden", "true");
  }

  async function onGenerateReport() {
    const scope = els.reportPerson ? els.reportPerson.value : "";
    if (!scope) {
      if (els.reportStatus) els.reportStatus.textContent = "Selecione o participante.";
      return;
    }
    if (els.reportStatus) els.reportStatus.textContent = "Atualizando dados da base…";
    els.reportGenerate.disabled = true;
    try {
      const fresh = await fetchJson(API.reportData);
      if (!fresh || !Array.isArray(fresh.questions) || !fresh.questions.length) {
        reportData = null;
        throw new Error("Sem dados de relatório. Confira o grupo no Vercel.");
      }
      const keepCaderno = els.reportCaderno ? els.reportCaderno.value : "__all__";
      const keepOutcome = els.reportOutcome ? els.reportOutcome.value : "all";
      reportData = fresh;
      populateFilters();
      populateReportSelect();
      if (els.reportPerson) {
        const opts = [...els.reportPerson.options].map((o) => o.value);
        if (opts.includes(scope)) {
          els.reportPerson.value = scope;
        } else {
          const hit = mergedParticipants().find(
            (p) =>
              p.userJid === scope ||
              (p.aliasJids || []).some((j) => j === scope || jidKey(j) === jidKey(scope))
          );
          if (hit && opts.includes(hit.userJid)) els.reportPerson.value = hit.userJid;
        }
      }
      if (els.reportCaderno && [...els.reportCaderno.options].some((o) => o.value === keepCaderno)) {
        els.reportCaderno.value = keepCaderno;
      }
      if (els.reportOutcome) els.reportOutcome.value = keepOutcome;
      collectReportCategoryRulesFromDom();
      renderReportCategoryRules();
      if (els.reportStatus) els.reportStatus.textContent = "Gerando ZIP… pode levar alguns segundos.";
      await buildReportZip(els.reportPerson ? els.reportPerson.value : scope);
      if (els.reportStatus) els.reportStatus.textContent = "Download iniciado.";
      closeReportModal();
    } catch (e) {
      if (els.reportStatus) els.reportStatus.textContent = e.message || "Erro ao gerar.";
    } finally {
      els.reportGenerate.disabled = false;
    }
  }

  async function init() {
    if (IS_CADERNOS_PAGE) {
      await loadCadernos();
      return;
    }
    try {
      const [qaRes, qRes, repOrErr] = await Promise.all([
        fetchJson(API.qaStats),
        fetchJson(API.questions),
        fetchJson(API.reportData).catch(() => null)
      ]);

      renderQaStats(qaRes);
      reportData =
        repOrErr && Array.isArray(repOrErr.questions) && repOrErr.questions.length > 0 ? repOrErr : null;

      if (reportData) {
        questionsList = reportData.questions.map((q) => ({
          shortId: q.shortId,
          creatorName: q.creatorName,
          questionType: q.questionType,
          statementPreview: truncate(q.statementText || "", 220),
          hasMedia: Boolean(q.statementMediaUrl),
          statementMediaMimeType: q.statementMediaMimeType || null
        }));
      } else {
        questionsList = qRes.questions || [];
      }

      populateFilters();
      populateReportSelect();
      await populatePracticeUserSelect();

      if (els.filterPerson) {
        els.filterPerson.addEventListener("change", () => {
          questionsShowAll = false;
          updateOutcomeOptions();
          applyFiltersAndRender();
        });
      }
      if (els.filterOutcome) {
        els.filterOutcome.addEventListener("change", () => {
          questionsShowAll = false;
          applyFiltersAndRender();
        });
      }
      if (els.btnQuestionsMore) {
        els.btnQuestionsMore.addEventListener("click", () => {
          questionsShowAll = !questionsShowAll;
          applyFiltersAndRender();
          if (!questionsShowAll && els.questionsMoreWrap) {
            els.questionsMoreWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        });
      }

      applyFiltersAndRender();
    } catch (e) {
      if (els.loadErr) {
        els.loadErr.textContent =
          e.message ||
          "Não foi possível carregar dados. Confira as variáveis de ambiente no Vercel (Supabase).";
        els.loadErr.classList.remove("hidden");
      }
    }
  }

  if (els.btnClose) els.btnClose.addEventListener("click", closeModal);
  if (els.modal) {
    els.modal.addEventListener("click", (ev) => {
      if (ev.target === els.modal) closeModal();
    });
  }
  if (els.modalRevealBtn) els.modalRevealBtn.addEventListener("click", showReveal);
  if (els.modalPrev) els.modalPrev.addEventListener("click", () => navigateModal(-1));
  if (els.modalNext) els.modalNext.addEventListener("click", () => navigateModal(1));
  if (els.modalNewCat) els.modalNewCat.addEventListener("click", openNewCatModal);
  if (els.modalSaveCats) els.modalSaveCats.addEventListener("click", () => saveModalCategories());
  if (els.newcatClose) els.newcatClose.addEventListener("click", closeNewCatModal);
  if (els.newcatSave) els.newcatSave.addEventListener("click", () => createNewCategoryFromModal());
  if (els.newcatOverlay) {
    els.newcatOverlay.addEventListener("click", (ev) => {
      if (ev.target === els.newcatOverlay) closeNewCatModal();
    });
  }
  if (els.practiceUserSelect) {
    els.practiceUserSelect.addEventListener("change", () => {
      const jid = getPracticeUserJid();
      if (jid) localStorage.setItem(STORAGE_USER, jid);
      else localStorage.removeItem(STORAGE_USER);
      if (currentShortId) openModal(currentShortId);
    });
  }
  if (els.reportCatAdd) {
    els.reportCatAdd.addEventListener("click", () => {
      collectReportCategoryRulesFromDom();
      reportCategoryRules.push({ key: "__all__", mode: "filter" });
      renderReportCategoryRules();
    });
  }
  if (els.reportPerson) {
    els.reportPerson.addEventListener("change", () => {
      collectReportCategoryRulesFromDom();
      renderReportCategoryRules();
    });
  }

  if (els.btnReportOpen) els.btnReportOpen.addEventListener("click", openReportModal);
  if (els.reportClose) els.reportClose.addEventListener("click", closeReportModal);
  if (els.reportOverlay) {
    els.reportOverlay.addEventListener("click", (ev) => {
      if (ev.target === els.reportOverlay) closeReportModal();
    });
  }
  if (els.reportGenerate) els.reportGenerate.addEventListener("click", onGenerateReport);

  if (els.btnCadernosOpen) els.btnCadernosOpen.addEventListener("click", openCadernosModal);
  if (els.cadernosClose) els.cadernosClose.addEventListener("click", closeCadernosModal);
  if (els.cadernosOverlay) {
    els.cadernosOverlay.addEventListener("click", (ev) => {
      if (ev.target === els.cadernosOverlay) closeCadernosModal();
    });
  }
  if (els.cadernosList) els.cadernosList.addEventListener("click", onCadernosListClick);
  if (els.btnCadernoAdd) els.btnCadernoAdd.addEventListener("click", openCadernoAddModal);

  const cbSearch = document.getElementById("cb-search");
  const cbFilterStatus = document.getElementById("cb-filter-status");
  const cbFilterMode = document.getElementById("cb-filter-mode");
  const cbSort = document.getElementById("cb-sort");
  const cbShowAll = document.getElementById("cb-show-all");
  const cbReload = document.getElementById("cb-reload");
  if (cbSearch) {
    cbSearch.addEventListener("input", () => {
      cadernosUi.search = cbSearch.value || "";
      renderCadernos();
    });
  }
  if (cbFilterStatus) {
    cbFilterStatus.addEventListener("change", () => {
      cadernosUi.status = cbFilterStatus.value || "current";
      cadernosUi.showAll = cadernosUi.status === "all";
      if (cbShowAll) cbShowAll.checked = cadernosUi.showAll;
      renderCadernos();
    });
  }
  if (cbShowAll) {
    cbShowAll.addEventListener("change", () => {
      cadernosUi.showAll = cbShowAll.checked;
      if (cbShowAll.checked) {
        cadernosUi.status = "all";
        if (cbFilterStatus) cbFilterStatus.value = "all";
      } else if (cadernosUi.status === "all") {
        cadernosUi.status = "current";
        if (cbFilterStatus) cbFilterStatus.value = "current";
      }
      renderCadernos();
    });
  }
  if (cbFilterMode) {
    cbFilterMode.addEventListener("change", () => {
      cadernosUi.mode = cbFilterMode.value;
      renderCadernos();
    });
  }
  if (cbSort) {
    cbSort.addEventListener("change", () => {
      cadernosUi.sort = cbSort.value;
      renderCadernos();
    });
  }
  if (cbReload) cbReload.addEventListener("click", () => loadCadernos());
  if (els.cadernoAddClose) els.cadernoAddClose.addEventListener("click", closeCadernoAddModal);
  if (els.cadernoAddOverlay) {
    els.cadernoAddOverlay.addEventListener("click", (ev) => {
      if (ev.target === els.cadernoAddOverlay) closeCadernoAddModal();
    });
  }
  if (els.btnCadernoPreview) els.btnCadernoPreview.addEventListener("click", onCadernoPreview);
  if (els.btnCadernoPreviewIa) els.btnCadernoPreviewIa.addEventListener("click", onCadernoPreview);
  document.querySelectorAll('input[name="caderno-source"]').forEach((input) => {
    input.addEventListener("change", () => {
      wizardSource = input.value === "ia" ? "ia" : "tec";
      if (wizardStep === 0) setWizardStep(0);
    });
  });
  if (els.btnCopyIaPrompt) {
    els.btnCopyIaPrompt.addEventListener("click", () => {
      const node = document.getElementById("ia-prompt");
      void copyWizardText(node ? node.textContent : "", els.btnCopyIaPrompt);
    });
  }
  if (els.btnCopyIaExample) {
    els.btnCopyIaExample.addEventListener("click", () => {
      const node = document.getElementById("ia-example");
      void copyWizardText(node ? node.textContent : "", els.btnCopyIaExample);
    });
  }
  if (els.btnCadernoSave) els.btnCadernoSave.addEventListener("click", () => onCadernoSave(false));
  if (els.btnCadernoSaveActivate)
    els.btnCadernoSaveActivate.addEventListener("click", () => onCadernoSave(true));
  if (els.wizardNext) {
    els.wizardNext.addEventListener("click", () => {
      if (!validateWizardStep(wizardStep)) return;
      setWizardStep(wizardStep + 1);
    });
  }
  if (els.wizardPrev) {
    els.wizardPrev.addEventListener("click", () => setWizardStep(wizardStep - 1));
  }
  if (els.btnCadernoAddLoadEngagement) {
    els.btnCadernoAddLoadEngagement.addEventListener("click", () => onCadernoAddLoadEngagement());
  }
  if (els.cadernoAddEngagementList) {
    els.cadernoAddEngagementList.addEventListener("change", onCadernoAddEngagementToggle);
  }

  if (els.cadernoEditClose) els.cadernoEditClose.addEventListener("click", closeCadernoEditModal);
  if (els.btnCadernoEditCancel)
    els.btnCadernoEditCancel.addEventListener("click", closeCadernoEditModal);
  if (els.cadernoEditOverlay) {
    els.cadernoEditOverlay.addEventListener("click", (ev) => {
      if (ev.target === els.cadernoEditOverlay) closeCadernoEditModal();
    });
  }
  if (els.btnCadernoEditSave) els.btnCadernoEditSave.addEventListener("click", onCadernoEditSave);

  if (els.cadernoDeliveryGroup) els.cadernoDeliveryGroup.addEventListener("change", onCadernoAddDeliveryChange);
  if (els.cadernoDeliveryPrivate) els.cadernoDeliveryPrivate.addEventListener("change", onCadernoAddDeliveryChange);
  if (els.btnCadernoAddLoadMembers) {
    els.btnCadernoAddLoadMembers.addEventListener("click", () => onCadernoAddLoadMembers());
  }
  if (els.cadernoPerDay) {
    els.cadernoPerDay.addEventListener("change", () => syncCadernoAddSendTimes(true));
  }
  if (els.btnCadernoFillUniform) {
    els.btnCadernoFillUniform.addEventListener("click", () => syncCadernoAddSendTimes(false));
  }
  if (els.cadernoEditPerDay) {
    els.cadernoEditPerDay.addEventListener("change", () => syncCadernoEditSendTimes(true));
  }
  if (els.btnCadernoEditFillUniform) {
    els.btnCadernoEditFillUniform.addEventListener("click", () => syncCadernoEditSendTimes(false));
  }
  if (els.cadernoAddPrivateList) {
    els.cadernoAddPrivateList.addEventListener("input", (ev) => {
      const li = ev.target.closest("li[data-jid]");
      if (!li) return;
      if (ev.target.closest(".caderno-priv-qpd, .caderno-priv-time, .caderno-priv-end-time")) {
        syncPrivateRowSendTimes(li, false);
      }
    });
  }

  if (els.cadernoEditDeliveryGroup) els.cadernoEditDeliveryGroup.addEventListener("change", onCadernoEditDeliveryChange);
  if (els.cadernoEditDeliveryPrivate) els.cadernoEditDeliveryPrivate.addEventListener("change", onCadernoEditDeliveryChange);
  if (els.btnCadernoEditLoadMembers) {
    els.btnCadernoEditLoadMembers.addEventListener("click", () => onCadernoEditLoadMembers());
  }
  if (els.btnCadernoEditLoadEngagement) {
    els.btnCadernoEditLoadEngagement.addEventListener("click", () => onCadernoEditLoadEngagement());
  }
  if (els.cadernoEditEngagementList) {
    els.cadernoEditEngagementList.addEventListener("change", onCadernoEngagementToggle);
  }
  if (els.cadernoEditPrivateList) {
    els.cadernoEditPrivateList.addEventListener("change", (ev) => {
      if (ev.target.closest(".caderno-priv-active, .caderno-priv-qpd, .caderno-priv-time, .caderno-priv-end-time")) {
        markCadernoEditPrivateRecipientsTouched();
      }
    });
    els.cadernoEditPrivateList.addEventListener("input", (ev) => {
      const li = ev.target.closest("li[data-jid]");
      if (ev.target.closest(".caderno-priv-qpd, .caderno-priv-time, .caderno-priv-end-time")) {
        markCadernoEditPrivateRecipientsTouched();
        if (li) syncPrivateRowSendTimes(li, false);
      }
    });
  }

  init();

  /* ——— Gamificação Papa Vagas ——— */
  const eco = {
    members: [],
    shopItems: [],
    shopTab: "all",
    pollTimer: null
  };

  function openOverlay(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
  }
  function closeOverlay(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
  }

  async function loadEconomyMembers() {
    const res = await fetch(`${API.economy}?view=members`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao carregar membros");
    eco.members = data.members || [];
    for (const selId of ["profile-user-select", "shop-user-select"]) {
      const sel = document.getElementById(selId);
      if (!sel) continue;
      const prev = sel.value;
      sel.innerHTML = '<option value="">Selecione…</option>';
      for (const m of eco.members) {
        const opt = document.createElement("option");
        opt.value = m.userJid || m.user_jid;
        opt.textContent = m.displayLabel || m.display_name || opt.value;
        sel.appendChild(opt);
      }
      if (prev) sel.value = prev;
    }
  }

  function auraBar(pct) {
    const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * 10);
    return "█".repeat(filled) + "░".repeat(10 - filled);
  }

  async function renderProfile() {
    const sel = document.getElementById("profile-user-select");
    const body = document.getElementById("profile-body");
    if (!sel || !body || !sel.value) {
      if (body) body.innerHTML = "<p class='empty-state'>Selecione quem é você.</p>";
      return;
    }
    const res = await fetch(`${API.economy}?userJid=${encodeURIComponent(sel.value)}`);
    const data = await res.json();
    if (!res.ok) {
      body.innerHTML = `<p class="error-banner">${data.error || "Erro"}</p>`;
      return;
    }
    const a = data.aura || {};
    const e = data.economy || {};
    const st = data.streak || {};
    body.innerHTML = `
      <div class="profile-hero ${e.active_title ? "has-title" : ""}">
        <div class="profile-title-chip">${e.active_title ? escapeHtml(e.active_title) : "Sem título"}</div>
        <div class="profile-counters">
          <div class="counter-card"><span class="counter-label">💰 Créditos</span><span class="counter-value" data-count="${e.credits || 0}">0</span><small>${data.availableCredits || 0} disponíveis</small></div>
          <div class="counter-card"><span class="counter-label">✨ Aura</span><span class="counter-value" data-count="${e.aura || 0}">0</span></div>
          <div class="counter-card streak-pulse"><span class="counter-label">🔥 Sequência</span><span class="counter-value">${st.current_streak || 0}</span><small>recorde ${st.best_streak || 0}</small></div>
        </div>
        <div class="aura-level-block">
          <div>${escapeHtml(a.label || "")}</div>
          <div class="aura-bar" aria-hidden="true">${auraBar(a.progressPct || 0)}</div>
          <small>${a.remainingToNext != null ? `Próximo nível: +${a.remainingToNext}` : "Nível máximo"}</small>
        </div>
      </div>
      <div class="achievements-row">
        ${(data.achievements || [])
          .map(
            (x) =>
              `<span class="ach-chip ${x.unlocked ? "on" : "off"}" title="${x.minAnswers} Q">${x.unlocked ? "✅" : "⬜"} ${escapeHtml(x.title)}</span>`
          )
          .join("")}
      </div>
      <div class="inventory-grid">
        ${(data.inventory || [])
          .map(
            (it) =>
              `<button type="button" class="inv-card ${it.equipped ? "equipped" : ""}" data-equip="${escapeHtml(it.item_key)}">${escapeHtml(it.name || it.item_key)}${it.equipped ? " · equipado" : ""}${it.qty > 1 ? ` ×${it.qty}` : ""}</button>`
          )
          .join("") || "<p class='empty-state'>Inventário vazio — visite o Portal.</p>"}
      </div>
      ${
        data.aplicacao
          ? `<p class="report-sub">🏦 Aplicação: ${data.aplicacao.principal} → ${data.aplicacao.return_amount} até ${data.aplicacao.matures_day}</p>`
          : ""
      }
    `;
    body.querySelectorAll(".counter-value[data-count]").forEach((el) => {
      const target = Number(el.getAttribute("data-count") || 0);
      let n = 0;
      const step = Math.max(1, Math.ceil(target / 24));
      const t = setInterval(() => {
        n = Math.min(target, n + step);
        el.textContent = String(n);
        if (n >= target) clearInterval(t);
      }, 30);
    });
    body.querySelectorAll("[data-equip]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const itemKey = btn.getAttribute("data-equip");
        const r = await fetch(API.shopPost, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "equip", userJid: sel.value, itemKey })
        });
        const j = await r.json();
        if (!r.ok) alert(j.error || "Erro ao equipar");
        else renderProfile();
      });
    });
  }

  const CAT_LABELS = {
    assistencias: "Assistências",
    cosmeticos: "Cosméticos",
    aura: "Aura",
    protecao: "Proteção"
  };

  async function renderShop() {
    const grid = document.getElementById("shop-grid");
    const tabs = document.getElementById("shop-tabs");
    const bal = document.getElementById("shop-balance");
    const userSel = document.getElementById("shop-user-select");
    if (!grid || !tabs) return;

    const res = await fetch(`${API.economy}?view=shop`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Loja indisponível");
    eco.shopItems = data.items || [];

    const cats = ["all", ...new Set(eco.shopItems.map((i) => i.category))];
    tabs.innerHTML = cats
      .map(
        (c) =>
          `<button type="button" class="shop-tab ${eco.shopTab === c ? "active" : ""}" data-cat="${c}">${c === "all" ? "Todos" : CAT_LABELS[c] || c}</button>`
      )
      .join("");
    tabs.querySelectorAll(".shop-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        eco.shopTab = btn.getAttribute("data-cat");
        renderShop();
      });
    });

    if (userSel && userSel.value) {
      const pr = await fetch(`${API.economy}?userJid=${encodeURIComponent(userSel.value)}`);
      const pd = await pr.json();
      if (pr.ok && bal) {
        bal.innerHTML = `💰 <strong>${pd.availableCredits || 0}</strong> Créditos disponíveis · ✨ ${pd.economy?.aura || 0} Aura`;
      }
    } else if (bal) bal.innerHTML = "";

    const list =
      eco.shopTab === "all" ? eco.shopItems : eco.shopItems.filter((i) => i.category === eco.shopTab);
    grid.innerHTML = list
      .map((it) => {
        const locked = false;
        return `<article class="shop-card" data-key="${escapeHtml(it.item_key)}">
          <div class="shop-card-emoji">${it.category === "protecao" ? "🛡️" : it.category === "aura" ? "✨" : it.category === "assistencias" ? "🧩" : "🎨"}</div>
          <h3>${escapeHtml(it.name)}</h3>
          <p class="shop-price">${it.price_credits} Créditos${it.min_aura ? ` · Aura≥${it.min_aura}` : ""}</p>
          <button type="button" class="btn-reveal shop-buy" data-buy="${escapeHtml(it.item_key)}" ${locked ? "disabled" : ""}>Comprar</button>
        </article>`;
      })
      .join("");

    grid.querySelectorAll("[data-buy]").forEach((btn) => {
      btn.addEventListener("click", () => buyItem(btn.getAttribute("data-buy"), btn));
    });
  }

  async function buyItem(itemKey, btn) {
    const userSel = document.getElementById("shop-user-select");
    const status = document.getElementById("shop-status");
    if (!userSel || !userSel.value) {
      alert("Selecione quem é você.");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Aguardando WhatsApp…";
    if (status) status.textContent = "Pedido criado. Confirme com *sim* no privado do bot.";
    const res = await fetch(API.shopPost, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userJid: userSel.value, itemKey })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Falha na compra");
      btn.disabled = false;
      btn.textContent = "Comprar";
      return;
    }
    if (eco.pollTimer) clearInterval(eco.pollTimer);
    eco.pollTimer = setInterval(async () => {
      const st = await fetch(`${API.economy}?view=shop&token=${encodeURIComponent(data.token)}`);
      const sj = await st.json();
      if (!st.ok) return;
      if (sj.status === "confirmed") {
        clearInterval(eco.pollTimer);
        if (status) status.textContent = "📄 Despesa empenhada! Item no inventário.";
        btn.textContent = "Comprado ✓";
        document.getElementById("shop-grid")?.classList.add("shop-success-flash");
        renderShop();
      } else if (sj.status === "cancelled" || sj.status === "expired") {
        clearInterval(eco.pollTimer);
        if (status) status.textContent = "Pedido cancelado ou expirado.";
        btn.disabled = false;
        btn.textContent = "Comprar";
      }
    }, 2000);
  }

  async function renderDiario() {
    const feed = document.getElementById("diario-feed");
    const dayEl = document.getElementById("diario-day");
    const userEl = document.getElementById("diario-user");
    if (!feed) return;
    if (dayEl && !dayEl.value) {
      const d = new Date();
      dayEl.value = d.toISOString().slice(0, 10);
    }
    const params = new URLSearchParams({ view: "diario" });
    if (dayEl?.value) params.set("day", dayEl.value);
    if (userEl?.value?.trim()) params.set("userJid", userEl.value.trim());
    const res = await fetch(`${API.diario}?${params}`);
    const data = await res.json();
    if (!res.ok) {
      feed.innerHTML = `<p class="error-banner">${data.error || "Erro"}</p>`;
      return;
    }
    if (!data.events?.length) {
      feed.innerHTML = "<p class='empty-state'>Nenhum evento neste filtro.</p>";
      return;
    }
    feed.innerHTML = data.events
      .map(
        (ev) =>
          `<article class="diario-item"><time>${escapeHtml(String(ev.created_at || "").replace("T", " ").slice(0, 19))}</time><p>${escapeHtml(ev.label || "")}</p></article>`
      )
      .join("");
  }

  async function renderRankings(board) {
    const body = document.getElementById("rankings-body");
    if (!body) return;
    const res = await fetch(
      `${API.rankings}?view=rankings&board=${encodeURIComponent(board || "aura")}`
    );
    const data = await res.json();
    if (!res.ok) {
      body.innerHTML = `<p class="error-banner">${data.error || "Erro"}</p>`;
      return;
    }
    body.innerHTML = `<ol class="rankings-list">${(data.rows || [])
      .map(
        (r, i) =>
          `<li><span class="rank-pos">${i + 1}</span> <span class="rank-name">${escapeHtml(r.label)}${r.title ? ` · <em>${escapeHtml(r.title)}</em>` : ""}</span> <strong>${Number(r.value).toLocaleString("pt-BR")}</strong></li>`
      )
      .join("")}</ol>`;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  document.getElementById("btn-profile-open")?.addEventListener("click", async () => {
    try {
      await loadEconomyMembers();
      openOverlay("profile-overlay");
      await renderProfile();
    } catch (e) {
      alert(e.message);
    }
  });
  document.getElementById("profile-close")?.addEventListener("click", () => closeOverlay("profile-overlay"));
  document.getElementById("profile-user-select")?.addEventListener("change", () => renderProfile());

  document.getElementById("btn-shop-open")?.addEventListener("click", async () => {
    try {
      await loadEconomyMembers();
      openOverlay("shop-overlay");
      await renderShop();
    } catch (e) {
      alert(e.message);
    }
  });
  document.getElementById("shop-close")?.addEventListener("click", () => closeOverlay("shop-overlay"));
  document.getElementById("shop-user-select")?.addEventListener("change", () => renderShop());

  document.getElementById("btn-diario-open")?.addEventListener("click", async () => {
    openOverlay("diario-overlay");
    try {
      await renderDiario();
    } catch (e) {
      alert(e.message);
    }
  });
  document.getElementById("diario-close")?.addEventListener("click", () => closeOverlay("diario-overlay"));
  document.getElementById("diario-reload")?.addEventListener("click", () => renderDiario());

  document.getElementById("btn-rankings-open")?.addEventListener("click", async () => {
    openOverlay("rankings-overlay");
    await renderRankings("aura");
  });
  document.getElementById("rankings-close")?.addEventListener("click", () => closeOverlay("rankings-overlay"));
  document.getElementById("rankings-tabs")?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-board]");
    if (!btn) return;
    document.querySelectorAll("#rankings-tabs .shop-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderRankings(btn.getAttribute("data-board"));
  });
})();

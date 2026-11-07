(function () {
  "use strict";

  const STORAGE_USER = "papaVagasHubUser";
  const API = {
    members: "/api/economy?view=members",
    atividades: (qs) => `/api/atividades?${qs}`,
    post: "/api/atividades",
    session: (t) => `/api/omissas-session?t=${encodeURIComponent(t)}`,
    answer: "/api/omissas-answer",
    assist: "/api/omissas-assist",
    via: (t, shortId) =>
      `/api/omissas-via?t=${encodeURIComponent(t)}&shortId=${encodeURIComponent(shortId)}`,
    results: (t) => `/api/omissas-results?t=${encodeURIComponent(t)}`,
    userCategories: "/api/user-categories",
    answerCategories: "/api/answer-categories"
  };

  const $ = (id) => document.getElementById(id);
  const quizUi = window.PapaQuizUi;

  let userJid = "";
  let userName = "";
  let view = "day";
  let weekAnchor = null;
  let monthAnchor = null;
  let selectedDays = new Set();
  let weekData = null;
  let monthData = null;
  let currentConfidence = "seguro";
  let wantsDiscussion = false;
  let questionOpenedAt = 0;

  // quiz state
  let token = "";
  let pending = [];
  let index = 0;
  let submitting = false;
  let assistQty = 0;
  let quizUserName = "";
  let assistMode = false;
  let assistBusy = false;
  /** @type {{ id: number, name: string }[]} */
  let userCategories = [];
  /** @type {Set<number>} */
  let selectedCategoryIds = new Set();
  /** @type {Map<string, number[]>} draft category picks per shortId while navigating */
  let draftCatsByShortId = new Map();
  let catsPanelOpen = false;
  let selectedLetter = null;
  let eliminated = new Set();
  let resultsTimer = 0;
  /** @type {Map<string, Promise<any>>} */
  let pendingSaves = new Map();
  let advancing = false;
  let aiPollTimer = 0;
  let refreshSeq = 0;
  let histOutcome = "all";
  let histOffset = 0;
  let histItems = [];
  let histHasMore = false;
  let erradasBusy = false;

  const timer = quizUi.createTimer({
    timer: $("q-timer"),
    hint: $("q-timer-hint"),
    pauseBtn: $("q-timer-pause"),
    resetBtn: $("q-timer-reset")
  });

  function stopAiPoll() {
    if (aiPollTimer) {
      clearInterval(aiPollTimer);
      aiPollTimer = 0;
    }
  }

  function startAiPoll(shortId) {
    stopAiPoll();
    if (!shortId) return;
    quizUi.paintAiComment("", { pending: true });
    let n = 0;
    aiPollTimer = setInterval(() => {
      n += 1;
      if (n > 20) {
        stopAiPoll();
        quizUi.paintAiComment("", { warn: true });
        return;
      }
      void fetchJson(API.via(token, shortId))
        .then((data) => {
          const ai = data && data.aiComment ? String(data.aiComment).trim() : "";
          if (!ai) return;
          const q = pending[index];
          if (!q || q.shortId !== shortId) return;
          q.yourAiComment = ai;
          quizUi.paintAiComment(ai);
          stopAiPoll();
        })
        .catch(() => {});
    }, 4000);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function syncConfidenceUi() {
    document.querySelectorAll(".btn-conf").forEach((btn) => {
      const on = btn.dataset.conf === currentConfidence;
      btn.style.background = on ? "#1e293b" : "#fff";
      btn.style.color = on ? "#fff" : "#334155";
      btn.style.border = "1px solid #cbd5e1";
      btn.style.borderRadius = "6px";
      btn.style.padding = "4px 10px";
      btn.style.fontSize = "12px";
    });
    const hint = $("q-conf-hint");
    if (hint) hint.textContent = currentConfidence === "seguro" ? "(Seguro — padrão)" : "";
  }

  function syncDiscussUi() {
    document.querySelectorAll(".btn-discuss").forEach((btn) => {
      btn.style.background = wantsDiscussion ? "#1e293b" : "#fff";
      btn.style.color = wantsDiscussion ? "#fff" : "#334155";
      btn.style.border = "1px solid #cbd5e1";
      btn.style.borderRadius = "6px";
      btn.style.padding = "4px 10px";
      btn.style.fontSize = "12px";
    });
  }

  document.addEventListener("click", (ev) => {
    const discussBtn = ev.target && ev.target.closest && ev.target.closest(".btn-discuss");
    if (discussBtn) {
      const q = pending[index];
      wantsDiscussion = !wantsDiscussion;
      if (q) {
        q.wantsDiscussion = wantsDiscussion;
        q.dirty = true;
        if (q.yourLetter || q.yourAnswer || selectedLetter) {
          saveDraftForCurrent();
          void saveAnswerInBackground(q);
        }
      }
      syncDiscussUi();
      return;
    }
    const btn = ev.target && ev.target.closest && ev.target.closest(".btn-conf");
    if (!btn) return;
    const q = pending[index];
    const key = btn.dataset.conf;
    currentConfidence = currentConfidence === key ? "seguro" : key;
    if (q) {
      q.yourConfidence = currentConfidence;
      q.dirty = true;
    }
    syncConfidenceUi();
  });

  function statusLabel(s) {
    if (s === "feito") return "feito";
    if (s === "atrasado") return "atrasado";
    if (s === "hoje") return "hoje";
    if (s === "pendente") return "a fazer";
    if (s === "passou") return "—";
    return s || "—";
  }

  async function fetchJson(url, opts) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(opts && opts.headers) },
      ...opts
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || res.statusText || "Erro");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function showStatus(msg) {
    const el = $("atv-status");
    if (!msg) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.classList.remove("hidden");
    el.textContent = msg;
  }

  function setGate(hasUser) {
    $("atv-gate").classList.toggle("hidden", hasUser);
    $("atv-main").classList.toggle("hidden", !hasUser);
    if (hasUser) void loadUserCategories();
  }

  async function loadUserCategories() {
    if (!userJid) {
      userCategories = [];
      renderManageCatsList();
      return;
    }
    try {
      const data = await fetchJson(`${API.userCategories}?userJid=${encodeURIComponent(userJid)}`);
      userCategories = data.categories || [];
      renderManageCatsList();
      renderQuizCategoryToggles();
    } catch (e) {
      const st = $("atv-cats-status");
      if (st) st.textContent = e.message || "Erro ao carregar categorias";
    }
  }

  function renderManageCatsList() {
    const list = $("atv-cats-list");
    if (!list) return;
    if (!userCategories.length) {
      list.innerHTML =
        '<li class="atv-muted" style="background:transparent;font-weight:500">Nenhuma categoria ainda.</li>';
      return;
    }
    list.innerHTML = userCategories
      .map(
        (c) => `<li>
          <span>${esc(c.name)}</span>
          <button type="button" class="atv-cat-del" data-id="${esc(String(c.id))}" aria-label="Apagar">×</button>
        </li>`
      )
      .join("");
    list.querySelectorAll(".atv-cat-del").forEach((btn) => {
      btn.addEventListener("click", () => deleteUserCategory(Number(btn.dataset.id)));
    });
  }

  async function createUserCategoryFromUi(nameInputId, statusId) {
    const input = $(nameInputId);
    const status = statusId ? $(statusId) : null;
    const name = input ? String(input.value || "").trim() : "";
    if (!userJid) {
      if (status) status.textContent = "Selecione quem você é.";
      return null;
    }
    if (!name) {
      if (status) status.textContent = "Informe o nome.";
      return null;
    }
    try {
      const data = await fetchJson(API.userCategories, {
        method: "POST",
        body: JSON.stringify({ userJid, name })
      });
      const cat = data.category;
      if (cat && !userCategories.some((c) => Number(c.id) === Number(cat.id))) {
        userCategories.push(cat);
        userCategories.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      }
      if (input) input.value = "";
      if (status) {
        status.textContent = cat?.alreadyExisted
          ? `“${cat.name}” já existia.`
          : `Categoria “${cat?.name || name}” criada.`;
      }
      renderManageCatsList();
      renderQuizCategoryToggles();
      return cat;
    } catch (e) {
      if (status) status.textContent = e.message || "Erro ao criar.";
      return null;
    }
  }

  async function deleteUserCategory(categoryId) {
    if (!userJid || !categoryId) return;
    const st = $("atv-cats-status");
    try {
      const data = await fetchJson(API.userCategories, {
        method: "POST",
        body: JSON.stringify({ userJid, action: "delete", categoryId })
      });
      userCategories = data.categories || userCategories.filter((c) => Number(c.id) !== categoryId);
      selectedCategoryIds.delete(categoryId);
      renderManageCatsList();
      renderQuizCategoryToggles();
      if (st) st.textContent = "Categoria removida.";
    } catch (e) {
      if (st) st.textContent = e.message || "Erro ao apagar.";
    }
  }

  function catKey(q) {
    return String(q && q.shortId ? q.shortId : "").toUpperCase();
  }

  function saveDraftCatsForCurrent() {
    const q = pending[index];
    if (!q) return;
    const ids = Array.from(selectedCategoryIds);
    draftCatsByShortId.set(catKey(q), ids);
    q.categoryIds = ids;
  }

  function loadDraftCatsForCurrent() {
    const q = pending[index];
    selectedCategoryIds = new Set();
    if (!q) return;
    const draft = draftCatsByShortId.get(catKey(q));
    if (draft) {
      selectedCategoryIds = new Set(draft.map(Number));
      return;
    }
    if (Array.isArray(q.categoryIds) && q.categoryIds.length) {
      selectedCategoryIds = new Set(q.categoryIds.map(Number));
    }
  }

  function sessionAllAnswered() {
    return pending.length > 0 && pending.every((q) => q.alreadyAnswered);
  }

  function quizIsOpen() {
    const wrap = $("atv-quiz-wrap");
    const quiz = $("omissas-quiz");
    return Boolean(
      wrap &&
        quiz &&
        !wrap.classList.contains("hidden") &&
        !quiz.classList.contains("hidden")
    );
  }

  function cancelScheduledResults() {
    if (resultsTimer) {
      window.clearTimeout(resultsTimer);
      resultsTimer = 0;
    }
  }

  function scheduleShowResultsIfComplete() {
    cancelScheduledResults();
    if (!sessionAllAnswered()) return;
    void showResults();
  }

  function saveDraftForCurrent() {
    const q = pending[index];
    if (!q) return;
    const commentEl = $("q-comment");
    if (commentEl) q.yourComment = commentEl.value || "";
    q.yourConfidence = currentConfidence;
    q.wantsDiscussion = wantsDiscussion;
    if (selectedLetter) {
      q.yourLetter = selectedLetter;
      q.yourAnswer = selectedLetter;
    }
    saveDraftCatsForCurrent();
  }

  function showQuizStatus(msg) {
    const st = $("q-status");
    if (!st) return;
    if (!msg) {
      st.classList.add("hidden");
      st.textContent = "";
      return;
    }
    st.classList.remove("hidden");
    st.textContent = msg;
  }

  function saveAnswerInBackground(q) {
    if (!q || !token) return Promise.resolve();
    const letter = String(q.yourLetter || q.yourAnswer || "").toLowerCase();
    if (!letter) return Promise.resolve();
    const sid = catKey(q);
    const seq = (q.saveSeq = (q.saveSeq || 0) + 1);
    const payload = {
      t: token,
      shortId: q.shortId,
      letter,
      comment: q.yourComment || "",
      categoryIds: Array.isArray(q.categoryIds) ? q.categoryIds : Array.from(selectedCategoryIds),
      confidenceLevel: q.yourConfidence || "seguro",
      wantsDiscussion: q.wantsDiscussion === true,
      durationMs: q.durationMs != null ? q.durationMs : timer.elapsed(),
      checkComplete: sessionAllAnswered()
    };
    const p = fetchJson(API.answer, {
      method: "POST",
      body: JSON.stringify(payload)
    })
      .then((data) => {
        if (q.saveSeq !== seq) return;
        q.yourLetter = data.yourAnswer || letter;
        q.yourAnswer = q.yourLetter;
        q.answerKey = data.answerKey;
        q.correct = data.correct;
        if (data.durationMs != null) q.durationMs = data.durationMs;
        q.dirty = false;
        q.saveError = null;
        if (pending[index] && pending[index].shortId === q.shortId) {
          showQuizStatus("");
        }
      })
      .catch((e) => {
        if (q.saveSeq !== seq) return;
        q.saveError = e.message || "Erro ao salvar.";
        if (pending[index] && pending[index].shortId === q.shortId) {
          showQuizStatus(q.saveError);
          paintCurrentChoices();
        }
      })
      .finally(() => {
        if (pendingSaves.get(sid) === p) pendingSaves.delete(sid);
      });
    pendingSaves.set(sid, p);
    return p;
  }

  function advanceAfterResolve() {
    cancelScheduledResults();
    setCatsPanelOpen(false);
    const next = index + 1;
    if (next < pending.length) {
      index = next;
      renderQuestion();
      return;
    }
    if (sessionAllAnswered()) {
      void showResults();
      return;
    }
    const firstOpen = pending.findIndex((item) => !item.alreadyAnswered);
    if (firstOpen >= 0) {
      index = firstOpen;
      renderQuestion();
    }
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = String(el.tagName || "").toUpperCase();
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag === "INPUT") {
      const type = String(el.type || "text").toLowerCase();
      return type !== "button" && type !== "checkbox" && type !== "radio" && type !== "submit";
    }
    return Boolean(el.isContentEditable);
  }

  async function persistCatsIfAnswered() {
    const q = pending[index];
    if (!q || !q.alreadyAnswered || !userJid) return;
    const ids = Array.from(selectedCategoryIds);
    q.categoryIds = ids;
    draftCatsByShortId.set(catKey(q), ids);
    try {
      await fetchJson(API.answerCategories, {
        method: "POST",
        body: JSON.stringify({ userJid, shortId: q.shortId, categoryIds: ids })
      });
    } catch (e) {
      const st = $("q-status");
      if (st) {
        st.classList.remove("hidden");
        st.textContent = e.message || "Erro ao salvar categorias.";
      }
    }
  }

  function formatAssistDetail(q) {
    if (!q || !q.assistUsed || !q.assistReveal) return null;
    const r = q.assistReveal;
    const L = (r.letter || r.removed || "?").toString().toUpperCase();
    if (r.isCorrect === true) return `Utilizado item Verificar alternativa · ${L} é verdadeira`;
    return `Utilizado item Verificar alternativa · ${L} é falsa`;
  }

  function updateQuestionDetails() {
    const el = $("q-details-text");
    if (!el) return;
    const parts = [];
    const selected = userCategories.filter((c) => selectedCategoryIds.has(Number(c.id)));
    if (selected.length) {
      parts.push(`Categorias: <strong>${esc(selected.map((c) => c.name).join(", "))}</strong>`);
    } else {
      parts.push("Questão sem categoria");
    }
    const q = pending[index];
    const assistLine = formatAssistDetail(q);
    if (assistLine) parts.push(esc(assistLine));
    el.innerHTML = parts.join(" · ");
  }

  function navigateQuiz(delta) {
    if (!pending.length || advancing) return;
    cancelScheduledResults();
    saveDraftForCurrent();
    const q = pending[index];
    if (q && q.alreadyAnswered && q.dirty) void saveAnswerInBackground(q);
    setCatsPanelOpen(false);
    const next = index + delta;
    if (delta > 0 && next >= pending.length && sessionAllAnswered()) {
      void showResults();
      return;
    }
    if (next < 0 || next >= pending.length) return;
    index = next;
    renderQuestion();
  }

  function syncQuizNavButtons() {
    const prevBtns = [$("q-prev"), $("q-prev-bottom")].filter(Boolean);
    const nextBtns = [$("q-next"), $("q-next-bottom")].filter(Boolean);
    const allDone = sessionAllAnswered();
    const canGoResults = allDone && index >= pending.length - 1;
    const nextTitle = canGoResults ? "Ver resultado da seção (→)" : "Próxima (→)";
    prevBtns.forEach((prev) => {
      prev.disabled = advancing || index <= 0;
      prev.title = "Anterior (←)";
    });
    nextBtns.forEach((next) => {
      next.disabled = advancing || (index >= pending.length - 1 && !canGoResults);
      if (next.id === "q-next-bottom") {
        next.textContent = canGoResults ? "Ver resultado ›" : "Próxima ›";
      } else {
        next.textContent = canGoResults ? "Resultado ›" : "Próx. ›";
      }
      next.title = nextTitle;
    });
  }

  function addDaysIso(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    dt.setUTCDate(dt.getUTCDate() + n);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  function startOfWeekMonday(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const utcDay = dt.getUTCDay();
    const idx = utcDay === 0 ? 6 : utcDay - 1;
    return addDaysIso(iso, -idx);
  }

  async function loadMembers() {
    const data = await fetchJson(API.members);
    const members = data.members || data.items || data || [];
    const list = Array.isArray(members) ? members : [];
    const sel = $("atv-user");
    sel.innerHTML = `<option value="">— escolher —</option>`;
    for (const m of list) {
      const jid = m.userJid || m.user_jid || m.jid || "";
      if (!jid) continue;
      const label =
        m.displayLabel ||
        m.displayName ||
        m.quizDisplayName ||
        m.quiz_display_name ||
        m.userLabel ||
        m.user_label ||
        m.name ||
        "Participante";
      const opt = document.createElement("option");
      opt.value = jid;
      opt.textContent = label;
      sel.appendChild(opt);
    }
    const saved = localStorage.getItem(STORAGE_USER) || "";
    if (saved && [...sel.options].some((o) => o.value === saved)) {
      sel.value = saved;
      userJid = saved;
      userName = sel.options[sel.selectedIndex]?.textContent || "";
    }
  }

  function paintView(next) {
    view = next;
    document.querySelectorAll(".atv-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === next);
    });
    $("panel-day").classList.toggle("hidden", next !== "day");
    $("panel-week").classList.toggle("hidden", next !== "week");
    $("panel-month").classList.toggle("hidden", next !== "month");
    $("panel-historico").classList.toggle("hidden", next !== "historico");
    if (next === "historico") {
      history.replaceState(null, "", "#historico");
    } else if (location.hash === "#historico") {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function switchView(next) {
    paintView(next);
    selectedDays.clear();
    updateSelectedLabels();
    void refresh();
  }

  async function refresh() {
    if (!userJid) return;
    const seq = ++refreshSeq;
    if (view === "day") {
      const btnHoje = $("btn-responder-hoje");
      const btnAtr = $("btn-atrasadas");
      if (btnHoje) btnHoje.disabled = true;
      if (btnAtr) btnAtr.disabled = true;
    }
    showStatus("Carregando…");
    try {
      if (view === "day") await loadDay(seq);
      else if (view === "week") await loadWeek();
      else if (view === "month") await loadMonth();
      else if (view === "historico") await loadHistorico(seq, { append: false });
      if (seq !== refreshSeq) return;
      showStatus("");
    } catch (e) {
      if (seq !== refreshSeq) return;
      showStatus(e.message || "Erro ao carregar");
    }
  }

  async function loadDay(seq) {
    const data = await fetchJson(
      API.atividades(`view=day&userJid=${encodeURIComponent(userJid)}`)
    );
    if (seq != null && seq !== refreshSeq) return;
    $("day-subtitle").textContent = `Hoje ${data.dayIso || data.todayIso || ""}`;

    const body = $("day-body");
    const cards = data.byCaderno || [];
    const calendarPending = Array.isArray(data.shortIds) ? data.shortIds : [];
    const hojeIds = data.todayShortIds || [];
    const pendingToday = [...new Set([...calendarPending, ...hojeIds].map((id) => String(id)))];
    const openHoje = pendingToday.length;
    $("hoje-count").textContent =
      openHoje > 0
        ? `${openHoje} pendente(s) de hoje`
        : "Nenhuma omissa de hoje";

    if (!cards.length) {
      body.innerHTML = `<p class="atv-muted">Você não está engajado em cadernos ativos.</p>`;
    } else {
      body.innerHTML = cards
        .map((c) => {
          const pending = c.pendingShortIds || [];
          const open = pending.length || Math.max(0, (c.totalCount || 0) - (c.answeredCount || 0));
          const ids =
            pending.length > 0
              ? `<p class="atv-id-list">${pending.map((id) => `#${esc(id)}`).join(" ")}</p>`
              : "";
          return `<article class="atv-caderno-card">
            <h3>#${esc(c.cadernoId)} ${esc(c.name)}</h3>
            <p class="atv-muted">${statusLabel(c.status)} · ${c.answeredCount || 0}/${c.totalCount || 0} respondidas
            ${open > 0 ? ` · ${open} pendente(s)` : ""}</p>
            ${ids}
          </article>`;
        })
        .join("");
    }

    const atrasadas = data.atrasadasShortIds || [];
    $("atrasadas-count").textContent =
      atrasadas.length > 0
        ? `${atrasadas.length} atrasada(s) (não contam no streak)`
        : "Nenhuma atrasada";
    const atrasadasBody = $("atrasadas-body");
    if (!atrasadas.length) {
      atrasadasBody.innerHTML = `<p class="atv-muted">Backlog zerado. Bom trabalho!</p>`;
    } else {
      atrasadasBody.innerHTML = `<article class="atv-caderno-card atv-atrasadas-card">
        <h3>Backlog em aberto</h3>
        <p class="atv-muted">Questões de dias anteriores ainda sem resposta.</p>
        <p class="atv-id-list">${atrasadas.map((id) => `#${esc(id)}`).join(" ")}</p>
      </article>`;
    }

    $("btn-responder-hoje").disabled = pendingToday.length === 0;
    $("btn-atrasadas").disabled = atrasadas.length === 0;
  }

  async function loadWeek() {
    if (!weekAnchor) weekAnchor = null;
    const qs = new URLSearchParams({ view: "week", userJid });
    if (weekAnchor) qs.set("weekStart", weekAnchor);
    weekData = await fetchJson(API.atividades(qs.toString()));
    weekAnchor = weekData.weekStart;
    $("week-range").textContent = `${weekData.weekStart} → ${weekData.weekEnd}`;
    const grid = $("week-grid");
    grid.innerHTML = (weekData.days || [])
      .map((d) => {
        const sel = selectedDays.has(d.dayIso) ? " selected" : "";
        const selectable = d.selectable ? " selectable" : "";
        return `<button type="button" class="atv-day-cell${selectable}${sel}" data-day="${esc(
          d.dayIso
        )}" data-status="${esc(d.status)}" data-selectable="${d.selectable ? "1" : "0"}">
          <span class="wd">${esc((d.weekday || "").slice(0, 3))}</span>
          <span class="dn">${esc((d.dayIso || "").slice(8))}</span>
          <span class="st">${esc(statusLabel(d.status))}</span>
        </button>`;
      })
      .join("");
    grid.querySelectorAll(".atv-day-cell.selectable").forEach((btn) => {
      btn.addEventListener("click", () => toggleDay(btn.dataset.day));
    });
    updateSelectedLabels();
  }

  async function loadMonth() {
    const qs = new URLSearchParams({ view: "month", userJid });
    if (monthAnchor) qs.set("month", monthAnchor);
    monthData = await fetchJson(API.atividades(qs.toString()));
    monthAnchor = monthData.month;
    const [y, m] = (monthData.month || "").split("-");
    const monthNames = [
      "",
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro"
    ];
    $("month-title").textContent = `${monthNames[Number(m)] || m} ${y}`;
    const c = monthData.counts || {};
    $("month-counts").textContent = `feito ${c.feito || 0} · atrasado ${c.atrasado || 0} · a fazer ${
      c.pendente || 0
    }`;

    const days = monthData.days || [];
    const first = days[0]?.dayIso;
    let pad = 0;
    if (first) {
      const [yy, mm, dd] = first.split("-").map(Number);
      const utcDay = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0)).getUTCDay();
      pad = utcDay === 0 ? 6 : utcDay - 1;
    }
    const dows = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]
      .map((d) => `<div class="dow">${d}</div>`)
      .join("");
    const empties = Array.from({ length: pad }, () => `<div class="atv-month-cell empty"></div>`).join(
      ""
    );
    const cells = days
      .map((d) => {
        const sel = selectedDays.has(d.dayIso) ? " selected" : "";
        const selectable = d.selectable ? " selectable" : "";
        return `<button type="button" class="atv-month-cell${selectable}${sel}" data-day="${esc(
          d.dayIso
        )}" data-status="${esc(d.status)}" data-selectable="${d.selectable ? "1" : "0"}">
          <span>${esc((d.dayIso || "").slice(8))}</span>
        </button>`;
      })
      .join("");
    $("month-grid").innerHTML = dows + empties + cells;
    $("month-grid").querySelectorAll(".atv-month-cell.selectable").forEach((btn) => {
      btn.addEventListener("click", () => toggleDay(btn.dataset.day));
    });
    updateSelectedLabels();
  }

  function toggleDay(dayIso) {
    if (!dayIso) return;
    if (selectedDays.has(dayIso)) selectedDays.delete(dayIso);
    else selectedDays.add(dayIso);
    document.querySelectorAll(`[data-day="${dayIso}"]`).forEach((el) => {
      el.classList.toggle("selected", selectedDays.has(dayIso));
    });
    updateSelectedLabels();
  }

  function updateSelectedLabels() {
    const n = selectedDays.size;
    const label = n ? `${n} dia(s) selecionado(s)` : "Selecione dias futuros";
    $("week-selected-label").textContent = label;
    $("month-selected-label").textContent = label;
    $("btn-adiantar-week").disabled = n === 0;
    $("btn-adiantar-month").disabled = n === 0;
  }

  async function adiantarSelected() {
    const dayIsos = [...selectedDays].sort();
    if (!dayIsos.length) return;
    showStatus("Adiantando…");
    try {
      const data = await fetchJson(API.post, {
        method: "POST",
        body: JSON.stringify({
          action: "adiantar",
          userJid,
          userName,
          dayIsos
        })
      });
      showStatus(data.summary || data.message || "Ok");
      selectedDays.clear();
      await refresh();
      if (data.token) await openQuiz(data.token);
    } catch (e) {
      showStatus(e.message || "Erro ao adiantar");
    }
  }

  async function startSession(mode) {
    showStatus("Abrindo sessão…");
    try {
      const data = await fetchJson(API.post, {
        method: "POST",
        body: JSON.stringify({ action: "session", userJid, userName, mode })
      });
      if (!data.token) {
        showStatus(data.message || "Nada pendente.");
        return;
      }
      showStatus("");
      await openQuiz(data.token);
    } catch (e) {
      showStatus(e.message || "Erro ao abrir sessão");
    }
  }

  function showQuizWrap(on) {
    $("atv-quiz-wrap").classList.toggle("hidden", !on);
    $("atv-main").classList.toggle("hidden", on || !userJid);
  }

  function erradasStorageKey() {
    return `papaVagasErradas:${userJid}`;
  }

  function readErradasSession() {
    if (!userJid) return null;
    try {
      const raw = localStorage.getItem(erradasStorageKey());
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.token) return null;
      return data;
    } catch {
      return null;
    }
  }

  function writeErradasSession(data) {
    localStorage.setItem(erradasStorageKey(), JSON.stringify(data));
  }

  function syncContinueErradas() {
    const btn = $("btn-continuar-erradas");
    if (!btn) return;
    const saved = readErradasSession();
    btn.classList.toggle("hidden", !saved);
    if (saved && saved.name) btn.textContent = "Continuar última";
  }

  function letterLabel(letter, questionType) {
    const L = String(letter || "").toUpperCase();
    if (questionType === "true_false") {
      if (L === "C") return "Certo";
      if (L === "E") return "Errado";
    }
    return L || "—";
  }

  function formatWhen(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function renderHistList() {
    const list = $("hist-list");
    if (!list) return;
    if (!histItems.length) {
      const empty =
        histOutcome === "wrong"
          ? "Nenhuma errada nesse filtro."
          : histOutcome === "correct"
            ? "Nenhuma certa nesse filtro."
            : "Você ainda não tem questão resolvida por aqui.";
      list.innerHTML = `<p class="atv-muted">${empty}</p>`;
      return;
    }
    list.innerHTML = histItems
      .map((item) => {
        const ok = Boolean(item.correct);
        const meta = [
          `Marcou ${letterLabel(item.yourLetter, item.questionType)}`,
          item.answerKey ? `gabarito ${letterLabel(item.answerKey, item.questionType)}` : "",
          item.subject || "",
          item.cadernoName || ""
        ]
          .filter(Boolean)
          .join(" · ");
        return `<article class="hist-item ${ok ? "is-ok" : "is-wrong"}">
          <div class="hist-item-top">
            <span class="hist-badge ${ok ? "ok" : "bad"}">${ok ? "Acertou" : "Errou"}</span>
            <span class="hist-when">${esc(formatWhen(item.answeredAt))}</span>
            <span class="hist-id">#${esc(item.shortId || item.questionId)}</span>
          </div>
          <p class="hist-snippet">${esc(item.snippet || "Questão sem enunciado")}</p>
          <p class="hist-meta">${esc(meta)}</p>
        </article>`;
      })
      .join("");
  }

  async function loadHistorico(seq, opts) {
    const append = Boolean(opts && opts.append);
    if (!append) {
      histOffset = 0;
      histItems = [];
    }
    const qs = new URLSearchParams({
      view: "historico",
      userJid,
      outcome: histOutcome,
      offset: String(append ? histOffset : 0),
      limit: "40"
    });
    const data = await fetchJson(API.atividades(qs.toString()));
    if (seq != null && seq !== refreshSeq) return;
    const page = data.items || [];
    histItems = append ? histItems.concat(page) : page;
    histOffset = histItems.length;
    histHasMore = Boolean(data.hasMore);
    const who = userName ? ` de ${userName}` : "";
    $("hist-subtitle").textContent = `Questões resolvidas${who}.`;
    $("hist-counts").textContent = `${data.total || 0} resolvidas · ${data.correctCount || 0} certas · ${
      data.wrongCount || 0
    } erradas`;
    renderHistList();
    $("btn-hist-more").classList.toggle("hidden", !histHasMore);
    syncContinueErradas();
  }

  function openErradasModal() {
    const status = $("erradas-modal-status");
    if (status) status.textContent = "";
    const input = $("erradas-days");
    if (input) input.value = "7";
    const confirm = $("erradas-confirm");
    if (confirm) confirm.disabled = false;
    $("erradas-modal").classList.remove("hidden");
    if (input) input.focus();
    if (input) input.select();
  }

  function closeErradasModal() {
    $("erradas-modal").classList.add("hidden");
  }

  async function confirmErradas() {
    if (erradasBusy) return;
    const input = $("erradas-days");
    const days = Number(input && input.value);
    const status = $("erradas-modal-status");
    if (!Number.isFinite(days) || days < 1) {
      if (status) status.textContent = "Informe um número de dias a partir de 1.";
      return;
    }
    erradasBusy = true;
    const confirm = $("erradas-confirm");
    if (confirm) confirm.disabled = true;
    if (status) status.textContent = "Montando o caderno…";
    try {
      const data = await fetchJson(API.post, {
        method: "POST",
        body: JSON.stringify({
          action: "erradas",
          userJid,
          userName,
          days: Math.round(days)
        })
      });
      if (!data.token) {
        if (status) status.textContent = data.message || "Nenhuma errada nesse período.";
        if (confirm) confirm.disabled = false;
        return;
      }
      writeErradasSession({
        token: data.token,
        cadernoId: data.cadernoId,
        name: data.name || ""
      });
      closeErradasModal();
      showStatus(data.message || "");
      await openQuiz(data.token);
    } catch (e) {
      if (status) status.textContent = e.message || "Erro ao criar o caderno";
      if (confirm) confirm.disabled = false;
    } finally {
      erradasBusy = false;
    }
  }

  async function continuarErradas() {
    const saved = readErradasSession();
    if (!saved) return;
    showStatus("Abrindo caderno…");
    try {
      await fetchJson(API.session(saved.token));
      showStatus("");
      await openQuiz(saved.token);
    } catch (e) {
      localStorage.removeItem(erradasStorageKey());
      syncContinueErradas();
      showStatus(e.message || "Essa sessão expirou. Crie de novo em Fazer erradas.");
    }
  }

  async function openQuiz(t) {
    cancelScheduledResults();
    const back = $("btn-close-quiz");
    if (back) {
      back.textContent = view === "historico" ? "← Voltar ao histórico" : "← Voltar ao calendário";
    }
    token = t;
    pending = [];
    index = 0;
    submitting = false;
    assistMode = false;
    assistBusy = false;
    assistQty = 0;
    quizUserName = userName || "";
    draftCatsByShortId = new Map();
    selectedCategoryIds = new Set();
    showQuizWrap(true);
    $("omissas-error").classList.add("hidden");
    $("omissas-results").classList.add("hidden");
    $("omissas-quiz").classList.add("hidden");
    $("omissas-loading").classList.remove("hidden");
    $("omissas-loading").textContent = "Carregando questões…";

    try {
      await loadUserCategories();
      const data = await fetchJson(API.session(token));
      assistQty = data.assistEliminateQty || 0;
      if (data.userName) quizUserName = data.userName;
      pending = (data.questions || []).filter((q) => !q.missing);
      for (const q of pending) {
        if (Array.isArray(q.categoryIds) && q.categoryIds.length) {
          draftCatsByShortId.set(catKey(q), q.categoryIds.map(Number));
        }
      }
      if (!pending.length) {
        $("omissas-loading").classList.add("hidden");
        $("omissas-error").classList.remove("hidden");
        $("omissas-error").textContent = "Nenhuma questão pendente nesta sessão.";
        return;
      }
      if (pending.every((q) => q.alreadyAnswered) || data.completedAt) {
        await showResults();
        return;
      }
      const firstOpen = pending.findIndex((q) => !q.alreadyAnswered);
      index = firstOpen >= 0 ? firstOpen : 0;
      renderQuestion();
    } catch (e) {
      $("omissas-loading").classList.add("hidden");
      $("omissas-error").classList.remove("hidden");
      $("omissas-error").textContent = e.message || "Não foi possível abrir a sessão.";
    }
  }

  function firstName(name) {
    const t = String(name || "").trim();
    if (!t || t === "Participante") return "";
    return t.split(/\s+/)[0];
  }

  function paintCurrentChoices() {
    const q = pending[index];
    const hint = $("q-choices-hint");
    const btn = $("btn-resolve");
    if (hint) hint.classList.remove("hidden");
    if (btn) {
      btn.disabled = !selectedLetter || advancing;
      btn.textContent = q && q.alreadyAnswered ? "Atualizar e próxima" : "Resolver questão";
    }
    quizUi.paintChoices($("q-choices"), {
      selected: selectedLetter,
      eliminated,
      locked: advancing,
      answerKey: "",
      yourLetter: (q && (q.yourLetter || q.yourAnswer)) || selectedLetter,
      showResult: false
    });
    quizUi.fillResult($("q-result"), null);
    const resultsBtn = $("btn-atv-results");
    if (resultsBtn) {
      resultsBtn.classList.toggle("hidden", !sessionAllAnswered());
    }
  }

  function bindCurrentChoices(q) {
    quizUi.bindChoices($("q-choices"), {
      assistMode: () => assistMode,
      isLocked: () => advancing,
      onAssist: (letter) => useAssistOnLetter(letter),
      onSelect: (letter) => {
        const cur = pending[index];
        if (!cur || advancing) return;
        selectedLetter = letter;
        cur.yourLetter = letter;
        cur.yourAnswer = letter;
        cur.dirty = true;
        paintCurrentChoices();
      },
      onToggleEliminated: (letter) => {
        const cur = pending[index];
        if (!cur || advancing) return;
        if (eliminated.has(letter)) eliminated.delete(letter);
        else {
          eliminated.add(letter);
          if (selectedLetter === letter) selectedLetter = null;
        }
        paintCurrentChoices();
      }
    });
  }

  function applyAssistReveal(q, reveal) {
    if (!reveal) return;
    q.assistUsed = true;
    q.assistReveal = reveal;
    const letter = String(reveal.letter || reveal.removed || "").toLowerCase();
    $("q-choices").querySelectorAll(".btn-choice").forEach((btn) => {
      if (btn.dataset.letter !== letter) return;
      if (reveal.isCorrect === true) {
        btn.classList.add("assist-true");
        btn.insertAdjacentHTML("beforeend", '<span class="assist-tag">Verdadeira</span>');
      } else {
        btn.classList.add("assist-false");
        btn.disabled = true;
        btn.insertAdjacentHTML("beforeend", '<span class="assist-tag">Falsa</span>');
      }
    });
  }

  function syncAssistUi(q) {
    assistMode = false;
    const wrap = $("q-assist");
    const btn = $("btn-assist");
    if (!wrap || !btn) return;
    wrap.classList.remove("hidden");
    if (!q || q.assistUsed || q.alreadyAnswered) {
      btn.disabled = true;
      btn.classList.remove("active");
      btn.textContent = q && q.alreadyAnswered ? "Respondida" : "Item usado";
      updateQuestionDetails();
      return;
    }
    btn.disabled = assistQty < 1 || submitting;
    btn.classList.remove("active");
    btn.textContent =
      assistQty > 0 ? `Verificar alt. (${assistQty})` : "Sem item loja";
    updateQuestionDetails();
  }

  function setCatsPanelOpen(open) {
    const panel = $("q-cats-panel");
    const toggle = $("q-cats-toggle");
    if (!panel || !toggle) return;
    panel.classList.toggle("hidden", !open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function syncCatsToggleLabel() {
    const countEl = $("q-cats-toggle-count");
    if (!countEl) return;
    const n = selectedCategoryIds.size;
    countEl.textContent = n > 0 ? String(n) : "";
  }

  function renderQuizCategoryToggles() {
    const wrap = $("q-categories-toggles");
    if (!wrap) return;
    if (!userCategories.length) {
      wrap.innerHTML = '<p class="atv-muted" style="margin:0 0 0.35rem;font-size:0.78rem;font-weight:500">Nenhuma ainda.</p>';
    } else {
      wrap.innerHTML = userCategories
        .map((c) => {
          const id = Number(c.id);
          const on = selectedCategoryIds.has(id);
          return `<label class="atv-cat-check">
            <input type="checkbox" data-id="${esc(String(id))}" ${on ? "checked" : ""} />
            <span>${esc(c.name)}</span>
          </label>`;
        })
        .join("");
      wrap.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.addEventListener("change", () => {
          const id = Number(input.dataset.id);
          if (input.checked) selectedCategoryIds.add(id);
          else selectedCategoryIds.delete(id);
          saveDraftCatsForCurrent();
          if (pending[index] && pending[index].alreadyAnswered) {
            void persistCatsIfAnswered();
          }
          syncCatsToggleLabel();
          updateQuestionDetails();
        });
      });
    }
    syncCatsToggleLabel();
    updateQuestionDetails();
  }

  function renderQuestion() {
    const q = pending[index];
    if (!q) {
      void showResults();
      return;
    }
    $("omissas-loading").classList.add("hidden");
    $("omissas-results").classList.add("hidden");
    $("omissas-quiz").classList.remove("hidden");
    showQuizStatus(q.saveError || "");
    const commentEl = $("q-comment");
    commentEl.value = q.yourComment || "";
    commentEl.readOnly = false;
    currentConfidence = q.yourConfidence || "seguro";
    wantsDiscussion = q.wantsDiscussion === true || q.yourWantsDiscussion === true;
    questionOpenedAt = Date.now();
    syncConfidenceUi();
    syncDiscussUi();
    assistMode = false;
    setCatsPanelOpen(false);
    loadDraftCatsForCurrent();

    const hello = firstName(quizUserName || userName);
    $("q-title").textContent = `Questão #${q.shortId}`;
    const metaParts = [];
    if (hello) metaParts.push(`Olá, ${hello}`);
    if (q.creatorName) metaParts.push(`Por ${q.creatorName}`);
    $("q-meta").textContent = metaParts.join(" · ");
    $("q-progress").textContent = q.alreadyAnswered
      ? `${index + 1} / ${pending.length} · respondida (pode alterar)`
      : `${index + 1} / ${pending.length}`;

    $("q-statement").innerHTML = quizUi.statementHtml(q) || "<p>(Sem enunciado)</p>";

    renderQuizCategoryToggles();
    syncQuizNavButtons();

    selectedLetter = String(q.yourLetter || q.yourAnswer || "").toLowerCase() || null;
    eliminated = new Set();
    timer.start(q.alreadyAnswered && q.durationMs ? q.durationMs : null);
    const sid = q.shortId;
    quizUi.paintAiComment(q.yourAiComment);
    if (q.alreadyAnswered && (q.yourComment || "").trim() && !(q.yourAiComment || "").trim()) {
      startAiPoll(sid);
    } else {
      stopAiPoll();
    }
    if (q.alreadyAnswered && sid) {
      void quizUi.fetchViaDuration(fetchJson, API.via(token, sid)).then((ms) => {
        if (!pending[index] || pending[index].shortId !== sid) return;
        if (ms) timer.start(ms);
      });
    }

    const choices = $("q-choices");
    choices.classList.remove("assist-picking");
    quizUi.renderChoices(choices, q);
    bindCurrentChoices(q);
    if (q.assistReveal) applyAssistReveal(q, q.assistReveal);
    paintCurrentChoices();
    syncAssistUi(q);
    updateQuestionDetails();
  }

  async function useAssistOnLetter(letter) {
    if (assistBusy || submitting) return;
    const q = pending[index];
    if (!q || !letter || q.assistUsed || q.alreadyAnswered) return;
    assistBusy = true;
    $("q-status").classList.remove("hidden");
    $("q-status").textContent = "Verificando alternativa…";
    try {
      const data = await fetchJson(API.assist, {
        method: "POST",
        body: JSON.stringify({ t: token, shortId: q.shortId, letter })
      });
      assistQty = data.assistEliminateQty != null ? data.assistEliminateQty : Math.max(0, assistQty - 1);
      applyAssistReveal(q, data.assistReveal || { letter: letter.toUpperCase(), isCorrect: data.isCorrect });
      $("q-status").classList.add("hidden");
      syncAssistUi(q);
      updateQuestionDetails();
    } catch (e) {
      $("q-status").classList.remove("hidden");
      $("q-status").textContent = e.message || "Erro ao usar assistência.";
      assistMode = false;
      syncAssistUi(q);
    } finally {
      assistBusy = false;
    }
  }

  function onChoose(letter) {
    if (advancing) return;
    const q = pending[index];
    if (!q || !letter) return;
    advancing = true;
    assistMode = false;
    saveDraftForCurrent();
    q.yourLetter = letter;
    q.yourAnswer = letter;
    q.alreadyAnswered = true;
    q.yourConfidence = currentConfidence;
    q.wantsDiscussion = wantsDiscussion;
    if (q.durationMs == null) q.durationMs = timer.elapsed();
    q.dirty = true;
    void saveAnswerInBackground(q);
    advanceAfterResolve();
    window.setTimeout(() => {
      advancing = false;
      paintCurrentChoices();
      syncQuizNavButtons();
    }, 40);
  }

  async function showResults() {
    cancelScheduledResults();
    if (timer) timer.stop();
    saveDraftForCurrent();
    const current = pending[index];
    if (current && current.alreadyAnswered && current.dirty && !pendingSaves.has(catKey(current))) {
      void saveAnswerInBackground(current);
    }
    $("omissas-quiz").classList.add("hidden");
    $("omissas-loading").classList.remove("hidden");
    $("omissas-loading").textContent = pendingSaves.size ? "Salvando respostas…" : "Montando resultado…";
    try {
      if (pendingSaves.size) await Promise.allSettled([...pendingSaves.values()]);
      $("omissas-loading").textContent = "Montando resultado…";
      let data;
      try {
        data = await fetchJson(API.results(token));
      } catch (first) {
        if (first.status !== 409) throw first;
        await new Promise((r) => window.setTimeout(r, 280));
        if (pendingSaves.size) await Promise.allSettled([...pendingSaves.values()]);
        data = await fetchJson(API.results(token));
      }
      $("omissas-loading").classList.add("hidden");
      $("omissas-results").classList.remove("hidden");
      const hello = firstName(data.userName || quizUserName || userName);
      $("results-summary").innerHTML = `
        ${hello ? `<p class="omissas-hello">Boa, ${esc(hello)}!</p>` : ""}
        <div class="omissas-stat ok"><span>${data.correctCount}</span> acertos</div>
        <div class="omissas-stat bad"><span>${data.wrongCount}</span> erros</div>
        <div class="omissas-stat"><span>${data.total}</span> no total</div>`;
      $("results-list").innerHTML = (data.items || [])
        .map((item) => {
          if (item.missing) {
            return `<article class="omissas-result-item"><h3>#${esc(item.shortId)}</h3><p>Indisponível.</p></article>`;
          }
          const badge =
            item.correct === true
              ? '<span class="omissas-badge ok">Acerto</span>'
              : item.correct === false
                ? '<span class="omissas-badge bad">Erro</span>'
                : '<span class="omissas-badge">—</span>';
          return `<article class="omissas-result-item" data-short-id="${esc(item.shortId)}">
            <div class="omissas-result-head"><h3>#${esc(item.shortId)}</h3>${badge}</div>
            <p><strong>Sua:</strong> ${(item.yourLetter || "—").toUpperCase()}
              · <strong>Gabarito:</strong> ${esc(item.answerKey || "—")}</p>
            ${quizUi.tecLinkHtml(item)}
            ${
              item.yourComment || item.yourAiComment
                ? `<div class="omissas-note-card">
              ${
                item.yourComment
                  ? `<p class="omissas-your-comment"><strong>Anotação:</strong> ${esc(item.yourComment)}</p>`
                  : ""
              }
              ${
                item.yourAiComment
                  ? `<div class="omissas-ai-comment"><p class="omissas-ai-kicker">Resposta da IA</p><p class="omissas-ai-body">${esc(item.yourAiComment)}</p></div>`
                  : `<p class="omissas-ai-warn">IA: sem resposta no momento — a IA demorou ou falhou.</p>`
              }
            </div>`
                : ""
            }
            <div class="omissas-discuss">
              <label class="omissas-discuss-label">Discussão antecipada
                <textarea class="omissas-discuss-input" rows="2" maxlength="4000" placeholder="Comente agora — vai no feed quando o gabarito sair no grupo"></textarea>
              </label>
              <button type="button" class="btn-secondary btn-sm omissas-discuss-btn" data-discuss="${esc(item.shortId)}">Discutir</button>
              <p class="omissas-discuss-status" hidden></p>
            </div>
          </article>`;
        })
        .join("");

      $("results-list").querySelectorAll("[data-discuss]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const shortId = btn.getAttribute("data-discuss");
          const card = btn.closest(".omissas-result-item");
          const ta = card?.querySelector(".omissas-discuss-input");
          const st = card?.querySelector(".omissas-discuss-status");
          void postEarlyDiscussion(shortId, ta, st, btn);
        });
      });
    } catch (e) {
      $("omissas-loading").classList.add("hidden");
      $("omissas-error").classList.remove("hidden");
      $("omissas-error").textContent = e.message || "Erro no resultado.";
    }
  }

  async function postEarlyDiscussion(shortId, ta, st, btn) {
    const body = String(ta?.value || "").trim();
    if (!body) {
      if (st) {
        st.hidden = false;
        st.textContent = "Escreva um comentário.";
      }
      return;
    }
    if (!userJid) {
      if (st) {
        st.hidden = false;
        st.textContent = "Selecione quem você é.";
      }
      return;
    }
    btn.disabled = true;
    if (st) {
      st.hidden = false;
      st.textContent = "Salvando…";
    }
    try {
      await fetchJson("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortId,
          userJid,
          userName,
          body
        })
      });
      if (ta) ta.value = "";
      if (st) {
        st.textContent =
          "Discussão salva. Quando o gabarito for ao grupo, o bot manda enunciado + resultado + discussão.";
      }
    } catch (e) {
      if (st) st.textContent = e.message || "Erro ao salvar discussão";
      btn.disabled = false;
      return;
    }
    btn.disabled = false;
  }

  async function init() {
    try {
      await loadMembers();
    } catch (e) {
      showStatus(e.message || "Erro ao carregar membros");
    }

    if (location.hash === "#historico") paintView("historico");
    setGate(Boolean(userJid));
    if (userJid) void refresh();

    $("atv-user").addEventListener("change", (e) => {
      userJid = e.target.value || "";
      userName = e.target.options[e.target.selectedIndex]?.textContent || "";
      if (userJid) localStorage.setItem(STORAGE_USER, userJid);
      else localStorage.removeItem(STORAGE_USER);
      selectedDays.clear();
      weekAnchor = null;
      monthAnchor = null;
      setGate(Boolean(userJid));
      showQuizWrap(false);
      if (userJid) void refresh();
    });

    document.querySelectorAll(".atv-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    $("btn-responder-hoje").addEventListener("click", () => startSession("hoje"));
    $("btn-atrasadas").addEventListener("click", () => startSession("atrasadas"));
    $("btn-fazer-erradas").addEventListener("click", () => openErradasModal());
    $("btn-continuar-erradas").addEventListener("click", () => continuarErradas());
    $("btn-hist-more").addEventListener("click", () => {
      void loadHistorico(refreshSeq, { append: true }).catch((e) => {
        showStatus(e.message || "Erro ao carregar mais");
      });
    });
    document.querySelectorAll(".hist-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        histOutcome = btn.dataset.outcome || "all";
        document.querySelectorAll(".hist-filter").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        if (view === "historico") void refresh();
      });
    });
    $("erradas-cancel").addEventListener("click", () => closeErradasModal());
    $("erradas-confirm").addEventListener("click", () => confirmErradas());
    $("erradas-days").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        void confirmErradas();
      }
    });
    $("erradas-modal").addEventListener("click", (ev) => {
      if (ev.target === $("erradas-modal")) closeErradasModal();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !$("erradas-modal").classList.contains("hidden")) {
        closeErradasModal();
      }
    });
    window.addEventListener("hashchange", () => {
      if (location.hash === "#historico" && view !== "historico") switchView("historico");
    });
    $("btn-adiantar-week").addEventListener("click", () => adiantarSelected());
    $("btn-adiantar-month").addEventListener("click", () => adiantarSelected());

    const btnToggleCats = $("btn-toggle-cats");
    if (btnToggleCats) {
      btnToggleCats.addEventListener("click", () => {
        catsPanelOpen = !catsPanelOpen;
        const body = $("atv-cats-body");
        if (body) body.classList.toggle("hidden", !catsPanelOpen);
        btnToggleCats.textContent = catsPanelOpen ? "Ocultar" : "Mostrar";
        btnToggleCats.setAttribute("aria-expanded", catsPanelOpen ? "true" : "false");
        if (catsPanelOpen) void loadUserCategories();
      });
    }
    const btnCatAdd = $("btn-atv-cat-add");
    if (btnCatAdd) {
      btnCatAdd.addEventListener("click", () => createUserCategoryFromUi("atv-cat-name", "atv-cats-status"));
    }
    const catNameInput = $("atv-cat-name");
    if (catNameInput) {
      catNameInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          void createUserCategoryFromUi("atv-cat-name", "atv-cats-status");
        }
      });
    }
    ["q-prev", "q-prev-bottom"].forEach((id) => {
      const btn = $(id);
      if (btn) btn.addEventListener("click", () => navigateQuiz(-1));
    });
    ["q-next", "q-next-bottom"].forEach((id) => {
      const btn = $(id);
      if (btn) btn.addEventListener("click", () => navigateQuiz(1));
    });
    document.addEventListener("keydown", (ev) => {
      if (!quizIsOpen() || advancing) return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (isTypingTarget(ev.target)) return;
      if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        navigateQuiz(-1);
      } else if (ev.key === "ArrowRight") {
        ev.preventDefault();
        navigateQuiz(1);
      }
    });
    if (quizUi.bindSwipeNav) {
      quizUi.bindSwipeNav($("omissas-quiz"), {
        isEnabled: () => quizIsOpen() && !advancing,
        onPrev: () => navigateQuiz(-1),
        onNext: () => navigateQuiz(1)
      });
    }
    if ($("q-cats-toggle")) {
      $("q-cats-toggle").addEventListener("click", (ev) => {
        ev.stopPropagation();
        const open = $("q-cats-panel") && !$("q-cats-panel").classList.contains("hidden");
        setCatsPanelOpen(!open);
      });
    }
    if ($("q-new-cat")) {
      $("q-new-cat").addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const name = window.prompt("Nome da nova categoria:");
        if (!name) return;
        const input = $("atv-cat-name");
        if (input) input.value = name;
        const cat = await createUserCategoryFromUi("atv-cat-name", "atv-cats-status");
        if (cat) {
          selectedCategoryIds.add(Number(cat.id));
          saveDraftCatsForCurrent();
          if (pending[index] && pending[index].alreadyAnswered) {
            void persistCatsIfAnswered();
          }
          renderQuizCategoryToggles();
          setCatsPanelOpen(true);
        }
      });
    }
    document.addEventListener("click", (ev) => {
      const wrap = document.querySelector(".atv-toolbar-cats-wrap");
      if (!wrap || wrap.contains(ev.target)) return;
      setCatsPanelOpen(false);
    });

    const btnAssist = $("btn-assist");
    if (btnAssist) {
      btnAssist.addEventListener("click", () => {
        const q = pending[index];
        if (!q || q.alreadyAnswered || q.assistUsed || assistQty < 1 || submitting || assistBusy) return;
        assistMode = !assistMode;
        btnAssist.classList.toggle("active", assistMode);
        $("q-choices").classList.toggle("assist-picking", assistMode);
      });
    }
    const btnResolve = $("btn-resolve");
    if (btnResolve) {
      btnResolve.addEventListener("click", () => {
        if (!selectedLetter || advancing) return;
        onChoose(selectedLetter);
      });
    }
    const commentEl = $("q-comment");
    if (commentEl && !commentEl.dataset.dirtyBound) {
      commentEl.dataset.dirtyBound = "1";
      commentEl.addEventListener("input", () => {
        const q = pending[index];
        if (!q) return;
        q.yourComment = commentEl.value || "";
        q.dirty = true;
      });
    }
    const btnResults = $("btn-atv-results");
    if (btnResults) {
      btnResults.addEventListener("click", () => {
        if (advancing) return;
        void showResults();
      });
    }

    $("week-prev").addEventListener("click", () => {
      if (!weekAnchor) return;
      weekAnchor = addDaysIso(startOfWeekMonday(weekAnchor), -7);
      selectedDays.clear();
      void loadWeek();
    });
    $("week-next").addEventListener("click", () => {
      if (!weekAnchor) return;
      weekAnchor = addDaysIso(startOfWeekMonday(weekAnchor), 7);
      selectedDays.clear();
      void loadWeek();
    });
    $("month-prev").addEventListener("click", () => {
      if (!monthAnchor) return;
      const [y, m] = monthAnchor.split("-").map(Number);
      const nm = m === 1 ? 12 : m - 1;
      const ny = m === 1 ? y - 1 : y;
      monthAnchor = `${ny}-${String(nm).padStart(2, "0")}`;
      selectedDays.clear();
      void loadMonth();
    });
    $("month-next").addEventListener("click", () => {
      if (!monthAnchor) return;
      const [y, m] = monthAnchor.split("-").map(Number);
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      monthAnchor = `${ny}-${String(nm).padStart(2, "0")}`;
      selectedDays.clear();
      void loadMonth();
    });

    $("btn-close-quiz").addEventListener("click", () => {
      cancelScheduledResults();
      showQuizWrap(false);
      void refresh();
    });
  }

  void init();
})();

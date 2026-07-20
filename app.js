// ============================================================
// PRIMO SOCCER LEAGUE V2 — app.js
// Cada ação grava direto nas tabelas novas (uma linha por
// aluno/pontuação/partida). Nunca existe "salvar tudo de uma vez"
// sobrescrevendo um blob único — por isso não há mais risco de
// apagar a base inteira sem querer.
// ============================================================

let sb = null;
let mode = "admin"; // 'admin' | 'aluno' | 'pais'
let session = null;
let athletes = [];
let enrollment = [];
let scores = [];
let bracket = [];
let annualScores = [];
let currentPage = "dashboard";
let currentYear, currentMonth;
let currentCategory = "";
let scoreDraft = {}; // athleteId -> {wins,draws,losses}
let pendingPhoto = null;

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

document.addEventListener("DOMContentLoaded", init);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

async function init() {
  const params = new URLSearchParams(location.search);
  mode = params.get("aluno") ? "aluno" : params.get("pais") ? "pais" : "admin";

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1;

  sb = supabase.createClient(window.PRIMO_CONFIG.supabaseUrl, window.PRIMO_CONFIG.supabaseAnonKey);
  document.getElementById("heroLogo").src = window.PRIMO_CONFIG.logo;
  document.getElementById("heroTitle").textContent = window.PRIMO_CONFIG.appName;

  if (mode !== "admin") {
    document.getElementById("tabs").classList.add("hidden");
    document.getElementById("monthSelect").classList.add("hidden");
    document.getElementById("readonlyLogo").src = window.PRIMO_CONFIG.logo;
    document.getElementById("readonlySub").textContent =
      (mode === "aluno" ? "Link dos atletas" : "Link dos pais") + " • " + MONTH_NAMES[currentMonth - 1] + "/" + currentYear;
    if (mode === "pais") document.getElementById("readonlyBracketCard").classList.add("hidden");
    else document.getElementById("readonlyBracketCard").classList.remove("hidden");
    showOnly("page-readonly");
    await loadAthletes();
    await loadEnrollment();
    await loadScores();
    await loadBracket();
    renderReadonly();
    return;
  }

  buildMonthSelect();
  wireEvents();

  const { data: { session: s } } = await sb.auth.getSession();
  session = s;
  if (session) await enterAdmin(); else showOnly("page-login");

  sb.auth.onAuthStateChange((_evt, s2) => {
    session = s2;
    if (session && currentPage === "login") enterAdmin();
  });
}

// ---------------- NAV ----------------

function showOnly(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(pageId).classList.remove("hidden");
}

function showPage(name) {
  currentPage = name;
  showOnly("page-" + name);
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.page === name));
  if (name === "ranking") loadAnnualScores().then(renderRanking);
  if (name === "agenda") renderAgenda();
  if (name === "pontuacao") renderScorePage();
  if (name === "matamata") renderBracket();
  if (name === "cadastro") renderAthletesTable();
  if (name === "imprimir") document.getElementById("storyPreviewCard").style.display = "none";
  if (name === "dashboard") renderDashboard();
}

function wireEvents() {
  document.querySelectorAll("#tabs button").forEach(b => b.addEventListener("click", () => showPage(b.dataset.page)));
  document.getElementById("btnLogin").addEventListener("click", doLogin);
  document.getElementById("btnLogout").addEventListener("click", doLogout);
  document.getElementById("monthSelect").addEventListener("change", onMonthChange);

  document.getElementById("newAthletePhoto").addEventListener("change", onNewPhotoChosen);
  document.getElementById("btnAddAthlete").addEventListener("click", addAthlete);

  document.getElementById("btnAddToAgenda").addEventListener("click", addToAgenda);
  document.getElementById("btnCopyAgenda").addEventListener("click", copyAgenda);

  document.getElementById("btnFinishTraining").addEventListener("click", finishTraining);

  document.getElementById("btnGenerateBracket").addEventListener("click", generateBracket);
  document.getElementById("btnResetBracket").addEventListener("click", resetBracket);

  document.getElementById("btnCopyStudentLink").addEventListener("click", () => copyLink("aluno"));
  document.getElementById("btnCopyParentLink").addEventListener("click", () => copyLink("pais"));
  document.getElementById("btnExportBackup").addEventListener("click", exportBackup);
  document.getElementById("btnViewHistory").addEventListener("click", loadHistory);

  document.getElementById("categorySelect").addEventListener("change", (e) => {
    currentCategory = e.target.value;
    showPage(currentPage);
  });

  document.getElementById("btnStoryRanking").addEventListener("click", () => generateStoryImage("ranking"));
  document.getElementById("btnStoryAnual").addEventListener("click", () => generateStoryImage("anual"));
  document.getElementById("btnStoryBracket").addEventListener("click", () => generateStoryImage("matamata"));
}

function refreshCategoryOptions() {
  const sel = document.getElementById("categorySelect");
  const cats = [...new Set(athletes.map(a => a.category).filter(Boolean))].sort();
  const current = sel.value;
  sel.innerHTML = `<option value="">Todas categorias</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join("");
  if (cats.includes(current)) sel.value = current;
  else currentCategory = "";
}

// filtra por categoria selecionada (vazio = todas)
function filteredAthletes() {
  return currentCategory ? athletes.filter(a => a.category === currentCategory) : athletes;
}
function filteredAthleteIdSet() {
  return new Set(filteredAthletes().map(a => a.id));
}

function buildMonthSelect() {
  const sel = document.getElementById("monthSelect");
  sel.innerHTML = "";
  const y = new Date().getFullYear();
  [y - 1, y, y + 1].forEach(year => {
    MONTH_NAMES.forEach((m, i) => {
      const opt = document.createElement("option");
      opt.value = year + "-" + (i + 1);
      opt.textContent = m + "/" + year;
      if (year === currentYear && i + 1 === currentMonth) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

async function onMonthChange(e) {
  const [y, m] = e.target.value.split("-").map(Number);
  currentYear = y; currentMonth = m;
  scoreDraft = {};
  setSync("Carregando " + MONTH_NAMES[m - 1] + "/" + y + "...");
  await Promise.all([loadEnrollment(), loadScores(), loadBracket()]);
  setSync("Dados carregados.", "ok");
  showPage(currentPage);
}

// ---------------- AUTH ----------------

async function doLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;
  document.getElementById("loginError").textContent = "";
  if (!email || !pass) { document.getElementById("loginError").textContent = "Preencha e-mail e senha."; return; }
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { document.getElementById("loginError").textContent = "Login inválido: " + error.message; return; }
  await enterAdmin();
}

async function doLogout() {
  await sb.auth.signOut();
  showOnly("page-login");
}

async function enterAdmin() {
  setSync("Carregando dados...");
  await Promise.all([loadAthletes(), loadEnrollment(), loadScores(), loadBracket()]);
  refreshCategoryOptions();
  setSync("Conectado.", "ok");
  showPage("dashboard");
}

function setSync(msg, kind) {
  const el = document.getElementById("syncStatus");
  el.textContent = msg || "";
  el.className = "sync" + (kind ? " " + kind : "");
}

// ---------------- LOAD ----------------

async function loadAthletes() {
  const { data, error } = await sb.from("athletes").select("*").order("full_name");
  if (error) { setSync("Erro ao carregar atletas: " + error.message, "error"); return; }
  athletes = data || [];
}

async function loadEnrollment() {
  const { data, error } = await sb.from("monthly_enrollment").select("*").eq("year", currentYear).eq("month", currentMonth);
  if (error) { setSync("Erro ao carregar agenda: " + error.message, "error"); return; }
  enrollment = data || [];
}

async function loadScores() {
  const { data, error } = await sb.from("scores").select("*").eq("year", currentYear).eq("month", currentMonth);
  if (error) { setSync("Erro ao carregar pontuação: " + error.message, "error"); return; }
  scores = data || [];
}

async function loadAnnualScores() {
  const { data, error } = await sb.from("scores").select("*").eq("year", currentYear);
  if (error) { setSync("Erro ao carregar ranking anual: " + error.message, "error"); return; }
  annualScores = data || [];
}

async function loadBracket() {
  const { data, error } = await sb.from("bracket_matches").select("*").eq("year", currentYear).eq("month", currentMonth);
  if (error) { setSync("Erro ao carregar mata-mata: " + error.message, "error"); return; }
  bracket = data || [];
}

function athleteName(id) {
  const a = athletes.find(x => x.id === id);
  return a ? a.full_name : "(removido)";
}
function athletePhoto(id) {
  const a = athletes.find(x => x.id === id);
  return a ? a.photo_url : null;
}
function avatarHtml(id) {
  const photo = athletePhoto(id);
  const name = athleteName(id);
  return photo
    ? `<span class="avatar"><img src="${photo}" alt=""></span>`
    : `<span class="avatar">${(name || "?").slice(0, 2).toUpperCase()}</span>`;
}

// ---------------- CADASTRO ----------------

function onNewPhotoChosen(e) {
  const file = e.target.files[0];
  if (!file) return;
  compressImage(file, 240, 0.7).then(dataUrl => {
    pendingPhoto = dataUrl;
    document.getElementById("newPhotoPreview").innerHTML = `<img src="${dataUrl}" alt="">`;
  });
}

function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function addAthlete() {
  const name = document.getElementById("newAthleteName").value.trim();
  const category = document.getElementById("newAthleteCategory").value.trim() || "Geral";
  if (!name) return alert("Digite o nome do atleta.");
  const { error } = await sb.from("athletes").insert({ full_name: name, category, photo_url: pendingPhoto, active: true });
  if (error) return alert("Erro ao cadastrar: " + error.message);
  document.getElementById("newAthleteName").value = "";
  document.getElementById("newAthleteCategory").value = "";
  document.getElementById("newPhotoPreview").innerHTML = "+ foto";
  pendingPhoto = null;
  await loadAthletes();
  refreshCategoryOptions();
  renderAthletesTable();
  setSync("Atleta cadastrado.", "ok");
}

async function toggleActive(id, active) {
  const { error } = await sb.from("athletes").update({ active }).eq("id", id);
  if (error) return alert("Erro: " + error.message);
  await loadAthletes();
  renderAthletesTable();
}

async function deleteAthlete(id) {
  const name = athleteName(id);
  if (!confirm(`Excluir definitivamente "${name}"?\n\nUm histórico fica salvo no banco (athletes_history) mesmo assim, mas ele sai de todas as listas.`)) return;
  const { error } = await sb.from("athletes").delete().eq("id", id);
  if (error) return alert("Erro ao excluir: " + error.message);
  await loadAthletes();
  renderAthletesTable();
  setSync("Atleta removido.", "ok");
}

function renderAthletesTable() {
  const tbody = document.getElementById("athletesTable");
  tbody.innerHTML = filteredAthletes().map(a => `
    <tr>
      <td>${avatarHtml(a.id)}</td>
      <td style="text-align:left">${a.full_name}</td>
      <td>${a.category || ""}</td>
      <td>${a.active ? "Ativo" : "Inativo"}</td>
      <td>
        <button class="secondary" onclick="toggleActive('${a.id}', ${!a.active})">${a.active ? "Desativar" : "Ativar"}</button>
        <button class="danger" onclick="deleteAthlete('${a.id}')">Excluir</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5">Nenhum atleta cadastrado ainda.</td></tr>`;
}

// ---------------- AGENDA ----------------

function renderAgenda() {
  const picker = document.getElementById("agendaAthletePicker");
  picker.innerHTML = filteredAthletes().filter(a => a.active).map(a => `<option value="${a.id}">${a.full_name}</option>`).join("");

  const copyPicker = document.getElementById("copyMonthPicker");
  const opts = [];
  for (let i = 1; i <= 12; i++) {
    if (i === currentMonth) continue;
    opts.push(`<option value="${currentYear}-${i}">${MONTH_NAMES[i - 1]}/${currentYear}</option>`);
  }
  copyPicker.innerHTML = opts.join("");

  const idSet = filteredAthleteIdSet();
  const grid = document.getElementById("agendaGrid");
  const slots = ["Horário 1", "Horário 2"];
  grid.innerHTML = slots.map(slot => {
    const rows = enrollment.filter(e => e.schedule_slot === slot && idSet.has(e.athlete_id));
    return `<div class="slotCard">
      <div class="slotTitle">${slot} (${rows.length})</div>
      ${rows.map(r => `<div class="item">
          <span class="rankLeft">${avatarHtml(r.athlete_id)} ${athleteName(r.athlete_id)}</span>
          <button class="danger" onclick="removeFromAgenda('${r.id}')">Remover</button>
        </div>`).join("") || "<p class='smallText'>Nenhum atleta neste horário.</p>"}
    </div>`;
  }).join("");
}

async function addToAgenda() {
  const athleteId = document.getElementById("agendaAthletePicker").value;
  const slot = document.getElementById("agendaSlotPicker").value;
  if (!athleteId) return alert("Cadastre um atleta primeiro.");
  const { error } = await sb.from("monthly_enrollment")
    .upsert({ athlete_id: athleteId, year: currentYear, month: currentMonth, schedule_slot: slot }, { onConflict: "athlete_id,year,month,schedule_slot" });
  if (error) return alert("Erro: " + error.message);
  await loadEnrollment();
  renderAgenda();
  setSync("Atleta adicionado na agenda.", "ok");
}

async function removeFromAgenda(enrollmentId) {
  if (!confirm("Remover este atleta do horário deste mês?")) return;
  const { error } = await sb.from("monthly_enrollment").delete().eq("id", enrollmentId);
  if (error) return alert("Erro: " + error.message);
  await loadEnrollment();
  renderAgenda();
}

async function copyAgenda() {
  const [fromYear, fromMonth] = document.getElementById("copyMonthPicker").value.split("-").map(Number);
  const { data, error } = await sb.from("monthly_enrollment").select("*").eq("year", fromYear).eq("month", fromMonth);
  if (error) return alert("Erro: " + error.message);
  if (!data || !data.length) return alert("O mês escolhido não tem agenda para copiar.");
  const rows = data.map(r => ({ athlete_id: r.athlete_id, year: currentYear, month: currentMonth, schedule_slot: r.schedule_slot }));
  const { error: err2 } = await sb.from("monthly_enrollment").upsert(rows, { onConflict: "athlete_id,year,month,schedule_slot" });
  if (err2) return alert("Erro ao copiar: " + err2.message);
  await loadEnrollment();
  renderAgenda();
  setSync(`Agenda copiada (${rows.length} atletas). Pontuação do mês atual continua zerada.`, "ok");
}

// ---------------- PONTUAÇÃO ----------------

function enrolledAthleteIds() {
  const idSet = filteredAthleteIdSet();
  return [...new Set(enrollment.map(e => e.athlete_id))].filter(id => idSet.has(id));
}

function renderScorePage() {
  const ids = enrolledAthleteIds();
  ids.forEach(id => { if (!scoreDraft[id]) scoreDraft[id] = { wins: 0, draws: 0, losses: 0 }; });
  const tbody = document.getElementById("scoreTableBody");
  tbody.innerHTML = ids.map(id => {
    const d = scoreDraft[id];
    const points = d.wins * 3 + d.draws * 1;
    return `<tr>
      <td class="sticky">${avatarHtml(id)} ${athleteName(id)}</td>
      <td>${counterHtml(id, "wins", d.wins)}</td>
      <td>${counterHtml(id, "draws", d.draws)}</td>
      <td>${counterHtml(id, "losses", d.losses)}</td>
      <td>${points}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="5">Nenhum atleta na agenda deste mês ainda. Vá em Agenda para adicionar.</td></tr>`;
}

function counterHtml(id, field, value) {
  return `<span class="scoreCounter">
    <button class="secondary" onclick="adjustScore('${id}','${field}',-1)">−</button>
    <span>${value}</span>
    <button class="secondary" onclick="adjustScore('${id}','${field}',1)">+</button>
  </span>`;
}

function adjustScore(id, field, delta) {
  const d = scoreDraft[id];
  d[field] = Math.max(0, d[field] + delta);
  renderScorePage();
}

async function finishTraining() {
  const week = Number(document.getElementById("scoreWeek").value);
  const ids = enrolledAthleteIds().filter(id => {
    const d = scoreDraft[id];
    return d && (d.wins || d.draws || d.losses);
  });
  if (!ids.length) return alert("Nenhuma pontuação lançada ainda. Use os botões + para marcar vitórias/empates/derrotas.");
  const rows = ids.map(id => {
    const d = scoreDraft[id];
    return {
      athlete_id: id, year: currentYear, month: currentMonth, week,
      wins: d.wins, draws: d.draws, losses: d.losses,
      points: d.wins * 3 + d.draws * 1
    };
  });
  const { error } = await sb.from("scores").insert(rows);
  if (error) return alert("Erro ao salvar: " + error.message);
  scoreDraft = {};
  await loadScores();
  renderScorePage();
  setSync(`Treino salvo (${rows.length} atletas pontuados).`, "ok");
}

// ---------------- RANKING ----------------

function computeMonthlyRanking(scoreList, athleteIdsFilter) {
  const totals = {};
  scoreList.forEach(s => {
    if (athleteIdsFilter && !athleteIdsFilter.includes(s.athlete_id)) return;
    if (!totals[s.athlete_id]) totals[s.athlete_id] = { points: 0, wins: 0, draws: 0, losses: 0 };
    totals[s.athlete_id].points += s.points;
    totals[s.athlete_id].wins += s.wins;
    totals[s.athlete_id].draws += s.draws;
    totals[s.athlete_id].losses += s.losses;
  });
  return Object.entries(totals)
    .map(([athlete_id, t]) => ({ athlete_id, ...t }))
    .sort((a, b) => b.points - a.points);
}

function renderRanking() {
  const idSet = filteredAthleteIdSet();
  const ranking = computeMonthlyRanking(scores, [...idSet]);
  document.getElementById("monthlyRanking").innerHTML = renderRankList(ranking);

  const header = document.getElementById("annualHeader");
  header.innerHTML = "<th>Atleta</th>" + MONTH_NAMES.map(m => `<th>${m}</th>`).join("") + "<th>Total</th>";

  const perAthleteMonth = {};
  annualScores.filter(s => idSet.has(s.athlete_id)).forEach(s => {
    perAthleteMonth[s.athlete_id] = perAthleteMonth[s.athlete_id] || Array(13).fill(0);
    perAthleteMonth[s.athlete_id][s.month - 1] += s.points;
  });
  Object.keys(perAthleteMonth).forEach(id => {
    perAthleteMonth[id][12] = perAthleteMonth[id].slice(0, 12).reduce((a, b) => a + b, 0);
  });
  const rows = Object.entries(perAthleteMonth).sort((a, b) => b[1][12] - a[1][12]);
  document.getElementById("annualBody").innerHTML = rows.map(([id, vals]) => `
    <tr><td style="text-align:left">${athleteName(id)}</td>${vals.map(v => `<td>${v}</td>`).join("")}</tr>
  `).join("") || `<tr><td colspan="14">Sem pontuação registrada em ${currentYear}.</td></tr>`;
}

function renderRankList(ranking) {
  if (!ranking.length) return "<p class='smallText'>Sem pontuação lançada neste mês ainda.</p>";
  return ranking.map((r, i) => `
    <div class="rankRow">
      <span class="rankLeft"><span class="rankPos">${i + 1}º</span> ${avatarHtml(r.athlete_id)} ${athleteName(r.athlete_id)}</span>
      <strong>${r.points} pts</strong>
    </div>
  `).join("");
}

// ---------------- MATA-MATA ----------------

async function generateBracket() {
  const idSet = filteredAthleteIdSet();
  const ranking = computeMonthlyRanking(scores, [...idSet]);
  if (ranking.length < 8) return alert("É preciso ao menos 8 atletas pontuados no mês (na categoria selecionada) para gerar as quartas.");
  const top8 = ranking.slice(0, 8);
  const pairs = [[0, 7], [1, 6], [2, 5], [3, 4]];
  if (!confirm("Isso vai substituir o mata-mata atual deste mês pelas novas quartas de final. Continuar?")) return;
  await sb.from("bracket_matches").delete().eq("year", currentYear).eq("month", currentMonth);
  const rows = pairs.map(([a, b]) => ({
    year: currentYear, month: currentMonth, phase: "quartas",
    athlete_a: top8[a].athlete_id, athlete_b: top8[b].athlete_id
  }));
  const { error } = await sb.from("bracket_matches").insert(rows);
  if (error) return alert("Erro: " + error.message);
  await loadBracket();
  renderBracket();
  setSync("Quartas de final geradas.", "ok");
}

async function resetBracket() {
  if (!confirm("Apagar todo o mata-mata deste mês?")) return;
  await sb.from("bracket_matches").delete().eq("year", currentYear).eq("month", currentMonth);
  await loadBracket();
  renderBracket();
}

async function saveMatchResult(matchId, scoreA, scoreB) {
  scoreA = Number(scoreA); scoreB = Number(scoreB);
  const match = bracket.find(m => m.id === matchId);
  let winner = null;
  if (scoreA > scoreB) winner = match.athlete_a;
  else if (scoreB > scoreA) winner = match.athlete_b;
  const { error } = await sb.from("bracket_matches").update({ score_a: scoreA, score_b: scoreB, winner }).eq("id", matchId);
  if (error) return alert("Erro: " + error.message);
  await loadBracket();
  renderBracket();
}

async function advancePhase(fromPhase, toPhase) {
  const matches = bracket.filter(m => m.phase === fromPhase).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (matches.some(m => !m.winner)) return alert("Preencha o resultado de todas as partidas antes de avançar.");
  const winners = matches.map(m => m.winner);
  const rows = [];
  for (let i = 0; i < winners.length; i += 2) {
    rows.push({ year: currentYear, month: currentMonth, phase: toPhase, athlete_a: winners[i], athlete_b: winners[i + 1] });
  }
  await sb.from("bracket_matches").delete().eq("year", currentYear).eq("month", currentMonth).eq("phase", toPhase);
  const { error } = await sb.from("bracket_matches").insert(rows);
  if (error) return alert("Erro: " + error.message);
  await loadBracket();
  renderBracket();
}

function renderBracket() {
  renderBracketInto("bracketArea", true);
}

function renderBracketInto(elId, isAdmin) {
  const el = document.getElementById(elId);
  const phases = [["quartas", "Quartas de final"], ["semi", "Semifinal"], ["final", "Final"]];
  let html = "";
  phases.forEach(([phase, label]) => {
    const matches = bracket.filter(m => m.phase === phase);
    if (!matches.length) return;
    html += `<div class="card"><h2>${label}</h2><div class="bracketArea">`;
    matches.forEach(m => {
      html += `<div class="matchCard"><h4>${label}</h4>
        <div class="matchRow ${m.winner === m.athlete_a ? "winner" : ""}">
          <span>${avatarHtml(m.athlete_a)} ${athleteName(m.athlete_a)}</span>
          ${isAdmin ? `<input type="number" min="0" value="${m.score_a ?? ""}" id="sa-${m.id}">` : `<strong>${m.score_a ?? "-"}</strong>`}
        </div>
        <div class="matchRow ${m.winner === m.athlete_b ? "winner" : ""}">
          <span>${avatarHtml(m.athlete_b)} ${athleteName(m.athlete_b)}</span>
          ${isAdmin ? `<input type="number" min="0" value="${m.score_b ?? ""}" id="sb-${m.id}">` : `<strong>${m.score_b ?? "-"}</strong>`}
        </div>
        ${isAdmin ? `<button class="success" style="margin-top:8px" onclick="saveMatchResult('${m.id}', document.getElementById('sa-${m.id}').value, document.getElementById('sb-${m.id}').value)">Salvar resultado</button>` : ""}
      </div>`;
    });
    html += `</div></div>`;
  });
  if (isAdmin) {
    const hasQuartas = bracket.some(m => m.phase === "quartas");
    const hasSemi = bracket.some(m => m.phase === "semi");
    const hasFinal = bracket.some(m => m.phase === "final");
    if (hasQuartas && !hasSemi) html += `<button class="success" onclick="advancePhase('quartas','semi')">Gerar semifinal</button>`;
    if (hasSemi && !hasFinal) html += `<button class="success" onclick="advancePhase('semi','final')">Gerar final</button>`;
  }
  el.innerHTML = html || "<p class='smallText'>Nenhum mata-mata gerado ainda para este mês.</p>";
}

// ---------------- DASHBOARD ----------------

function renderDashboard() {
  const idSet = filteredAthleteIdSet();
  document.getElementById("dashActive").textContent = enrolledAthleteIds().length;
  document.getElementById("dashTotal").textContent = filteredAthletes().length;
  document.getElementById("dashPoints").textContent = scores.filter(s => idSet.has(s.athlete_id)).reduce((s, r) => s + r.points, 0);
}

// ---------------- CONFIG ----------------

function copyLink(kind) {
  const url = location.origin + location.pathname + "?" + kind + "=1";
  navigator.clipboard?.writeText(url);
  document.getElementById("linkText").textContent = "Link copiado: " + url;
}

async function exportBackup() {
  const [{ data: a }, { data: e }, { data: s }, { data: b }] = await Promise.all([
    sb.from("athletes").select("*"),
    sb.from("monthly_enrollment").select("*"),
    sb.from("scores").select("*"),
    sb.from("bracket_matches").select("*")
  ]);
  const backup = { exported_at: new Date().toISOString(), athletes: a, monthly_enrollment: e, scores: s, bracket_matches: b };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `primo-soccer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setSync("Backup exportado.", "ok");
}

async function loadHistory() {
  const { data, error } = await sb.from("athletes_history").select("*").order("changed_at", { ascending: false }).limit(50);
  if (error) return alert("Erro: " + error.message);
  const el = document.getElementById("historyArea");
  el.innerHTML = "<h3>Últimas 50 alterações</h3>" + (data.map(h => `
    <div class="item">
      <span>${h.action.toUpperCase()} — ${h.snapshot?.full_name || "?"}</span>
      <span class="smallText">${new Date(h.changed_at).toLocaleString("pt-BR")}</span>
    </div>
  `).join("") || "<p class='smallText'>Sem alterações registradas ainda.</p>");
}

// ---------------- IMPRIMIR / STORIES ----------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function generateStoryImage(kind) {
  const canvas = document.getElementById("storyCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0b52ff");
  grad.addColorStop(0.45, "#06117a");
  grad.addColorStop(1, "#020817");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  try {
    const logo = await loadImage(window.PRIMO_CONFIG.logo);
    const logoSize = 220;
    ctx.drawImage(logo, W / 2 - logoSize / 2, 60, logoSize, logoSize);
  } catch (e) { /* segue sem logo se não carregar */ }

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "900 62px Arial";
  ctx.fillText(window.PRIMO_CONFIG.appName, W / 2, 340);

  let title = "", rows = [];
  const idSet = filteredAthleteIdSet();

  if (kind === "ranking") {
    title = `RANKING • ${MONTH_NAMES[currentMonth - 1]}/${currentYear}`;
    rows = computeMonthlyRanking(scores, [...idSet]).map((r, i) => ({ pos: i + 1, name: athleteName(r.athlete_id), value: r.points + " pts" }));
  } else if (kind === "anual") {
    title = `RANKING ANUAL • ${currentYear}`;
    const totals = {};
    annualScores.filter(s => idSet.has(s.athlete_id)).forEach(s => { totals[s.athlete_id] = (totals[s.athlete_id] || 0) + s.points; });
    rows = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([id, pts], i) => ({ pos: i + 1, name: athleteName(id), value: pts + " pts" }));
  } else {
    title = `MATA-MATA • ${MONTH_NAMES[currentMonth - 1]}/${currentYear}`;
    const phaseLabel = { quartas: "Quartas", semi: "Semifinal", final: "Final" };
    rows = bracket.map(m => ({ pos: "", name: `${athleteName(m.athlete_a)} ${m.score_a ?? "-"} x ${m.score_b ?? "-"} ${athleteName(m.athlete_b)}`, value: phaseLabel[m.phase] || "" }));
  }

  ctx.font = "700 38px Arial";
  ctx.fillStyle = "#7ee0ff";
  ctx.fillText(title, W / 2, 410);

  if (!rows.length) {
    ctx.font = "700 34px Arial";
    ctx.fillStyle = "#dbeafe";
    ctx.fillText("Sem dados para mostrar ainda.", W / 2, 500);
  }

  let y = 500;
  ctx.textAlign = "left";
  rows.slice(0, 16).forEach(r => {
    ctx.font = "900 36px Arial";
    ctx.fillStyle = "#fff";
    const posText = r.pos ? `${r.pos}º  ` : "";
    ctx.fillText(posText + r.name, 70, y, W - 260);
    ctx.textAlign = "right";
    ctx.fillStyle = "#7ee0ff";
    ctx.font = "900 32px Arial";
    ctx.fillText(String(r.value), W - 70, y);
    ctx.textAlign = "left";
    y += 74;
  });

  document.getElementById("storyPreviewCard").style.display = "block";
  const link = document.getElementById("storyDownload");
  link.href = canvas.toDataURL("image/png");
  link.download = `primo-soccer-${kind}-${currentYear}-${currentMonth}.png`;
}

// ---------------- READONLY (aluno / pais) ----------------

function renderReadonly() {
  const ranking = computeMonthlyRanking(scores);
  document.getElementById("readonlyRanking").innerHTML = renderRankList(ranking);
  if (mode === "aluno") renderBracketInto("readonlyBracket", false);
}

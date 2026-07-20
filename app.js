// ============================================================
// PRIMO SOCCER LEAGUE 2026 — app.js (V3, categoria adulto)
// ============================================================
let sb = null;
let mode = "admin";        // 'admin' | 'aluno'
let session = null;
let athletes = [];
let scores = [];
let bracket = [];
let annualScores = [];
let scheduleSlots = [];
let slotAthletes = [];
let rulesTextValue = "";
let currentPage = "dashboard";
let currentYear, currentMonth;
let saveTimers = {};

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const FULL_MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

document.addEventListener("DOMContentLoaded", init);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

async function init() {
  const params = new URLSearchParams(location.search);
  mode = params.get("aluno") ? "aluno" : "admin";  // link de pais removido

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1;

  sb = supabase.createClient(window.PRIMO_CONFIG.supabaseUrl, window.PRIMO_CONFIG.supabaseAnonKey);
  document.getElementById("heroLogo").src = window.PRIMO_CONFIG.logo;
  document.getElementById("heroTitle").textContent = window.PRIMO_CONFIG.appName;
  const coverBg = `linear-gradient(180deg, rgba(6,17,122,.55), rgba(2,8,23,.92)), url('${window.PRIMO_CONFIG.cover}')`;
  document.getElementById("hero").style.backgroundImage = coverBg;
  updateHeroSub();

  if (mode === "aluno") {
    document.getElementById("tabs").classList.add("hidden");
    document.getElementById("monthSelect").classList.add("hidden");
    document.getElementById("readonlyLogo").src = window.PRIMO_CONFIG.logo;
    document.getElementById("readonlyHero").style.backgroundImage = coverBg;
    document.getElementById("readonlySub").textContent = "MÊS: " + FULL_MONTH_NAMES[currentMonth - 1].toUpperCase();
    showOnly("page-readonly");
    await Promise.all([loadAthletes(), loadScores(), loadBracket(), loadScheduleSlots(), loadSlotAthletes(), loadRules()]);
    renderReadonly();
    return;
  }

  buildMonthSelect();
  wireEvents();
  const { data: { session: s } } = await sb.auth.getSession();
  session = s;
  if (session) await enterAdmin(); else showOnly("page-login");
  sb.auth.onAuthStateChange((_e, s2) => { session = s2; if (session && currentPage === "login") enterAdmin(); });
}

function updateHeroSub() {
  document.getElementById("heroSub").textContent = "MÊS: " + FULL_MONTH_NAMES[currentMonth - 1].toUpperCase();
}

// ---------------- NAV ----------------
function showOnly(id){document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));document.getElementById(id).classList.remove("hidden");}
function showPage(name){
  currentPage=name;
  showOnly("page-"+name);
  document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  if(name==="ranking")loadAnnualScores().then(renderRanking);
  if(name==="agenda")renderAgenda();
  if(name==="pontuacao")renderScorePage();
  if(name==="matamata")renderBracket();
  if(name==="cadastro")renderAthletesTable();
  if(name==="imprimir")document.getElementById("storyPreviewCard").style.display="none";
  if(name==="config"){renderSlotsList();document.getElementById("rulesText").value=rulesTextValue;}
  if(name==="dashboard")renderDashboard();
}

function wireEvents(){
  document.querySelectorAll("#tabs button").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
  document.getElementById("btnLogin").addEventListener("click",doLogin);
  document.getElementById("btnLogout").addEventListener("click",doLogout);
  document.getElementById("monthSelect").addEventListener("change",onMonthChange);
  document.getElementById("newAthletePhoto").addEventListener("change",onNewPhotoChosen);
  document.getElementById("changePhotoInput").addEventListener("change",onChangePhotoChosen);
  document.getElementById("btnAddAthlete").addEventListener("click",addAthlete);
  document.getElementById("scoreSlot").addEventListener("change",renderScorePage);
  document.getElementById("scoreWeek").addEventListener("change",renderScorePage);
  document.getElementById("btnFinishSlot").addEventListener("click",finishSlot);
  document.getElementById("btnGenerateBracket").addEventListener("click",generateBracket);
  document.getElementById("btnResetBracket").addEventListener("click",resetBracket);
  document.getElementById("btnCopyStudentLink").addEventListener("click",()=>copyLink("aluno"));
  document.getElementById("btnExportBackup").addEventListener("click",exportBackup);
  document.getElementById("btnViewHistory").addEventListener("click",loadHistory);
  document.getElementById("btnAddSlot").addEventListener("click",addScheduleSlot);
  document.getElementById("btnSaveRules").addEventListener("click",saveRules);
}

function buildMonthSelect(){
  const sel=document.getElementById("monthSelect");sel.innerHTML="";
  const y=new Date().getFullYear();
  [y-1,y,y+1].forEach(year=>{FULL_MONTH_NAMES.forEach((m,i)=>{
    const o=document.createElement("option");o.value=year+"-"+(i+1);o.textContent=m+"/"+year;
    if(year===currentYear&&i+1===currentMonth)o.selected=true;sel.appendChild(o);});});
}
async function onMonthChange(e){
  const[y,m]=e.target.value.split("-").map(Number);currentYear=y;currentMonth=m;updateHeroSub();
  setSync("Carregando "+MONTH_NAMES[m-1]+"/"+y+"...");
  await Promise.all([loadScores(),loadBracket()]);
  setSync("Dados carregados.","ok");showPage(currentPage);
}

// ---------------- AUTH ----------------
async function doLogin(){
  const email=document.getElementById("loginEmail").value.trim();
  const pass=document.getElementById("loginPass").value;
  document.getElementById("loginError").textContent="";
  if(!email||!pass){document.getElementById("loginError").textContent="Preencha e-mail e senha.";return;}
  const{error}=await sb.auth.signInWithPassword({email,password:pass});
  if(error){document.getElementById("loginError").textContent="Login inválido: "+error.message;return;}
  await enterAdmin();
}
async function doLogout(){await sb.auth.signOut();showOnly("page-login");}
async function enterAdmin(){
  setSync("Carregando dados...");
  await Promise.all([loadAthletes(),loadScores(),loadBracket(),loadScheduleSlots(),loadSlotAthletes(),loadRules()]);
  setSync("Conectado.","ok");showPage("dashboard");
}
function setSync(msg,kind){const el=document.getElementById("syncStatus");el.textContent=msg||"";el.className="sync"+(kind?" "+kind:"");}

// ---------------- LOAD ----------------
async function loadAthletes(){const{data,error}=await sb.from("athletes").select("*").order("display_id");if(!error)athletes=data||[];}
async function loadScores(){const{data,error}=await sb.from("scores").select("*").eq("year",currentYear).eq("month",currentMonth);if(!error)scores=data||[];}
async function loadAnnualScores(){const{data,error}=await sb.from("scores").select("*").eq("year",currentYear);if(!error)annualScores=data||[];}
async function loadBracket(){const{data,error}=await sb.from("bracket_matches").select("*").eq("year",currentYear).eq("month",currentMonth).order("created_at");if(!error)bracket=data||[];}
async function loadScheduleSlots(){const{data,error}=await sb.from("schedule_slots").select("*").order("created_at");if(!error)scheduleSlots=data||[];}
async function loadSlotAthletes(){const{data,error}=await sb.from("slot_athletes").select("*");if(!error)slotAthletes=data||[];}
async function loadRules(){const{data,error}=await sb.from("competition_settings").select("*").eq("id",1).maybeSingle();if(!error&&data)rulesTextValue=data.rules||"";}

function athlete(id){return athletes.find(x=>x.id===id);}
function athleteName(id){const a=athlete(id);return a?a.full_name:"(removido)";}
function athletePhoto(id){const a=athlete(id);return a?a.photo_url:null;}
function athleteDisplayId(id){const a=athlete(id);return a?("#"+a.display_id):"";}
function avatarHtml(id){
  const p=athletePhoto(id),n=athleteName(id);
  return p?`<span class="avatar" onclick="openLightbox('${p}')"><img src="${p}" alt=""></span>`
          :`<span class="avatar">${(n||"?").slice(0,2).toUpperCase()}</span>`;
}

// ---------------- LIGHTBOX ----------------
function openLightbox(src){if(!src)return;document.getElementById("lightboxImg").src=src;document.getElementById("photoLightbox").classList.remove("hidden");}
function closeLightbox(){document.getElementById("photoLightbox").classList.add("hidden");}

// ---------------- CADASTRO ----------------
let pendingPhoto=null;
function onNewPhotoChosen(e){const f=e.target.files[0];if(!f)return;compressImage(f,320,.72).then(d=>{pendingPhoto=d;document.getElementById("newPhotoPreview").innerHTML=`<img src="${d}" alt="">`;});}
function compressImage(file,maxSize,q){return new Promise((res,rej)=>{const img=new Image(),r=new FileReader();r.onload=()=>img.src=r.result;r.onerror=rej;img.onload=()=>{const s=Math.min(1,maxSize/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=img.width*s;c.height=img.height*s;c.getContext("2d").drawImage(img,0,0,c.width,c.height);res(c.toDataURL("image/jpeg",q));};img.onerror=rej;r.readAsDataURL(file);});}
async function addAthlete(){
  const name=document.getElementById("newAthleteName").value.trim();
  if(!name)return alert("Digite o nome do atleta.");
  const{error}=await sb.from("athletes").insert({full_name:name,category:"Adulto",photo_url:pendingPhoto,active:true});
  if(error)return alert("Erro ao cadastrar: "+error.message);
  document.getElementById("newAthleteName").value="";
  document.getElementById("newPhotoPreview").innerHTML="+ foto";pendingPhoto=null;
  await loadAthletes();renderAthletesTable();setSync("Atleta cadastrado.","ok");
}
async function toggleActive(id,a){await sb.from("athletes").update({active:a}).eq("id",id);await loadAthletes();renderAthletesTable();}
async function deleteAthlete(id){
  if(!confirm(`Excluir "${athleteName(id)}"? Fica um histórico salvo no banco.`))return;
  const{error}=await sb.from("athletes").delete().eq("id",id);
  if(error)return alert("Erro: "+error.message);
  await Promise.all([loadAthletes(),loadSlotAthletes()]);renderAthletesTable();setSync("Atleta removido.","ok");
}
function renderAthletesTable(){
  document.getElementById("athletesTable").innerHTML=athletes.map(a=>`
    <tr>
      <td><span class="idTag">#${a.display_id}</span></td>
      <td>${avatarHtml(a.id)}</td>
      <td style="text-align:left">${a.full_name}</td>
      <td>${a.active?"Ativo":"Inativo"}</td>
      <td>
        <button class="secondary" onclick="changePhoto('${a.id}')">Trocar foto</button>
        <button class="secondary" onclick="toggleActive('${a.id}',${!a.active})">${a.active?"Desativar":"Ativar"}</button>
        <button class="danger" onclick="deleteAthlete('${a.id}')">Excluir</button>
      </td>
    </tr>`).join("")||`<tr><td colspan="5">Nenhum atleta cadastrado ainda.</td></tr>`;
}
function changePhoto(id){
  const input=document.getElementById("changePhotoInput");
  input.dataset.athleteId=id;
  input.value="";
  input.click();
}
async function onChangePhotoChosen(e){
  const f=e.target.files[0];if(!f)return;
  const id=e.target.dataset.athleteId;
  setSync("Enviando foto...");
  const dataUrl=await compressImage(f,320,.72);
  const{error}=await sb.from("athletes").update({photo_url:dataUrl}).eq("id",id);
  if(error){setSync("Erro ao trocar foto: "+error.message,"error");return;}
  await loadAthletes();renderAthletesTable();setSync("Foto atualizada.","ok");
}

// ---------------- HORÁRIOS + ATLETAS ----------------
async function addScheduleSlot(){
  const name=document.getElementById("newSlotName").value.trim();
  const days=document.getElementById("newSlotDays").value.trim();
  const time=document.getElementById("newSlotTime").value.trim();
  if(!name)return alert("Dê um nome ao horário.");
  const{error}=await sb.from("schedule_slots").insert({name,days_of_week:days,time_label:time});
  if(error)return alert("Erro: "+error.message);
  document.getElementById("newSlotName").value="";document.getElementById("newSlotDays").value="";document.getElementById("newSlotTime").value="";
  await loadScheduleSlots();renderSlotsList();setSync("Horário criado.","ok");
}
async function deleteScheduleSlot(id){
  if(!confirm("Excluir este horário e seus atletas vinculados?"))return;
  await sb.from("schedule_slots").delete().eq("id",id);
  await Promise.all([loadScheduleSlots(),loadSlotAthletes()]);renderSlotsList();
}
async function addAthleteToSlot(slotId,athleteId){
  if(!athleteId)return;
  const{error}=await sb.from("slot_athletes").upsert({slot_id:slotId,athlete_id:athleteId},{onConflict:"slot_id,athlete_id"});
  if(error)return alert("Erro: "+error.message);
  await loadSlotAthletes();renderSlotsList();
}
async function removeAthleteFromSlot(rowId){
  await sb.from("slot_athletes").delete().eq("id",rowId);
  await loadSlotAthletes();renderSlotsList();
}
function slotAthleteIds(slotId){return slotAthletes.filter(s=>s.slot_id===slotId).map(s=>s.athlete_id);}
function renderSlotsList(){
  const el=document.getElementById("slotsList");if(!el)return;
  if(!scheduleSlots.length){el.innerHTML="<p class='smallText'>Nenhum horário criado ainda.</p>";return;}
  el.innerHTML=scheduleSlots.map(s=>{
    const ids=slotAthleteIds(s.id);
    const inSlot=new Set(ids);
    const options=athletes.filter(a=>a.active&&!inSlot.has(a.id)).map(a=>`<option value="${a.id}">#${a.display_id} ${a.full_name}</option>`).join("");
    const label=s.name+(s.days_of_week?" • "+s.days_of_week:"")+(s.time_label?" • "+s.time_label:"");
    return `<div class="slotCard" style="margin-top:12px">
      <div class="slotTitle">${label}
        <button class="danger" style="float:right;min-height:30px;padding:2px 10px" onclick="deleteScheduleSlot('${s.id}')">Excluir</button>
      </div>
      ${ids.map(aid=>{const row=slotAthletes.find(x=>x.slot_id===s.id&&x.athlete_id===aid);
        return `<div class="item"><span class="rankLeft">${avatarHtml(aid)} ${athleteDisplayId(aid)} ${athleteName(aid)}</span>
          <button class="danger" onclick="removeAthleteFromSlot('${row.id}')">Tirar</button></div>`;}).join("")||"<p class='smallText'>Nenhum atleta neste horário.</p>"}
      <div class="form form2" style="margin-top:8px">
        <select id="slotpick-${s.id}">${options||'<option value="">Todos já adicionados</option>'}</select>
        <button class="success" onclick="addAthleteToSlot('${s.id}',document.getElementById('slotpick-${s.id}').value)">Adicionar atleta</button>
      </div>
    </div>`;
  }).join("");
}

// ---------------- AGENDA (visualização) ----------------
function renderAgenda(){
  const grid=document.getElementById("agendaGrid");
  if(!scheduleSlots.length){grid.innerHTML="<p class='smallText'>Nenhum horário criado. Vá em Config > Horários de treino.</p>";return;}
  grid.innerHTML=scheduleSlots.map(s=>{
    const ids=slotAthleteIds(s.id);
    const label=s.name+(s.days_of_week?" • "+s.days_of_week:"")+(s.time_label?" • "+s.time_label:"");
    return `<div class="slotCard"><div class="slotTitle">${label} (${ids.length})</div>
      ${ids.map(aid=>`<div class="item"><span class="rankLeft">${avatarHtml(aid)} ${athleteDisplayId(aid)} ${athleteName(aid)}</span></div>`).join("")||"<p class='smallText'>Nenhum atleta.</p>"}
    </div>`;
  }).join("");
}

// ---------------- PONTUAÇÃO ----------------
function currentSlotId(){return document.getElementById("scoreSlot").value;}
function currentWeek(){return Number(document.getElementById("scoreWeek").value);}
function scoreRowFor(athleteId,slotId,week){return scores.find(s=>s.athlete_id===athleteId&&s.slot_id===slotId&&s.week===week);}

function renderScorePage(){
  const slotSel=document.getElementById("scoreSlot");
  if(!scheduleSlots.length){slotSel.innerHTML='<option value="">Crie um horário em Config</option>';}
  else if(!slotSel.dataset.filled||![...slotSel.options].some(o=>o.value===slotSel.value)){
    slotSel.innerHTML=scheduleSlots.map(s=>`<option value="${s.id}">${s.name}${s.days_of_week?" ("+s.days_of_week+")":""}</option>`).join("");
    slotSel.dataset.filled="1";
  }
  const slotId=currentSlotId(),week=currentWeek();
  const tbody=document.getElementById("scoreTableBody");
  if(!slotId){tbody.innerHTML=`<tr><td colspan="5">Crie um horário e adicione atletas em Config.</td></tr>`;document.getElementById("slotFinishedNote").textContent="";return;}
  const ids=slotAthleteIds(slotId);
  if(!ids.length){tbody.innerHTML=`<tr><td colspan="5">Nenhum atleta neste horário. Adicione em Config.</td></tr>`;return;}
  tbody.innerHTML=ids.map(id=>{
    const r=scoreRowFor(id,slotId,week)||{pd:0,pe:0,un:0};
    const total=(r.pd||0)+(r.pe||0)+(r.un||0);
    return `<tr>
      <td class="sticky">${avatarHtml(id)} ${athleteDisplayId(id)} ${athleteName(id)}</td>
      <td>${counter(id,"pd",r.pd||0)}</td>
      <td>${counter(id,"pe",r.pe||0)}</td>
      <td>${unBtn(id,r.un||0)}</td>
      <td class="pTotal" id="tot-${id}">${total}</td>
    </tr>`;
  }).join("");
  const anyFinished=ids.some(id=>{const r=scoreRowFor(id,slotId,week);return r&&r.finished;});
  document.getElementById("slotFinishedNote").textContent=anyFinished?"Este horário já foi finalizado nesta semana (pode reabrir ajustando os pontos).":"";
}
function counter(id,field,val){return `<span class="scoreCounter">
  <button class="secondary" onclick="adjust('${id}','${field}',-1)">−</button>
  <input class="scoreInput" id="${field}-${id}" type="number" inputmode="numeric" min="0" value="${val}" onchange="onScoreInput('${id}')" onfocus="this.select()">
  <button class="secondary" onclick="adjust('${id}','${field}',1)">+</button></span>`;}
function unBtn(id,val){const cls=val===7?"v7":val===5?"v5":"v0";return `<button class="unBtn ${cls}" id="un-${id}" onclick="cycleUn('${id}')">${val}</button>`;}

function fieldVal(id,field){
  const el=document.getElementById(field+"-"+id);
  if(!el)return 0;
  return Number((el.value!==undefined?el.value:el.textContent)||0);
}
function readRow(id){
  return{pd:Math.max(0,fieldVal(id,"pd")),pe:Math.max(0,fieldVal(id,"pe")),un:fieldVal(id,"un")};
}
function refreshTotal(id){
  const{pd,pe,un}=readRow(id);
  const t=document.getElementById("tot-"+id);
  if(t)t.textContent=pd+pe+un;
}
function onScoreInput(id){
  const{pd,pe,un}=readRow(id);
  document.getElementById("pd-"+id).value=pd;
  document.getElementById("pe-"+id).value=pe;
  refreshTotal(id);
  autosave(id);
}
function adjust(id,field,delta){
  const el=document.getElementById(field+"-"+id);
  let v=Math.max(0,fieldVal(id,field)+delta);el.value=v;
  refreshTotal(id);
  autosave(id);
}
function cycleUn(id){
  const el=document.getElementById("un-"+id);
  const next={0:5,5:7,7:0}[Number(el.textContent)];
  el.textContent=next;el.className="unBtn "+(next===7?"v7":next===5?"v5":"v0");
  refreshTotal(id);
  autosave(id);
}
function autosave(id){
  clearTimeout(saveTimers[id]);
  setSync("Salvando...");
  saveTimers[id]=setTimeout(()=>saveScore(id),600);
}
async function saveScore(id,finished){
  const slotId=currentSlotId(),week=currentWeek();
  const{pd,pe,un}=readRow(id);
  const points=pd+pe+un;
  const payload={athlete_id:id,year:currentYear,month:currentMonth,week,slot_id:slotId,pd,pe,un,points,
    wins:0,draws:0,losses:0};
  if(finished!==undefined)payload.finished=finished;
  const{error}=await sb.from("scores").upsert(payload,{onConflict:"athlete_id,year,month,week,slot_id"});
  if(error){setSync("Erro ao salvar: "+error.message,"error");return;}
  // atualiza os dados em memória SEM redesenhar a tabela (evita a tela "pular")
  await loadScoresQuiet();
  setSync("Salvo.","ok");
}
async function loadScoresQuiet(){
  const{data,error}=await sb.from("scores").select("*").eq("year",currentYear).eq("month",currentMonth);
  if(!error)scores=data||[];
}
async function finishSlot(){
  const slotId=currentSlotId(),week=currentWeek();
  if(!slotId)return;
  const ids=slotAthleteIds(slotId);
  for(const id of ids){await saveScore(id,true);}
  setSync("Disputa deste horário finalizada.","ok");
  renderScorePage();
}

// ---------------- RANKING ----------------
function computeRanking(list,idFilter){
  const t={};
  list.forEach(s=>{if(idFilter&&!idFilter.includes(s.athlete_id))return;
    if(!t[s.athlete_id])t[s.athlete_id]={points:0};t[s.athlete_id].points+=s.points;});
  return Object.entries(t).map(([id,v])=>({athlete_id:id,...v})).sort((a,b)=>b.points-a.points);
}
function renderRanking(){
  document.getElementById("monthlyRanking").innerHTML=rankList(computeRanking(scores));
  document.getElementById("annualHeader").innerHTML="<th>Atleta</th>"+MONTH_NAMES.map(m=>`<th>${m}</th>`).join("")+"<th>Total</th>";
  const per={};
  annualScores.forEach(s=>{per[s.athlete_id]=per[s.athlete_id]||Array(13).fill(0);per[s.athlete_id][s.month-1]+=s.points;});
  Object.keys(per).forEach(id=>per[id][12]=per[id].slice(0,12).reduce((a,b)=>a+b,0));
  const rows=Object.entries(per).sort((a,b)=>b[1][12]-a[1][12]);
  document.getElementById("annualBody").innerHTML=rows.map(([id,v])=>`<tr><td style="text-align:left">${athleteName(id)}</td>${v.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="14">Sem pontuação em ${currentYear}.</td></tr>`;
}
function rankList(r){if(!r.length)return"<p class='smallText'>Sem pontuação neste mês ainda.</p>";
  return r.map((x,i)=>`<div class="rankRow"><span class="rankLeft"><span class="rankPos">${i+1}º</span> ${avatarHtml(x.athlete_id)} <span class="aName">${athleteName(x.athlete_id)}</span></span><strong>${x.points} pts</strong></div>`).join("");
}

// ---------------- MATA-MATA ----------------
async function generateBracket(){
  const week2=scores.filter(s=>s.week<=2);
  const ranking=computeRanking(week2);
  if(ranking.length<8)return alert("São necessários ao menos 8 atletas pontuados até a Semana 2.");
  const top8=ranking.slice(0,8);
  const pairs=[[0,7],[1,6],[2,5],[3,4]];
  if(!confirm("Isto substitui o mata-mata atual deste mês. Continuar?"))return;
  await sb.from("bracket_matches").delete().eq("year",currentYear).eq("month",currentMonth);
  const rows=pairs.map(([a,b],idx)=>({year:currentYear,month:currentMonth,phase:"quartas",
    athlete_a:top8[a].athlete_id,athlete_b:top8[b].athlete_id,
    score_a:top8[a].points,score_b:top8[b].points}));
  const{error}=await sb.from("bracket_matches").insert(rows);
  if(error)return alert("Erro: "+error.message);
  await loadBracket();renderBracket();setSync("Chaveamento gerado.","ok");
}
async function resetBracket(){if(!confirm("Apagar todo o mata-mata deste mês?"))return;await sb.from("bracket_matches").delete().eq("year",currentYear).eq("month",currentMonth);await loadBracket();renderBracket();}
async function saveMatchResult(id,sa,sb2){
  sa=Number(sa);sb2=Number(sb2);const m=bracket.find(x=>x.id===id);let w=null;
  if(sa>sb2)w=m.athlete_a;else if(sb2>sa)w=m.athlete_b;
  const{error}=await sb.from("bracket_matches").update({score_a:sa,score_b:sb2,winner:w}).eq("id",id);
  if(error)return alert("Erro: "+error.message);await loadBracket();renderBracket();
}
async function advancePhase(from,to){
  const ms=bracket.filter(m=>m.phase===from).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  if(ms.some(m=>!m.winner))return alert("Preencha todos os resultados antes de avançar.");
  const w=ms.map(m=>m.winner);const rows=[];
  for(let i=0;i<w.length;i+=2)rows.push({year:currentYear,month:currentMonth,phase:to,athlete_a:w[i],athlete_b:w[i+1]});
  await sb.from("bracket_matches").delete().eq("year",currentYear).eq("month",currentMonth).eq("phase",to);
  const{error}=await sb.from("bracket_matches").insert(rows);
  if(error)return alert("Erro: "+error.message);await loadBracket();renderBracket();
}
function renderBracket(){renderBracketInto("bracketArea",true);}
function renderBracketInto(elId,isAdmin){
  const el=document.getElementById(elId);
  const phases=[["quartas","Quartas de final"],["semi","Semifinal"],["final","Final"]];
  let html="";
  // descobre a colocação (seed) de cada atleta pelo ranking até semana 2
  const seedRank=computeRanking(scores.filter(s=>s.week<=2));
  const seedOf={};seedRank.forEach((r,i)=>seedOf[r.athlete_id]=i+1);
  phases.forEach(([phase,label])=>{
    const ms=bracket.filter(m=>m.phase===phase);if(!ms.length)return;
    html+=`<div class="phaseTitle ${phase==="final"?"final":""}">${label}</div><div class="bracketGrid">`;
    ms.forEach((m,i)=>{
      const aWin=m.winner===m.athlete_a,bWin=m.winner===m.athlete_b;
      const seedA=phase==="quartas"?seedOf[m.athlete_a]:null;
      const seedB=phase==="quartas"?seedOf[m.athlete_b]:null;
      html+=`<div class="matchCard"><h4>${label} #${i+1}</h4>
        <div class="matchTeams">
          <div class="teamBox ${aWin?"winner":""}">${teamInner(m.athlete_a,m.score_a,seedA)}</div>
          <div class="vsX">X</div>
          <div class="teamBox ${bWin?"winner":""}">${teamInner(m.athlete_b,m.score_b,seedB)}</div>
        </div>
        ${isAdmin?`<div class="matchScoreRow">
          <input type="number" min="0" value="${m.score_a??""}" id="sa-${m.id}">
          <input type="number" min="0" value="${m.score_b??""}" id="sb-${m.id}">
          <button class="success" onclick="saveMatchResult('${m.id}',document.getElementById('sa-${m.id}').value,document.getElementById('sb-${m.id}').value)">OK</button>
        </div>`:""}
      </div>`;
    });
    html+=`</div>`;
  });
  if(isAdmin){
    const hasQ=bracket.some(m=>m.phase==="quartas"),hasS=bracket.some(m=>m.phase==="semi"),hasF=bracket.some(m=>m.phase==="final");
    if(hasQ&&!hasS)html+=`<button class="success" onclick="advancePhase('quartas','semi')">Gerar semifinal</button>`;
    if(hasS&&!hasF)html+=`<button class="success" onclick="advancePhase('semi','final')">Gerar final</button>`;
  }
  el.innerHTML=html||"<p class='smallText'>Nenhum mata-mata gerado ainda neste mês.</p>";
}
function teamInner(id,score,seed){
  const p=athletePhoto(id);
  const img=p?`<img class="bigAvatar" src="${p}" onclick="openLightbox('${p}')">`:`<span class="tbd">${(athleteName(id)||"?").slice(0,1)}</span>`;
  return `${seed?`<div class="seed">${seed}º</div>`:""}${img}<div class="tname">${athleteName(id)}</div>${score!=null?`<div class="tpts">${score} pts</div>`:""}`;
}

// ---------------- DASHBOARD ----------------
function renderDashboard(){
  const active=new Set(slotAthletes.map(s=>s.athlete_id)).size;
  document.getElementById("dashActive").textContent=active;
  document.getElementById("dashTotal").textContent=athletes.length;
  document.getElementById("dashPoints").textContent=scores.reduce((s,r)=>s+r.points,0);
}

// ---------------- REGRAS ----------------
async function saveRules(){
  rulesTextValue=document.getElementById("rulesText").value;
  const{error}=await sb.from("competition_settings").upsert({id:1,rules:rulesTextValue,updated_at:new Date().toISOString()});
  if(error)return alert("Erro: "+error.message);
  setSync("Regras salvas.","ok");
}

// ---------------- CONFIG TOOLS ----------------
function copyLink(kind){const url=location.origin+location.pathname+"?"+kind+"=1";navigator.clipboard?.writeText(url);document.getElementById("linkText").textContent="Link copiado: "+url;}
async function exportBackup(){
  const[{data:a},{data:s},{data:b},{data:sl},{data:sa}]=await Promise.all([
    sb.from("athletes").select("*"),sb.from("scores").select("*"),sb.from("bracket_matches").select("*"),
    sb.from("schedule_slots").select("*"),sb.from("slot_athletes").select("*")]);
  const backup={exported_at:new Date().toISOString(),athletes:a,scores:s,bracket_matches:b,schedule_slots:sl,slot_athletes:sa};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const l=document.createElement("a");
  l.href=url;l.download=`primo-backup-${new Date().toISOString().slice(0,10)}.json`;l.click();URL.revokeObjectURL(url);
  setSync("Backup exportado.","ok");
}
async function loadHistory(){
  const{data,error}=await sb.from("athletes_history").select("*").order("changed_at",{ascending:false}).limit(50);
  if(error)return alert("Erro: "+error.message);
  document.getElementById("historyArea").innerHTML="<h3>Últimas 50 alterações</h3>"+(data.map(h=>`<div class="item"><span>${h.action.toUpperCase()} — ${h.snapshot?.full_name||"?"}</span><span class="smallText">${new Date(h.changed_at).toLocaleString("pt-BR")}</span></div>`).join("")||"<p class='smallText'>Sem alterações.</p>");
}

// ---------------- IMPRIMIR / STORIES ----------------
function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
async function generateStoryImage(kind){
  const c=document.getElementById("storyCanvas"),ctx=c.getContext("2d"),W=c.width,H=c.height;
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#0b52ff");g.addColorStop(.45,"#06117a");g.addColorStop(1,"#020817");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  try{const logo=await loadImage(window.PRIMO_CONFIG.logo);ctx.drawImage(logo,W/2-110,60,220,220);}catch(e){}
  ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font="900 62px Arial";ctx.fillText(window.PRIMO_CONFIG.appName,W/2,340);
  let title="",rows=[];
  if(kind==="ranking"){title=`RANKING • ${MONTH_NAMES[currentMonth-1]}/${currentYear}`;rows=computeRanking(scores).map((r,i)=>({pos:i+1,name:athleteName(r.athlete_id),value:r.points+" pts"}));}
  else if(kind==="anual"){title=`RANKING ANUAL • ${currentYear}`;const t={};annualScores.forEach(s=>t[s.athlete_id]=(t[s.athlete_id]||0)+s.points);rows=Object.entries(t).sort((a,b)=>b[1]-a[1]).map(([id,p],i)=>({pos:i+1,name:athleteName(id),value:p+" pts"}));}
  else{title=`MATA-MATA • ${MONTH_NAMES[currentMonth-1]}/${currentYear}`;const pl={quartas:"Quartas",semi:"Semi",final:"Final"};rows=bracket.map(m=>({pos:"",name:`${athleteName(m.athlete_a)} ${m.score_a??"-"} x ${m.score_b??"-"} ${athleteName(m.athlete_b)}`,value:pl[m.phase]||""}));}
  ctx.font="700 38px Arial";ctx.fillStyle="#7ee0ff";ctx.fillText(title,W/2,410);
  if(!rows.length){ctx.font="700 34px Arial";ctx.fillStyle="#dbeafe";ctx.fillText("Sem dados ainda.",W/2,500);}
  let y=500;ctx.textAlign="left";
  rows.slice(0,16).forEach(r=>{ctx.font="900 36px Arial";ctx.fillStyle="#fff";ctx.fillText((r.pos?r.pos+"º  ":"")+r.name,70,y,W-260);ctx.textAlign="right";ctx.fillStyle="#7ee0ff";ctx.font="900 32px Arial";ctx.fillText(String(r.value),W-70,y);ctx.textAlign="left";y+=74;});
  document.getElementById("storyPreviewCard").style.display="block";
  const link=document.getElementById("storyDownload");link.href=c.toDataURL("image/png");link.download=`primo-${kind}-${currentYear}-${currentMonth}.png`;
}

// ---------------- READONLY ----------------
function renderReadonly(){
  document.getElementById("readonlyRules").textContent=rulesTextValue||"Regras ainda não definidas.";
  document.getElementById("readonlyRanking").innerHTML=rankList(computeRanking(scores));
  renderBracketInto("readonlyBracket",false);
}

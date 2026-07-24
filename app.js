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

// torna qualquer erro visível na tela (em vez de falhar em silêncio)
window.addEventListener("error", (e) => {
  try{ setSync("Erro: " + (e.message || "desconhecido"), "error"); }catch(_){}
});
window.addEventListener("unhandledrejection", (e) => {
  const m = e && e.reason && e.reason.message ? e.reason.message : e.reason;
  try{ setSync("Erro: " + m, "error"); }catch(_){}
});

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
    document.getElementById("hero").classList.add("hidden");
    document.getElementById("syncStatus").classList.add("hidden");
    document.body.style.background = "#02060f url('fundo-atletas.png') no-repeat center top";
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundAttachment = "fixed";
    document.getElementById("readonlyLogo").src = window.PRIMO_CONFIG.logo;
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

function on(id,evt,fn){
  const el=document.getElementById(id);
  if(!el){console.warn("Elemento não encontrado:",id);return;}
  el.addEventListener(evt,fn);
}

function wireEvents(){
  document.querySelectorAll("#tabs button").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
  on("btnLogin","click",doLogin);
  on("btnLogout","click",doLogout);
  on("monthSelect","change",onMonthChange);
  on("newAthletePhoto","change",onNewPhotoChosen);
  on("changePhotoInput","change",onChangePhotoChosen);
  try{wireAdjuster();}catch(e){console.error("wireAdjuster:",e);}
  on("btnAddAthlete","click",addAthlete);
  on("scoreSlot","change",renderScorePage);
  on("scoreWeek","change",renderScorePage);
  on("btnFinishSlot","click",finishSlot);
  on("btnGenerateBracket","click",generateBracket);
  on("btnResetBracket","click",resetBracket);
  on("btnCopyStudentLink","click",()=>copyLink("aluno"));
  on("btnExportBackup","click",exportBackup);
  on("btnViewHistory","click",loadHistory);
  on("btnAddSlot","click",addScheduleSlot);
  on("btnSaveRules","click",saveRules);
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
function athletePhotoFull(id){const a=athlete(id);return a?(a.photo_full||a.photo_url):null;}
function athleteDisplayId(id){const a=athlete(id);return a?("#"+a.display_id):"";}
function avatarHtml(id){
  const p=athletePhoto(id),n=athleteName(id);
  return p?`<span class="avatar" onclick="openLightbox(athletePhotoFull('${id}'))"><img src="${p}" alt=""></span>`
          :`<span class="avatar">${(n||"?").slice(0,2).toUpperCase()}</span>`;
}

// ---------------- LIGHTBOX ----------------
function openLightbox(src){if(!src)return;document.getElementById("lightboxImg").src=src;document.getElementById("photoLightbox").classList.remove("hidden");}
function closeLightbox(){document.getElementById("photoLightbox").classList.add("hidden");}

// ---------------- CADASTRO ----------------
let pendingPhoto=null;
let pendingPhotoFull=null;
function onNewPhotoChosen(e){const f=e.target.files[0];if(!f)return;openAdjuster(f,(cropUrl,fullUrl)=>{pendingPhoto=cropUrl;pendingPhotoFull=fullUrl;document.getElementById("newPhotoPreview").innerHTML=`<img src="${cropUrl}" alt="">`;});}

// ===== AJUSTADOR DE FOTO (arrastar + zoom dentro do círculo) =====
let adj={img:null,scale:1,minScale:1,x:0,y:0,drag:false,lastX:0,lastY:0,onDone:null,size:320,out:400};
function openAdjuster(file,onDone){
  const r=new FileReader();
  r.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      adj.img=img;adj.onDone=onDone;
      // escala mínima para a imagem cobrir todo o círculo
      adj.minScale=Math.max(adj.size/img.width,adj.size/img.height);
      adj.scale=adj.minScale;
      // centraliza
      adj.x=(adj.size-img.width*adj.scale)/2;
      adj.y=(adj.size-img.height*adj.scale)/2;
      document.getElementById("adjustZoom").min=adj.minScale;
      document.getElementById("adjustZoom").max=adj.minScale*4;
      document.getElementById("adjustZoom").value=adj.scale;
      document.getElementById("photoAdjuster").classList.remove("hidden");
      drawAdjuster();
    };
    img.src=r.result;
  };
  r.readAsDataURL(file);
}
function drawAdjuster(){
  const c=document.getElementById("adjustCanvas"),ctx=c.getContext("2d");
  ctx.clearRect(0,0,adj.size,adj.size);
  ctx.fillStyle="#000";ctx.fillRect(0,0,adj.size,adj.size);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  ctx.drawImage(adj.img,adj.x,adj.y,adj.img.width*adj.scale,adj.img.height*adj.scale);
}
function clampAdjuster(){
  const w=adj.img.width*adj.scale,h=adj.img.height*adj.scale;
  if(adj.x>0)adj.x=0;if(adj.y>0)adj.y=0;
  if(adj.x<adj.size-w)adj.x=adj.size-w;
  if(adj.y<adj.size-h)adj.y=adj.size-h;
}
function adjusterPointer(clientX,clientY,type){
  const stage=document.getElementById("adjustStage").getBoundingClientRect();
  const px=clientX-stage.left, py=clientY-stage.top;
  if(type==="down"){adj.drag=true;adj.lastX=px;adj.lastY=py;}
  else if(type==="move"&&adj.drag){adj.x+=px-adj.lastX;adj.y+=py-adj.lastY;adj.lastX=px;adj.lastY=py;clampAdjuster();drawAdjuster();}
  else if(type==="up"){adj.drag=false;}
}
function wireAdjuster(){
  const stage=document.getElementById("adjustStage");
  stage.addEventListener("mousedown",e=>adjusterPointer(e.clientX,e.clientY,"down"));
  window.addEventListener("mousemove",e=>adjusterPointer(e.clientX,e.clientY,"move"));
  window.addEventListener("mouseup",e=>adjusterPointer(e.clientX,e.clientY,"up"));
  stage.addEventListener("touchstart",e=>{const t=e.touches[0];adjusterPointer(t.clientX,t.clientY,"down");},{passive:true});
  stage.addEventListener("touchmove",e=>{const t=e.touches[0];adjusterPointer(t.clientX,t.clientY,"move");e.preventDefault();},{passive:false});
  stage.addEventListener("touchend",()=>adjusterPointer(0,0,"up"));
  document.getElementById("adjustZoom").addEventListener("input",e=>{
    const cx=adj.size/2,cy=adj.size/2;
    const ns=Number(e.target.value);
    // faz o zoom manter o centro do círculo
    adj.x=cx-(cx-adj.x)*(ns/adj.scale);
    adj.y=cy-(cy-adj.y)*(ns/adj.scale);
    adj.scale=ns;clampAdjuster();drawAdjuster();
  });
  document.getElementById("adjustCancel").addEventListener("click",()=>{document.getElementById("photoAdjuster").classList.add("hidden");adj.img=null;});
  document.getElementById("adjustSave").addEventListener("click",()=>{
    // 1) versão CÍRCULO enquadrado (aparece nas tabelas/ranking/mata-mata)
    const out=adj.out,ratio=out/adj.size;
    const c=document.createElement("canvas");c.width=out;c.height=out;
    const ctx=c.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.save();ctx.beginPath();ctx.arc(out/2,out/2,out/2,0,Math.PI*2);ctx.closePath();ctx.clip();
    ctx.drawImage(adj.img,adj.x*ratio,adj.y*ratio,adj.img.width*adj.scale*ratio,adj.img.height*adj.scale*ratio);
    ctx.restore();
    const cropUrl=c.toDataURL("image/png");
    // 2) versão INTEIRA (aparece ao clicar/ampliar), redimensionada para no máx 900px
    const maxFull=900;
    const fs=Math.min(1,maxFull/Math.max(adj.img.width,adj.img.height));
    const fc=document.createElement("canvas");fc.width=adj.img.width*fs;fc.height=adj.img.height*fs;
    const fctx=fc.getContext("2d");fctx.imageSmoothingEnabled=true;fctx.imageSmoothingQuality="high";
    fctx.drawImage(adj.img,0,0,fc.width,fc.height);
    const fullUrl=fc.toDataURL("image/jpeg",0.85);
    document.getElementById("photoAdjuster").classList.add("hidden");
    const done=adj.onDone;adj.img=null;
    if(done)done(cropUrl,fullUrl);
  });
}

async function addAthlete(){
  const name=document.getElementById("newAthleteName").value.trim();
  if(!name)return alert("Digite o nome do atleta.");
  const{error}=await sb.from("athletes").insert({full_name:name,category:"Adulto",photo_url:pendingPhoto,photo_full:pendingPhotoFull,active:true});
  if(error)return alert("Erro ao cadastrar: "+error.message);
  document.getElementById("newAthleteName").value="";
  document.getElementById("newPhotoPreview").innerHTML="+ foto";pendingPhoto=null;pendingPhotoFull=null;
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
  openAdjuster(f,async(cropUrl,fullUrl)=>{
    setSync("Enviando foto...");
    const{error}=await sb.from("athletes").update({photo_url:cropUrl,photo_full:fullUrl}).eq("id",id);
    if(error){setSync("Erro ao trocar foto: "+error.message,"error");return;}
    await loadAthletes();renderAthletesTable();setSync("Foto atualizada.","ok");
  });
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
        return `<div class="item"><span class="rankLeft">${avatarHtml(aid)} ${athleteName(aid)}</span>
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
      ${ids.map(aid=>`<div class="item"><span class="rankLeft">${avatarHtml(aid)} ${athleteName(aid)}</span></div>`).join("")||"<p class='smallText'>Nenhum atleta.</p>"}
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
      <td class="sticky">${avatarHtml(id)} ${athleteName(id)}</td>
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
  // UN é um <button> (valor no texto); P/D e P/E são <input> (valor em .value)
  if(field==="un")return Number(el.textContent||0);
  return Number(el.value||0);
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
  return r.map((x,i)=>`<div class="rankRow${i<3?" pos"+(i+1):""}"><span class="rankLeft"><span class="rankPos">${i+1}º</span> ${avatarHtml(x.athlete_id)} <span class="aName">${athleteName(x.athlete_id)}</span></span><strong>${x.points} pts</strong></div>`).join("");
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
    score_a:null,score_b:null}));
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
  const img=p?`<img class="bigAvatar" src="${p}" onclick="openLightbox(athletePhotoFull('${id}'))">`:`<span class="tbd">${(athleteName(id)||"?").slice(0,1)}</span>`;
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
  try{
    setSync("Gerando imagem...");
    if(kind==="anual"&&(!annualScores||!annualScores.length)){await loadAnnualScores();}
    const url = (kind==="matamata") ? await generateBracketImage() : await drawRankingStory(kind);
    if(!url)throw new Error("imagem vazia");
    finishStory(kind,url);
  }catch(err){
    console.error(err);
    setSync("Erro ao gerar imagem: "+(err&&err.message?err.message:err),"error");
    alert("Não consegui gerar a imagem: "+(err&&err.message?err.message:err));
  }
}

async function drawRankingStory(kind){
  const S=2, W=1080, H=1920;
  const c=document.createElement("canvas");
  c.width=W*S;c.height=H*S;
  const ctx=c.getContext("2d");
  ctx.scale(S,S);

  // ---------- dados ----------
  let rows=[],subtitle="";
  const tot={};
  if(kind==="anual"){
    subtitle="MAIOR PONTUADOR DO ANO";
    annualScores.forEach(s=>tot[s.athlete_id]=(tot[s.athlete_id]||0)+s.points);
  }else{
    subtitle="MAIOR PONTUADOR";
    scores.forEach(s=>tot[s.athlete_id]=(tot[s.athlete_id]||0)+s.points);
  }
  rows=athletes.filter(a=>a.active).map(a=>({id:a.id,name:a.full_name,pts:tot[a.id]||0}));
  rows.sort((a,b)=>(b.pts-a.pts)||a.name.localeCompare(b.name));
  rows.forEach((r,i)=>r.pos=i+1);

  // informacoes da competicao
  const weeksSet=new Set((kind==="anual"?annualScores:scores).map(s=>s.week).filter(Boolean));
  const semanaAtual=weeksSet.size?Math.max(...weeksSet):0;
  const rodadas=(kind==="anual"?annualScores:scores).length;

  neonBackground(ctx,W,H);

  // ---------- logo + estrelas ----------
  ctx.textAlign="center";
  ctx.fillStyle="#e8eefb";ctx.font="700 26px Arial";
  ctx.fillText("★  ★  ★  ★  ★",W/2,34);
  try{
    const logo=await loadImage(window.PRIMO_CONFIG.logo);
    ctx.drawImage(logo,W/2-88,40,176,176);
  }catch(e){}

  // ---------- painel externo ----------
  glassPanel(ctx,42,232,W-84,H-274,32);

  chromeText(ctx,"PRIMO SOCCER",W/2,322,"900 82px Arial");
  ctx.fillStyle="#5aa8ff";ctx.font="700 32px Arial";ctx.textAlign="center";
  ctx.fillText("L E A G U E   2 0 2 6",W/2,368);
  neonLine(ctx,150,358,258,358);
  neonLine(ctx,W-258,358,W-150,358);

  // pilula do mes
  neonPill(ctx,W/2-235,388,470,66,"MÊS: "+FULL_MONTH_NAMES[currentMonth-1].toUpperCase(),"700 38px Arial");

  // ---------- barra de informacoes da competicao ----------
  const infoY=474;
  const infos=[["ATLETAS",String(rows.length)],["SEMANA",semanaAtual?String(semanaAtual):"-"],["LANÇAMENTOS",String(rodadas)]];
  const iw=(W-84-24*2)/3, ix0=42+24;
  infos.forEach((it,i)=>{
    const x=ix0+i*iw;
    ctx.save();
    ctx.shadowColor="rgba(60,160,255,.55)";ctx.shadowBlur=14;
    ctx.strokeStyle="rgba(110,190,255,.7)";ctx.lineWidth=1.8;
    roundRect(ctx,x+6,infoY,iw-12,54,14);ctx.stroke();
    ctx.restore();
    ctx.textAlign="center";
    ctx.fillStyle="#7fbcff";ctx.font="700 15px Arial";
    ctx.fillText(it[0],x+iw/2,infoY+21);
    ctx.fillStyle="#ffffff";ctx.font="700 24px Arial";
    ctx.fillText(it[1],x+iw/2,infoY+45);
  });

  // ---------- painel interno ----------
  const inX=64,inY=548,inW=W-128,inH=H-inY-70;
  glassPanel(ctx,inX,inY,inW,inH,26);

  chromeText(ctx,"CLASSIFICAÇÃO GERAL",W/2,inY+66,"italic 900 54px Arial");
  ctx.fillStyle="#5aa8ff";ctx.font="700 24px Arial";ctx.textAlign="center";
  ctx.fillText(subtitle.split("").join(" "),W/2,inY+104);

  if(!rows.length){
    ctx.fillStyle="#cfe0f5";ctx.font="700 30px Arial";
    ctx.fillText("Nenhum atleta cadastrado.",W/2,inY+200);
    return c.toDataURL("image/png");
  }

  // ---------- linhas ----------
  const listTop=inY+128, listBottom=inY+inH-22;
  const avail=listBottom-listTop;
  const gap=5;
  let rowH=Math.min(60,Math.floor(avail/rows.length));
  if(rowH<24)rowH=24;
  const shown=rows.slice(0,Math.floor(avail/rowH));
  const barH=rowH-gap;
  const fs=Math.max(14,Math.min(26,Math.round(barH*0.52)));
  const pr=Math.max(10,Math.min(19,Math.round(barH*0.40)));
  const rowX=inX+20, rowW=inW-40;

  const medals=[
    {fill:"#c8971f",edge:"#ffd76a",txt:"#ffd76a"},
    {fill:"#8e9aa8",edge:"#eef4fb",txt:"#ffffff"},
    {fill:"#b06a2e",edge:"#e79b57",txt:"#f3b077"}
  ];

  for(let i=0;i<shown.length;i++){
    const r=shown[i], y=listTop+i*rowH, m=i<3?medals[i]:null;
    if(m){
      const g=ctx.createLinearGradient(rowX,y,rowX+rowW,y);
      g.addColorStop(0,"rgba(8,16,32,.95)");
      g.addColorStop(.45,hexA(m.fill,.42));
      g.addColorStop(1,hexA(m.fill,.16));
      ctx.fillStyle=g;
    }else{
      const g=ctx.createLinearGradient(rowX,y,rowX,y+barH);
      g.addColorStop(0,"rgba(10,22,44,.88)");
      g.addColorStop(1,"rgba(5,12,26,.92)");
      ctx.fillStyle=g;
    }
    roundRect(ctx,rowX,y,rowW,barH,barH/2);ctx.fill();
    ctx.save();
    ctx.shadowColor=m?hexA(m.edge,.75):"rgba(70,150,255,.5)";
    ctx.shadowBlur=m?14:8;
    ctx.strokeStyle=m?m.edge:"rgba(95,165,240,.65)";
    ctx.lineWidth=m?2.4:1.4;
    roundRect(ctx,rowX,y,rowW,barH,barH/2);ctx.stroke();
    ctx.restore();

    const cy=y+barH/2;
    ctx.textAlign="right";ctx.fillStyle=m?m.txt:"#e8f1ff";
    ctx.font=`700 ${fs}px Arial`;
    ctx.fillText(r.pos+"º",rowX+56,cy+fs*0.35);

    const cx=rowX+56+12+pr;
    const photo=athletePhoto(r.id);
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,pr,0,Math.PI*2);ctx.closePath();ctx.clip();
    if(photo){try{const img=await loadImage(photo);ctx.drawImage(img,cx-pr,cy-pr,pr*2,pr*2);}catch(e){ctx.fillStyle="#08172e";ctx.fillRect(cx-pr,cy-pr,pr*2,pr*2);}}
    else{ctx.fillStyle="#08172e";ctx.fillRect(cx-pr,cy-pr,pr*2,pr*2);}
    ctx.restore();
    ctx.save();
    ctx.shadowColor=m?hexA(m.edge,.9):"rgba(70,160,255,.8)";ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(cx,cy,pr,0,Math.PI*2);
    ctx.lineWidth=2;ctx.strokeStyle=m?m.edge:"#4d9bff";ctx.stroke();
    ctx.restore();

    ctx.textAlign="left";ctx.fillStyle="#ffffff";
    ctx.font=`700 ${fs}px Arial`;
    const nameX=cx+pr+16;
    ctx.fillText(r.name.toUpperCase(),nameX,cy+fs*0.35,rowW-(nameX-rowX)-150);

    ctx.textAlign="right";ctx.fillStyle=m?m.txt:"#ffffff";
    ctx.font=`700 ${fs}px Arial`;
    ctx.fillText(r.pts+" pts",rowX+rowW-22,cy+fs*0.35);
  }

  if(shown.length<rows.length){
    ctx.textAlign="center";ctx.fillStyle="#9dbde0";ctx.font="700 20px Arial";
    ctx.fillText("+"+(rows.length-shown.length)+" atletas",W/2,listBottom+18);
  }
  ctx.textAlign="center";
  return c.toDataURL("image/png");
}

// ======== helpers visuais (fundo escuro + vidro + neon) ========
function neonBackground(ctx,W,H){
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#050d1c");bg.addColorStop(.45,"#030913");bg.addColorStop(1,"#02060e");
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.globalCompositeOperation="lighter";
  [[-180,.26,300],[120,.14,180],[880,.22,260],[1160,.12,200]].forEach(([x,a,wd])=>{
    const g=ctx.createLinearGradient(x,0,x+wd+260,H);
    g.addColorStop(0,"rgba(20,90,190,0)");
    g.addColorStop(.5,`rgba(48,140,255,${a})`);
    g.addColorStop(1,"rgba(20,90,190,0)");
    ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+wd,0);ctx.lineTo(x+wd+300,H);ctx.lineTo(x+300,H);ctx.closePath();ctx.fill();
  });
  ctx.restore();
  const halo=ctx.createRadialGradient(W/2,200,20,W/2,200,640);
  halo.addColorStop(0,"rgba(50,140,255,.24)");halo.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=halo;ctx.fillRect(0,0,W,560);
  ctx.save();ctx.globalAlpha=.09;ctx.strokeStyle="#3f97ff";ctx.lineWidth=1.1;
  for(let hy=H-230;hy<H+20;hy+=24){
    for(let hx=((hy/24)|0)%2?0:15;hx<W+20;hx+=30){
      ctx.beginPath();
      for(let k=0;k<6;k++){
        const ang=Math.PI/3*k-Math.PI/6, px=hx+13*Math.cos(ang), py=hy+13*Math.sin(ang);
        k?ctx.lineTo(px,py):ctx.moveTo(px,py);
      }
      ctx.closePath();ctx.stroke();
    }
  }
  ctx.restore();
}

function glassPanel(ctx,x,y,w,h,r){
  ctx.save();
  const g=ctx.createLinearGradient(x,y,x+w*0.6,y+h);
  g.addColorStop(0,"rgba(26,64,120,.34)");
  g.addColorStop(.45,"rgba(8,22,46,.30)");
  g.addColorStop(1,"rgba(3,10,22,.44)");
  ctx.fillStyle=g;
  roundRect(ctx,x,y,w,h,r);ctx.fill();
  // brilho neon externo
  ctx.shadowColor="rgba(60,170,255,.9)";ctx.shadowBlur=30;
  ctx.strokeStyle="rgba(120,200,255,1)";ctx.lineWidth=3.2;
  roundRect(ctx,x,y,w,h,r);ctx.stroke();
  ctx.shadowBlur=0;
  // linha interna clara
  ctx.strokeStyle="rgba(255,255,255,.22)";ctx.lineWidth=1.2;
  roundRect(ctx,x+7,y+7,w-14,h-14,Math.max(4,r-6));ctx.stroke();
  // reflexo diagonal (vidro)
  ctx.save();
  roundRect(ctx,x,y,w,h,r);ctx.clip();
  const sh=ctx.createLinearGradient(x,y,x+w*0.75,y+h*0.5);
  sh.addColorStop(0,"rgba(255,255,255,.13)");
  sh.addColorStop(.5,"rgba(255,255,255,.03)");
  sh.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=sh;ctx.fillRect(x,y,w,h*0.55);
  ctx.restore();
  ctx.restore();
}

function neonLine(ctx,x1,y1,x2,y2){
  ctx.save();
  ctx.shadowColor="rgba(60,160,255,.9)";ctx.shadowBlur=12;
  ctx.strokeStyle="#3f97ff";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.restore();
}

function neonPill(ctx,x,y,w,h,text,font){
  ctx.save();
  const g=ctx.createLinearGradient(x,y,x,y+h);
  g.addColorStop(0,"rgba(18,44,86,.55)");g.addColorStop(1,"rgba(5,14,30,.6)");
  ctx.fillStyle=g;roundRect(ctx,x,y,w,h,h/2);ctx.fill();
  ctx.shadowColor="rgba(70,175,255,.95)";ctx.shadowBlur=22;
  ctx.strokeStyle="#6fc0ff";ctx.lineWidth=3;
  roundRect(ctx,x,y,w,h,h/2);ctx.stroke();
  ctx.restore();
  ctx.fillStyle="#f2f8ff";ctx.font=font;ctx.textAlign="center";
  ctx.fillText(text,x+w/2,y+h/2+parseInt(font.match(/(\d+)px/)[1],10)*0.35);
}

// texto cromado (prata metalico)
function chromeText(ctx,text,x,y,font){
  ctx.save();
  ctx.font=font;ctx.textAlign="center";
  const size=parseInt(font.match(/(\d+)px/)[1],10);
  const g=ctx.createLinearGradient(0,y-size*0.82,0,y+size*0.18);
  g.addColorStop(0,"#ffffff");
  g.addColorStop(.30,"#d6e2f0");
  g.addColorStop(.50,"#8fa2b8");
  g.addColorStop(.58,"#f2f7ff");
  g.addColorStop(1,"#93a8c0");
  ctx.shadowColor="rgba(60,160,255,.6)";ctx.shadowBlur=20;
  ctx.fillStyle=g;ctx.fillText(text,x,y);
  ctx.shadowBlur=0;
  ctx.lineWidth=1.6;ctx.strokeStyle="rgba(6,20,44,.9)";
  ctx.strokeText(text,x,y);
  ctx.restore();
}

// texto dourado
function goldText(ctx,text,x,y,font){
  ctx.save();
  ctx.font=font;ctx.textAlign="center";
  const size=parseInt(font.match(/(\d+)px/)[1],10);
  const g=ctx.createLinearGradient(0,y-size*0.82,0,y+size*0.18);
  g.addColorStop(0,"#fff3c9");
  g.addColorStop(.35,"#f3cf6b");
  g.addColorStop(.55,"#b8871f");
  g.addColorStop(.7,"#ffe9a8");
  g.addColorStop(1,"#c79a2c");
  ctx.shadowColor="rgba(255,190,60,.55)";ctx.shadowBlur=18;
  ctx.fillStyle=g;ctx.fillText(text,x,y);
  ctx.shadowBlur=0;
  ctx.lineWidth=1.5;ctx.strokeStyle="rgba(40,25,0,.75)";
  ctx.strokeText(text,x,y);
  ctx.restore();
}

function hexA(hex,a){
  const n=parseInt(hex.slice(1),16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
function finishStory(kind,url){
  const card=document.getElementById("storyPreviewCard");
  if(card)card.style.display="block";
  const prev=document.getElementById("storyPreviewImg");
  if(prev)prev.src=url;
  const link=document.getElementById("storyDownload");
  if(link){link.href=url;link.download=`primo-${kind}-${currentYear}-${currentMonth}.png`;}
  setSync("Imagem gerada. Toque e segure nela para salvar.","ok");
  if(card&&card.scrollIntoView)setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"start"}),100);
}

// desenha um card de atleta no chaveamento
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

// ---- card de atleta no chaveamento (estilo vidro) ----
async function bracketCard(ctx,x,y,w,h,athleteId,seed,winner){
  ctx.save();
  const g=ctx.createLinearGradient(x,y,x+w*0.7,y+h);
  g.addColorStop(0,"rgba(30,70,130,.40)");
  g.addColorStop(.5,"rgba(8,22,46,.34)");
  g.addColorStop(1,"rgba(3,10,22,.5)");
  ctx.fillStyle=g;roundRect(ctx,x,y,w,h,18);ctx.fill();
  ctx.shadowColor=winner?"rgba(255,200,80,.9)":"rgba(60,170,255,.85)";ctx.shadowBlur=22;
  ctx.strokeStyle=winner?"#ffd76a":"rgba(120,200,255,.95)";ctx.lineWidth=2.6;
  roundRect(ctx,x,y,w,h,18);ctx.stroke();
  ctx.shadowBlur=0;
  ctx.strokeStyle="rgba(255,255,255,.20)";ctx.lineWidth=1;
  roundRect(ctx,x+6,y+6,w-12,h-12,13);ctx.stroke();
  ctx.restore();

  const r=Math.min(w,h)*0.30;
  const cx=x+w/2, cy=y+h*0.42;
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.closePath();ctx.clip();
  const photo=athleteId?athletePhoto(athleteId):null;
  if(photo){try{const img=await loadImage(photo);ctx.drawImage(img,cx-r,cy-r,r*2,r*2);}catch(e){ctx.fillStyle="#07162c";ctx.fillRect(cx-r,cy-r,r*2,r*2);}}
  else{ctx.fillStyle="#07162c";ctx.fillRect(cx-r,cy-r,r*2,r*2);}
  ctx.restore();
  ctx.save();
  ctx.shadowColor="rgba(70,175,255,.95)";ctx.shadowBlur=16;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.lineWidth=3;ctx.strokeStyle=winner?"#ffd76a":"#5fb0ff";ctx.stroke();
  ctx.restore();

  if(seed){
    ctx.save();
    ctx.font="900 26px Arial";ctx.textAlign="left";
    const gg=ctx.createLinearGradient(0,y+14,0,y+40);
    gg.addColorStop(0,"#fff3c9");gg.addColorStop(.6,"#e8b93f");gg.addColorStop(1,"#c79a2c");
    ctx.fillStyle=gg;ctx.fillText(seed+"º",x+16,y+42);
    ctx.restore();
  }
  ctx.fillStyle=winner?"#ffd76a":"#ffffff";
  ctx.font="700 20px Arial";ctx.textAlign="center";
  ctx.fillText((athleteName(athleteId)||"").toUpperCase(),cx,y+h-18,w-18);
}

function bracketTbd(ctx,x,y,w,h,label){
  ctx.save();
  const g=ctx.createLinearGradient(x,y,x+w*0.7,y+h);
  g.addColorStop(0,"rgba(20,50,96,.30)");
  g.addColorStop(1,"rgba(3,10,22,.45)");
  ctx.fillStyle=g;roundRect(ctx,x,y,w,h,18);ctx.fill();
  ctx.shadowColor="rgba(60,170,255,.6)";ctx.shadowBlur=18;
  ctx.strokeStyle="rgba(110,190,255,.8)";ctx.lineWidth=2.2;
  roundRect(ctx,x,y,w,h,18);ctx.stroke();
  ctx.restore();
  const r=Math.min(w,h)*0.28, cx=x+w/2, cy=y+h*0.42;
  ctx.save();
  ctx.setLineDash([7,7]);ctx.strokeStyle="rgba(120,200,255,.75)";ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
  ctx.restore();
  ctx.fillStyle="#7fc4ff";ctx.font="900 44px Arial";ctx.textAlign="center";
  ctx.fillText("?",cx,cy+16);
  ctx.fillStyle="#cfe2f7";ctx.font="700 17px Arial";
  ctx.fillText(label||"A DEFINIR",cx,y+h-18);
}

function goldX(ctx,x,y){
  ctx.save();
  ctx.font="900 40px Arial";ctx.textAlign="center";
  const g=ctx.createLinearGradient(0,y-30,0,y+8);
  g.addColorStop(0,"#fff3c9");g.addColorStop(.55,"#e8b93f");g.addColorStop(1,"#b8871f");
  ctx.shadowColor="rgba(255,190,60,.6)";ctx.shadowBlur=14;
  ctx.fillStyle=g;ctx.fillText("X",x,y);
  ctx.restore();
}

async function generateBracketImage(){
  const S=2, W=1080, H=1920;
  const c=document.createElement("canvas");
  c.width=W*S;c.height=H*S;
  const ctx=c.getContext("2d");
  ctx.scale(S,S);

  neonBackground(ctx,W,H);

  // logos laterais
  try{const logo=await loadImage(window.PRIMO_CONFIG.logo);
    ctx.drawImage(logo,34,34,150,150);
    ctx.drawImage(logo,W-184,34,150,150);}catch(e){}

  // titulos
  chromeText(ctx,"PRIMO SOCCER",W/2,110,"900 74px Arial");
  chromeText(ctx,"MATA-MATA",W/2,172,"italic 900 54px Arial");
  ctx.font="italic 900 52px Arial";
  const t1="QUARTAS DE ", t2="FINAL";
  const w1=ctx.measureText(t1).width, w2=ctx.measureText(t2).width;
  const startX=W/2-(w1+w2)/2;
  ctx.save();ctx.textAlign="left";
  chromeTextLeft(ctx,t1,startX,232,"italic 900 52px Arial");
  ctx.font="italic 900 52px Arial";
  ctx.shadowColor="rgba(70,175,255,.8)";ctx.shadowBlur=18;
  ctx.fillStyle="#4da3ff";ctx.fillText(t2,startX+w1,232);
  ctx.restore();

  ctx.textAlign="center";ctx.fillStyle="#cfe2f7";ctx.font="700 24px Arial";
  ctx.fillText("Início: Semana 3  |  Classificação até o fim da Semana 2",W/2,280);

  const q=bracket.filter(m=>m.phase==="quartas");
  const semi=bracket.filter(m=>m.phase==="semi");
  const final=bracket.filter(m=>m.phase==="final");
  const seedRank=computeRanking(scores.filter(s=>s.week<=2));
  const seedOf={};seedRank.forEach((r,i)=>seedOf[r.athlete_id]=i+1);

  if(!q.length){
    glassPanel(ctx,42,330,W-84,300,26);
    ctx.fillStyle="#dbeafe";ctx.font="700 30px Arial";ctx.textAlign="center";
    ctx.fillText("Gere o chaveamento na aba Mata-mata.",W/2,490);
    return c.toDataURL("image/png");
  }

  // ---------- painel QUARTAS ----------
  const pQx=40,pQy=312,pQw=W-80,pQh=640;
  glassPanel(ctx,pQx,pQy,pQw,pQh,26);
  goldText(ctx,"QUARTAS DE FINAL",W/2,pQy+62,"900 44px Arial");

  const cardW=196,cardH=196,xg=42;
  const colX=[pQx+26, pQx+26+cardW+xg, W/2+34, W/2+34+cardW+xg];
  const rowsY=[pQy+118, pQy+380];

  for(let i=0;i<q.length && i<4;i++){
    const m=q[i];
    const isRight = i>=2;
    const rowIdx = i%2;
    const x0 = isRight?colX[2]:colX[0];
    const x1 = isRight?colX[3]:colX[1];
    const y = rowsY[rowIdx];
    ctx.textAlign="center";ctx.fillStyle="#dce9fa";ctx.font="700 22px Arial";
    ctx.fillText("QUARTAS #"+(i+1),(x0+x1+cardW)/2,y-14);
    await bracketCard(ctx,x0,y,cardW,cardH,m.athlete_a,seedOf[m.athlete_a],m.winner===m.athlete_a);
    goldX(ctx,(x0+cardW+x1)/2,y+cardH/2+12);
    await bracketCard(ctx,x1,y,cardW,cardH,m.athlete_b,seedOf[m.athlete_b],m.winner===m.athlete_b);
  }

  // ---------- painel SEMI ----------
  const pSy=pQy+pQh+34, pSh=308;
  glassPanel(ctx,pQx,pSy,pQw,pSh,26);
  goldText(ctx,"SEMI FINAL",W/2,pSy+58,"900 42px Arial");
  const semiY=pSy+96, sCardH=170;
  for(let i=0;i<2;i++){
    const x0=i===0?colX[0]:colX[2], x1=i===0?colX[1]:colX[3];
    ctx.textAlign="center";ctx.fillStyle="#dce9fa";ctx.font="700 22px Arial";
    ctx.fillText("SEMI #"+(i+1),(x0+x1+cardW)/2,semiY-12);
    const m=semi[i];
    if(m){
      await bracketCard(ctx,x0,semiY,cardW,sCardH,m.athlete_a,null,m.winner===m.athlete_a);
      goldX(ctx,(x0+cardW+x1)/2,semiY+sCardH/2+12);
      await bracketCard(ctx,x1,semiY,cardW,sCardH,m.athlete_b,null,m.winner===m.athlete_b);
    }else{
      bracketTbd(ctx,x0,semiY,cardW,sCardH);
      goldX(ctx,(x0+cardW+x1)/2,semiY+sCardH/2+12);
      bracketTbd(ctx,x1,semiY,cardW,sCardH);
    }
  }

  // ---------- FINAL ----------
  const fTitleY=pSy+pSh+72;
  ctx.save();
  ctx.font="900 52px Arial";ctx.textAlign="center";
  ctx.shadowColor="rgba(70,175,255,.85)";ctx.shadowBlur=20;
  ctx.fillStyle="#5fb0ff";ctx.fillText("FINAL",W/2,fTitleY);
  ctx.restore();
  ctx.fillStyle="#dce9fa";ctx.font="700 22px Arial";ctx.textAlign="center";
  ctx.fillText("FINAL #1",W/2,fTitleY+34);
  const fY=fTitleY+52, fCardH=170;
  const fx0=W/2-cardW-30, fx1=W/2+30;
  const fm=final[0];
  if(fm){
    await bracketCard(ctx,fx0,fY,cardW,fCardH,fm.athlete_a,null,fm.winner===fm.athlete_a);
    await bracketCard(ctx,fx1,fY,cardW,fCardH,fm.athlete_b,null,fm.winner===fm.athlete_b);
  }else{
    bracketTbd(ctx,fx0,fY,cardW,fCardH,"A DEFINIR");
    bracketTbd(ctx,fx1,fY,cardW,fCardH,"VENCEDOR");
  }
  goldX(ctx,W/2,fY+fCardH/2+12);

  // trofeu
  drawTrophy(ctx,W/2,fY+fCardH+66,1.5);

  // pilula do mes no rodape
  neonPill(ctx,W/2-160,H-92,320,54,`${FULL_MONTH_NAMES[currentMonth-1]}/${currentYear}`,"700 26px Arial");

  return c.toDataURL("image/png");
}

function chromeTextLeft(ctx,text,x,y,font){
  ctx.save();
  ctx.font=font;ctx.textAlign="left";
  const size=parseInt(font.match(/(\d+)px/)[1],10);
  const g=ctx.createLinearGradient(0,y-size*0.82,0,y+size*0.18);
  g.addColorStop(0,"#ffffff");g.addColorStop(.30,"#d6e2f0");
  g.addColorStop(.50,"#8fa2b8");g.addColorStop(.58,"#f2f7ff");g.addColorStop(1,"#93a8c0");
  ctx.shadowColor="rgba(60,160,255,.6)";ctx.shadowBlur=18;
  ctx.fillStyle=g;ctx.fillText(text,x,y);
  ctx.shadowBlur=0;
  ctx.lineWidth=1.6;ctx.strokeStyle="rgba(6,20,44,.9)";ctx.strokeText(text,x,y);
  ctx.restore();
}

function drawTrophy(ctx,cx,cy,scale){
  ctx.save();
  if(scale){ctx.translate(cx,cy);ctx.scale(scale,scale);ctx.translate(-cx,-cy);}
  const g=ctx.createLinearGradient(cx-50,cy-70,cx+50,cy+50);
  g.addColorStop(0,"#fff0bf");g.addColorStop(.35,"#f0c451");
  g.addColorStop(.6,"#c8951f");g.addColorStop(1,"#ffe9a8");
  ctx.shadowColor="rgba(255,190,60,.6)";ctx.shadowBlur=22;
  ctx.fillStyle=g;ctx.strokeStyle="#8f6b12";ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(cx-42,cy-64);ctx.lineTo(cx+42,cy-64);
  ctx.lineTo(cx+29,cy-8);ctx.quadraticCurveTo(cx,cy+22,cx-29,cy-8);ctx.closePath();
  ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;
  ctx.beginPath();ctx.arc(cx-50,cy-50,19,Math.PI*0.42,Math.PI*1.6,false);ctx.stroke();
  ctx.beginPath();ctx.arc(cx+50,cy-50,19,Math.PI*1.42,Math.PI*0.58,true);ctx.stroke();
  ctx.fillRect(cx-6,cy-8,12,32);
  ctx.fillRect(cx-28,cy+24,56,13);
  ctx.fillRect(cx-38,cy+37,76,12);
  ctx.strokeRect(cx-28,cy+24,56,13);
  ctx.strokeRect(cx-38,cy+37,76,12);
  ctx.restore();
}
// ---------------- READONLY ----------------
function renderReadonly(){
  document.getElementById("readonlyRules").textContent=rulesTextValue||"Regras ainda não definidas.";
  document.getElementById("readonlyRanking").innerHTML=rankList(computeRanking(scores));

  // botão de salvar a classificação como imagem
  const rankArea=document.getElementById("readonlyRanking");
  const btn=document.createElement("button");
  btn.className="success saveImgBtn";
  btn.textContent="Salvar classificação como imagem";
  btn.onclick=async()=>{
    btn.textContent="Gerando...";
    try{
      const url=await drawRankingStory("ranking");
      showSaveBox(rankArea,url,"Classificação");
      btn.remove();
    }catch(err){btn.textContent="Erro: "+(err.message||err);}
  };
  rankArea.parentNode.appendChild(btn);

  const area=document.getElementById("readonlyBracket");
  if(!bracket.length){area.innerHTML="<p class='smallText'>Mata-mata ainda não gerado neste mês.</p>";return;}
  area.innerHTML="<p class='smallText' style='text-align:center'>Carregando chaveamento...</p>";
  generateBracketImage().then(url=>{
    area.innerHTML="";
    showSaveBox(area,url,"Chaveamento");
  }).catch(err=>{
    console.error(err);
    area.innerHTML="<p class='smallText'>Não foi possível carregar o chaveamento.</p>";
  });
}

function showSaveBox(container,url,label){
  const box=document.createElement("div");
  box.innerHTML=`
    <img class="roBracketImg" src="${url}" alt="${label}">
    <a class="success storyDownloadBtn" href="${url}" download="primo-${label.toLowerCase()}-${currentYear}-${currentMonth}.png">Baixar ${label}</a>
    <p class="smallText" style="text-align:center;margin-top:6px">No iPhone: toque e segure na imagem e escolha "Salvar em Fotos".</p>`;
  container.appendChild(box);
}

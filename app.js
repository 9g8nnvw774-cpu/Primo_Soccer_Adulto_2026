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

function wireEvents(){
  document.querySelectorAll("#tabs button").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
  document.getElementById("btnLogin").addEventListener("click",doLogin);
  document.getElementById("btnLogout").addEventListener("click",doLogout);
  document.getElementById("monthSelect").addEventListener("change",onMonthChange);
  document.getElementById("newAthletePhoto").addEventListener("change",onNewPhotoChosen);
  document.getElementById("changePhotoInput").addEventListener("change",onChangePhotoChosen);
  wireAdjuster();
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
    if(kind==="matamata"){await generateBracketImage();return;}
    if(kind==="anual"&&(!annualScores||!annualScores.length)){await loadAnnualScores();}
    await drawRankingStory(kind);
  }catch(err){
    console.error(err);
    setSync("Erro ao gerar imagem: "+(err&&err.message?err.message:err),"error");
    alert("Não consegui gerar a imagem: "+(err&&err.message?err.message:err));
  }
}

async function drawRankingStory(kind){
  const c=document.getElementById("storyCanvas"),ctx=c.getContext("2d"),W=c.width,H=c.height;

  // fundo escuro com brilho (igual ao link)
  ctx.fillStyle="#02060f";ctx.fillRect(0,0,W,H);
  const glow=ctx.createRadialGradient(W/2,340,60,W/2,340,820);
  glow.addColorStop(0,"rgba(22,64,140,.55)");glow.addColorStop(1,"rgba(2,6,15,0)");
  ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);

  // dados
  let rows=[],subtitle="";
  if(kind==="ranking"){
    subtitle="MAIOR PONTUADOR";
    rows=computeRanking(scores).map((r,i)=>({pos:i+1,id:r.athlete_id,name:athleteName(r.athlete_id),pts:r.points}));
  }else{
    subtitle="RANKING ANUAL "+currentYear;
    const t={};annualScores.forEach(s=>t[s.athlete_id]=(t[s.athlete_id]||0)+s.points);
    rows=Object.entries(t).sort((a,b)=>b[1]-a[1]).map(([id,p],i)=>({pos:i+1,id,name:athleteName(id),pts:p}));
  }

  // cabeçalho
  ctx.textAlign="center";
  try{const logo=await loadImage(window.PRIMO_CONFIG.logo);ctx.drawImage(logo,W/2-105,40,210,210);}catch(e){}
  ctx.fillStyle="#eaf2ff";
  ctx.font="900 96px Arial";
  ctx.shadowColor="rgba(40,120,255,.8)";ctx.shadowBlur=26;
  ctx.fillText("PRIMO SOCCER",W/2,330);
  ctx.shadowBlur=0;
  ctx.font="700 40px Arial";ctx.fillStyle="#dbeafe";
  ctx.fillText("L E A G U E   "+currentYear,W/2,388);
  // caixa do mês
  ctx.strokeStyle="#2f7bff";ctx.lineWidth=4;
  roundRect(ctx,W/2-260,415,520,80,18);ctx.stroke();
  ctx.fillStyle="#eaf2ff";ctx.font="800 44px Arial";
  ctx.fillText("MÊS: "+FULL_MONTH_NAMES[currentMonth-1].toUpperCase(),W/2,470);

  // painel
  const panelTop=530, panelBottom=H-70;
  ctx.fillStyle="rgba(10,26,58,.55)";
  roundRect(ctx,40,panelTop,W-80,panelBottom-panelTop,28);ctx.fill();
  ctx.strokeStyle="rgba(120,180,255,.5)";ctx.lineWidth=3;
  roundRect(ctx,40,panelTop,W-80,panelBottom-panelTop,28);ctx.stroke();

  ctx.fillStyle="#eaf2ff";ctx.font="italic 900 58px Arial";
  ctx.fillText("CLASSIFICAÇÃO GERAL",W/2,panelTop+70);
  ctx.fillStyle="#5fa8ff";ctx.font="700 28px Arial";
  ctx.fillText(subtitle,W/2,panelTop+112);

  if(!rows.length){
    ctx.fillStyle="#dbeafe";ctx.font="700 34px Arial";
    ctx.fillText("Sem pontuação lançada ainda.",W/2,panelTop+220);
    finishStory(kind);return;
  }

  // calcula altura de cada linha para caber TODOS os atletas
  const listTop=panelTop+150, listBottom=panelBottom-30;
  const avail=listBottom-listTop;
  let rowH=Math.min(112,Math.floor(avail/rows.length));
  if(rowH<44)rowH=44; // mínimo legível
  const maxRows=Math.floor(avail/rowH);
  const shown=rows.slice(0,maxRows);
  const photoR=Math.min(34,Math.floor(rowH*0.36));
  const fontSize=Math.max(20,Math.min(38,Math.floor(rowH*0.38)));

  const medals=[
    {bg:"rgba(120,95,20,.55)",border:"#ffd76a",text:"#ffd76a"},
    {bg:"rgba(95,105,120,.5)",border:"#d7e2ee",text:"#e8f0f8"},
    {bg:"rgba(110,68,32,.5)",border:"#e09a5a",text:"#f0b17a"}
  ];

  for(let i=0;i<shown.length;i++){
    const r=shown[i];
    const y=listTop+i*rowH;
    const h=rowH-8;
    const m=i<3?medals[i]:null;
    // fundo da linha
    ctx.fillStyle=m?m.bg:"rgba(20,45,95,.45)";
    roundRect(ctx,70,y,W-140,h,14);ctx.fill();
    ctx.strokeStyle=m?m.border:"rgba(120,180,255,.28)";ctx.lineWidth=m?3:1.5;
    roundRect(ctx,70,y,W-140,h,14);ctx.stroke();
    // posição
    ctx.textAlign="left";ctx.fillStyle=m?m.text:"#eaf2ff";
    ctx.font=`700 ${fontSize}px Arial`;
    ctx.fillText(r.pos+"º",96,y+h/2+fontSize*0.35);
    // foto redonda
    const cx=180,cy=y+h/2;
    const photo=athletePhoto(r.id);
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,photoR,0,Math.PI*2);ctx.closePath();ctx.clip();
    if(photo){try{const img=await loadImage(photo);ctx.drawImage(img,cx-photoR,cy-photoR,photoR*2,photoR*2);}catch(e){ctx.fillStyle="#061334";ctx.fillRect(cx-photoR,cy-photoR,photoR*2,photoR*2);}}
    else{ctx.fillStyle="#061334";ctx.fillRect(cx-photoR,cy-photoR,photoR*2,photoR*2);}
    ctx.restore();
    ctx.beginPath();ctx.arc(cx,cy,photoR,0,Math.PI*2);
    ctx.lineWidth=3;ctx.strokeStyle=m?m.border:"#5fa8ff";ctx.stroke();
    // nome
    ctx.fillStyle="#fff";ctx.font=`700 ${fontSize}px Arial`;ctx.textAlign="left";
    ctx.fillText(r.name.toUpperCase(),cx+photoR+22,cy+fontSize*0.35,W-560);
    // pontos
    ctx.textAlign="right";ctx.fillStyle=m?m.text:"#eaf2ff";
    ctx.font=`700 ${fontSize}px Arial`;
    ctx.fillText(r.pts+" pts",W-96,cy+fontSize*0.35);
  }
  ctx.textAlign="center";
  finishStory(kind);
}

function finishStory(kind){
  const c=document.getElementById("storyCanvas");
  if(!c){setSync("Erro: área da imagem não encontrada.","error");return;}
  let url;
  try{url=c.toDataURL("image/png");}
  catch(e){setSync("Erro ao exportar a imagem: "+e.message,"error");alert("Erro ao exportar a imagem: "+e.message);return;}
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
async function drawPlayerCard(ctx,x,y,w,h,athleteId,seed,winner){
  // moldura
  ctx.fillStyle="rgba(10,20,35,.9)";
  roundRect(ctx,x,y,w,h,14);ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle=winner?"#8ff0b3":"rgba(143,240,179,.35)";
  roundRect(ctx,x,y,w,h,14);ctx.stroke();
  // foto redonda
  const cx=x+w/2, cy=y+74, r=58;
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.closePath();ctx.clip();
  const photo=athletePhoto(athleteId);
  if(photo){try{const img=await loadImage(photo);ctx.drawImage(img,cx-r,cy-r,r*2,r*2);}catch(e){ctx.fillStyle="#061334";ctx.fillRect(cx-r,cy-r,r*2,r*2);}}
  else{ctx.fillStyle="#061334";ctx.fillRect(cx-r,cy-r,r*2,r*2);}
  ctx.restore();
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.lineWidth=3;ctx.strokeStyle=winner?"#8ff0b3":"#7ee0ff";ctx.stroke();
  // seed
  if(seed){ctx.fillStyle="#ffd479";ctx.font="900 28px Arial";ctx.textAlign="left";ctx.fillText(seed+"º",x+12,y+32);}
  // nome
  ctx.fillStyle=winner?"#8ff0b3":"#fff";ctx.font="900 24px Arial";ctx.textAlign="center";
  ctx.fillText((athleteName(athleteId)||"").toUpperCase(),cx,y+h-18,w-16);
}

function drawTbdCard(ctx,x,y,w,h,label){
  ctx.fillStyle="rgba(10,20,35,.7)";roundRect(ctx,x,y,w,h,14);ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle="rgba(126,224,255,.3)";roundRect(ctx,x,y,w,h,14);ctx.stroke();
  const cx=x+w/2,cy=y+74,r=58;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.setLineDash([6,6]);ctx.strokeStyle="rgba(126,224,255,.5)";ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle="#7ee0ff";ctx.font="900 54px Arial";ctx.textAlign="center";ctx.fillText("?",cx,cy+18);
  ctx.fillStyle="#9fb8d6";ctx.font="800 20px Arial";ctx.fillText(label||"A DEFINIR",cx,y+h-18);
}

function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

async function generateBracketImage(){
  const c=document.getElementById("storyCanvas"),ctx=c.getContext("2d"),W=c.width,H=c.height; // 1080x1920
  // fundo escuro com brilho
  ctx.fillStyle="#02060f";ctx.fillRect(0,0,W,H);
  const glow=ctx.createRadialGradient(W/2,120,50,W/2,120,700);
  glow.addColorStop(0,"rgba(20,60,120,.5)");glow.addColorStop(1,"rgba(2,6,15,0)");
  ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);

  // logos laterais
  try{const logo=await loadImage(window.PRIMO_CONFIG.logo);
    ctx.drawImage(logo,40,70,150,150);
    ctx.drawImage(logo,W-190,70,150,150);}catch(e){}

  // TÍTULO
  ctx.textAlign="center";
  ctx.fillStyle="#b6ff3d";ctx.font="italic 900 78px Arial";ctx.fillText("PRIMO SOCCER",W/2,120);
  ctx.fillStyle="#b6ff3d";ctx.font="italic 900 60px Arial";ctx.fillText("MATA-MATA",W/2,190);
  ctx.font="italic 900 60px Arial";
  ctx.fillStyle="#fff";ctx.fillText("QUARTAS DE ",W/2-70,255);
  const qm=ctx.measureText("QUARTAS DE ").width;
  ctx.fillStyle="#7ec8ff";ctx.textAlign="left";ctx.fillText("FINAL",W/2-70+qm/2,255);
  ctx.textAlign="center";
  ctx.fillStyle="#b6ff3d";ctx.font="700 24px Arial";
  ctx.fillText("Início: Semana 3  |  Classificação até o fim da Semana 2",W/2,300);
  // linha divisória
  ctx.strokeStyle="#b6ff3d";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(40,325);ctx.lineTo(W-40,325);ctx.stroke();

  const q=bracket.filter(m=>m.phase==="quartas");
  const seedRank=computeRanking(scores.filter(s=>s.week<=2));
  const seedOf={};seedRank.forEach((r,i)=>seedOf[r.athlete_id]=i+1);

  if(!q.length){
    ctx.fillStyle="#dbeafe";ctx.font="800 34px Arial";ctx.fillText("Gere o chaveamento primeiro (aba Mata-mata).",W/2,700);
    finishStory("matamata");return;
  }

  // QUARTAS — 4 confrontos, 2 colunas x 2 linhas
  ctx.fillStyle="#b6ff3d";ctx.font="900 52px Arial";ctx.fillText("QUARTAS DE FINAL",W/2,400);
  const cardW=238,cardH=196,gapX=34,pairGap=90;
  const leftX=36, rightX=W-36-cardW*2-gapX;
  const rowY=[450,690];
  const semi=bracket.filter(m=>m.phase==="semi");
  const final=bracket.filter(m=>m.phase==="final");

  for(let i=0;i<q.length;i++){
    const m=q[i];
    const col=i<2?0:1;
    const row=i%2;
    const baseX=col===0?leftX:rightX;
    const y=rowY[row];
    // label do confronto
    ctx.fillStyle="#cfe6ff";ctx.font="800 24px Arial";ctx.textAlign="center";
    ctx.fillText(`QUARTAS #${i+1}`,baseX+cardW+gapX/2,y-16);
    await drawPlayerCard(ctx,baseX,y,cardW,cardH,m.athlete_a,seedOf[m.athlete_a],m.winner===m.athlete_a);
    ctx.fillStyle="#b6ff3d";ctx.font="900 42px Arial";ctx.textAlign="center";ctx.fillText("X",baseX+cardW+gapX/2,y+cardH/2+12);
    await drawPlayerCard(ctx,baseX+cardW+gapX,y,cardW,cardH,m.athlete_b,seedOf[m.athlete_b],m.winner===m.athlete_b);
  }

  // SEMI FINAL
  const semiY=1010;
  ctx.fillStyle="#b6ff3d";ctx.font="900 52px Arial";ctx.textAlign="center";ctx.fillText("SEMI FINAL",W/2,semiY-24);
  const semiRow=[[semi[0],"SEMI #1",leftX],[semi[1],"SEMI #2",rightX]];
  for(let i=0;i<2;i++){
    const [m,label,baseX]=semiRow[i];
    ctx.fillStyle="#cfe6ff";ctx.font="800 24px Arial";ctx.fillText(label,baseX+cardW+gapX/2,semiY+8);
    if(m){
      await drawPlayerCard(ctx,baseX,semiY+20,cardW,cardH,m.athlete_a,null,m.winner===m.athlete_a);
      ctx.fillStyle="#b6ff3d";ctx.font="900 42px Arial";ctx.fillText("X",baseX+cardW+gapX/2,semiY+20+cardH/2+12);
      await drawPlayerCard(ctx,baseX+cardW+gapX,semiY+20,cardW,cardH,m.athlete_b,null,m.winner===m.athlete_b);
    }else{
      drawTbdCard(ctx,baseX,semiY+20,cardW,cardH);
      ctx.fillStyle="#b6ff3d";ctx.font="900 42px Arial";ctx.fillText("X",baseX+cardW+gapX/2,semiY+20+cardH/2+12);
      drawTbdCard(ctx,baseX+cardW+gapX,semiY+20,cardW,cardH);
    }
  }

  // FINAL
  const finalY=1420;
  ctx.fillStyle="#7ec8ff";ctx.font="900 60px Arial";ctx.textAlign="center";ctx.fillText("FINAL",W/2,finalY-14);
  ctx.fillStyle="#cfe6ff";ctx.font="800 24px Arial";ctx.fillText("FINAL #1",W/2,finalY+18);
  const fx=W/2-cardW-gapX/2;
  const fm=final[0];
  if(fm){
    await drawPlayerCard(ctx,fx,finalY+30,cardW,cardH,fm.athlete_a,null,fm.winner===fm.athlete_a);
    ctx.fillStyle="#b6ff3d";ctx.font="900 46px Arial";ctx.fillText("X",W/2,finalY+30+cardH/2+12);
    await drawPlayerCard(ctx,fx+cardW+gapX,finalY+30,cardW,cardH,fm.athlete_b,null,fm.winner===fm.athlete_b);
  }else{
    drawTbdCard(ctx,fx,finalY+30,cardW,cardH);
    ctx.fillStyle="#b6ff3d";ctx.font="900 46px Arial";ctx.fillText("X",W/2,finalY+30+cardH/2+12);
    drawTbdCard(ctx,fx+cardW+gapX,finalY+30,cardW,cardH,"VENCEDOR");
  }

  // TROFÉU (desenhado)
  drawTrophy(ctx,W/2,finalY+272,1.35);

  // rodapé
  ctx.fillStyle="#8ff0b3";ctx.font="800 22px Arial";ctx.textAlign="center";
  ctx.fillText(`${FULL_MONTH_NAMES[currentMonth-1]}/${currentYear}`,W/2,H-40);

  finishStory("matamata");
}

function drawTrophy(ctx,cx,cy,scale){
  ctx.save();
  if(scale){ctx.translate(cx,cy);ctx.scale(scale,scale);ctx.translate(-cx,-cy);}
  ctx.fillStyle="#f2c94c";ctx.strokeStyle="#c99a1e";ctx.lineWidth=3;
  // taça
  ctx.beginPath();ctx.moveTo(cx-45,cy-70);ctx.lineTo(cx+45,cy-70);
  ctx.lineTo(cx+30,cy-10);ctx.quadraticCurveTo(cx,cy+20,cx-30,cy-10);ctx.closePath();ctx.fill();ctx.stroke();
  // alças
  ctx.beginPath();ctx.arc(cx-52,cy-55,20,Math.PI*0.4,Math.PI*1.6,false);ctx.stroke();
  ctx.beginPath();ctx.arc(cx+52,cy-55,20,Math.PI*1.4,Math.PI*0.6,true);ctx.stroke();
  // haste
  ctx.fillRect(cx-6,cy-10,12,35);
  // base
  ctx.fillRect(cx-30,cy+25,60,14);
  ctx.fillRect(cx-40,cy+39,80,12);
  ctx.restore();
}

// ---------------- READONLY ----------------
function renderReadonly(){
  document.getElementById("readonlyRules").textContent=rulesTextValue||"Regras ainda não definidas.";
  document.getElementById("readonlyRanking").innerHTML=rankList(computeRanking(scores));
  const area=document.getElementById("readonlyBracket");
  if(!bracket.length){area.innerHTML="<p class='smallText'>Mata-mata ainda não gerado neste mês.</p>";return;}
  // gera a imagem do chaveamento e exibe
  area.innerHTML='<canvas id="storyCanvas" width="1080" height="1920" style="display:none"></canvas><img id="roBracketImg" class="roBracketImg" alt="Chaveamento">';
  generateBracketImage().then(()=>{
    const c=document.getElementById("storyCanvas");
    document.getElementById("roBracketImg").src=c.toDataURL("image/png");
  }).catch(err=>{
    console.error(err);
    area.innerHTML="<p class='smallText'>Não foi possível carregar o chaveamento.</p>";
  });
}

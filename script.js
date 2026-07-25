const DB_OVERRIDE=(()=>{try{return JSON.parse(localStorage.getItem("primo_kids_db_config")||"{}")}catch(e){return {}}})();
function normalizeSupabaseUrl(u){u=String(u||"").trim(); if(!u)return ""; if(!/^https?:\/\//i.test(u))u="https://"+u; return u.replace(/\/+$/,"");}
const SUPABASE_URL=normalizeSupabaseUrl(DB_OVERRIDE.url||window.PRIMO_SUPABASE_CONFIG?.url);
const SUPABASE_KEY=String(DB_OVERRIDE.anonKey||window.PRIMO_SUPABASE_CONFIG?.anonKey||"").trim();
const APP_ID=String(DB_OVERRIDE.appId||window.PRIMO_SUPABASE_CONFIG?.appId||"primo_soccer_kids_league_2026").trim();
const MONTHS=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
const CATEGORIES=[["Futbaby 2-3 Anos","futbaby23"],["Futbaby 4-5 Anos","futbaby45"],["Sub 6-7-8 anos","sub678"],["Sub 8-9-10 anos","sub8910"],["Meninas","meninas"],["Sub 11-12-13-14 anos","sub1114"]];
const DEFAULT_SCHEDULES={"Futbaby 2-3 Anos":["Segunda 11:00 • Futbaby 2-3 anos","Quinta 17:30 • Futbaby 2-3 anos (Capi)","Sexta 17:30 • Futbaby 2-3 anos (Capi)","Sábado 09:30 • Futbaby 2-3 anos (Capi)","Sábado 11:30 • Futbaby 2-3 anos (Capi)"],"Futbaby 4-5 Anos":["Segunda 10:00 • Futbaby 4-5 anos","Terça 10:00 • Futbaby 4-5 anos","Quarta 10:00 • Futbaby 4-5 anos","Quarta 17:30 • Futbaby 4-5 anos","Sexta 09:15 • Futbaby 4-5 anos","Sábado 10:30 • Futbaby 4-5 anos (Capi)"],"Sub 6-7-8 anos":["Terça 10:45 • Sub 6-7-8 anos","Quinta 10:45 • Sub 6-7-8","Sexta 19:10 • Sub 6-7-8 (Capi)"],"Sub 8-9-10 anos":["Segunda 09:15 • Sub 8-9-10 anos","Quarta 09:15 • Sub 8-9-10 anos","Sexta 18:15 • Sub 8-9-10 (Capi)"],"Meninas":["Quarta 10:45 • Meninas"],"Sub 11-12-13-14 anos":["Terça 15:30 • Sub 11-12-13 anos","Quarta 15:30 • Sub 11-12-13-14"]};
const STORAGE_KEY="primo_soccer_2026_kids_state_v3",MONTH_KEY="primo_soccer_2026_kids_month_v3";
const APP_TITLE_HTML = "<span>PRIMO SOCCER</span><span>KIDS / INFANTO / JUVENIL</span><span>2026</span>";
const APP_TITLE_TEXT = "PRIMO SOCCER KIDS / INFANTO / JUVENIL 2026";
const DEFAULT_RULES = `🏆 Regras do campeonato
• Pontuação por treino: P/D + P/E + bônus.
• Bônus: uniforme, fruta e comportamento.
• Ranking mensal por categoria.
• Respeito, disciplina e presença contam para evolução do atleta.`;
let currentMonth=localStorage.getItem(MONTH_KEY)||MONTHS[new Date().getMonth()],state=loadLocal(),sb=null,saveTimer=null,activeCategory=CATEGORIES[0][0];
function defaultState(){return{students:[],months:{},currentMonth,settings:{rules:DEFAULT_RULES,customSchedules:{}},schemaVersion:4}}
function loadLocal(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||defaultState()}catch(e){return defaultState()}}
function norm(){if(!state||typeof state!=="object")state=defaultState();if(!Array.isArray(state.students))state.students=[];state.students.forEach(s=>{if(!s.id)s.id=uid();if(!s.studentCode)s.studentCode=s.id});if(!state.months)state.months={};Object.values(state.months).forEach(m=>{if(m){if(!m.participants)m.participants={};if(!m.finishedTrainings)m.finishedTrainings={}}});if(!state.settings)state.settings={};if(!state.settings.rules)state.settings.rules=DEFAULT_RULES;if(!state.settings.customSchedules)state.settings.customSchedules={};state.currentMonth=currentMonth;if(!state.months[currentMonth])state.months[currentMonth]={participants:{},finishedTrainings:{}};if(!state.months[currentMonth].finishedTrainings)state.months[currentMonth].finishedTrainings={}}
function schedulesFor(cat){const base=DEFAULT_SCHEDULES[cat]||[];const custom=state?.settings?.customSchedules?.[cat]||[];return [...base,...custom].filter((v,i,a)=>v&&a.indexOf(v)===i)}
function appTitleBlock(cls="appTitleBlock"){return `<div class="${cls}">${APP_TITLE_HTML}</div>`}
function rulesHtml(){return esc(state?.settings?.rules||DEFAULT_RULES).replace(/\n/g,"<br>")}
function applyAppTitle(){document.title=APP_TITLE_TEXT;document.querySelectorAll("[data-app-title]").forEach(el=>el.innerHTML=APP_TITLE_HTML)}
function saveLocal(){norm();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));localStorage.setItem(MONTH_KEY,currentMonth)}
function uid(){return"KID-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase()}
function esc(t){return String(t??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function ageFromBirth(b){if(!b)return"";const d=new Date(b+"T00:00:00"),now=new Date();let a=now.getFullYear()-d.getFullYear();const m=now.getMonth()-d.getMonth();if(m<0||(m===0&&now.getDate()<d.getDate()))a--;return a}
function initials(n){return String(n||"A").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"A"}
function studentById(id){return state.students.find(s=>s.id===id)}
function monthObj(m=currentMonth){norm();if(!state.months[m])state.months[m]={participants:{},finishedTrainings:{}};if(!state.months[m].participants)state.months[m].participants={};if(!state.months[m].finishedTrainings)state.months[m].finishedTrainings={};return state.months[m]}
function participant(id,create=true,m=currentMonth){const mo=monthObj(m);if(!mo.participants[id]&&create)mo.participants[id]={studentId:id,schedules:[],weeks:Array.from({length:5},()=>({}))};return mo.participants[id]||null}
function emptyScore(){return{pd:0,pe:0,uniforme:0,fruta:0,comportamento:0}}
function getScore(id,w,sch){const p=participant(id);if(!p.weeks[w])p.weeks[w]={};if(!p.weeks[w][sch])p.weeks[w][sch]=emptyScore();return p.weeks[w][sch]}
function scoreTotal(sc){return(+sc.pd||0)+(+sc.pe||0)+(+sc.uniforme||0)+(+sc.fruta||0)+(+sc.comportamento||0)}
function totalStudent(id,m=currentMonth){const p=monthObj(m).participants[id];if(!p)return 0;return(p.weeks||[]).reduce((a,w)=>a+Object.values(w||{}).reduce((b,sc)=>b+scoreTotal(sc),0),0)}
function activeStudents(m=currentMonth){const ids=new Set(Object.entries(monthObj(m).participants||{}).filter(([id,p])=>p.schedules&&p.schedules.length).map(([id])=>id));return state.students.filter(s=>s.active!==false&&ids.has(s.id))}
function activeByCategory(cat=activeCategory){return activeStudents().filter(s=>s.category===cat)}
function ranked(cat=null){return activeStudents().filter(s=>!cat||s.category===cat).map(s=>({...s,total:totalStudent(s.id)})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name))}
function rankedByMonth(cat=null,m=currentMonth){return activeStudents(m).filter(s=>!cat||s.category===cat).map(s=>({...s,total:totalStudent(s.id,m)})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name))}
const photoUrlCache={}; // id do aluno -> URL para mostrar na hora (não é salva no banco)
function photoPublicUrl(path){ return path ? (cloudUrl()+"/storage/v1/object/public/fotos-alunos/"+path) : ""; }
function photoSrc(s){ if(!s)return ""; if(photoUrlCache[s.id])return photoUrlCache[s.id]; if(s.photoPath)return photoPublicUrl(s.photoPath); return s.photo||""; }
function avatarHtml(s){
  const src=photoSrc(s);
  return src
    ? `<span class="avatar"><img src="${src}" onclick="openPhoto('${src}')"></span>`
    : `<span class="avatar">${initials(s.name)}</span>`;
}
function photoPickerHtml(s){
  const inputId = `photo-${s.id}`;
  return `<div class="avatarInputLabel" title="Toque para alterar a foto" onclick="document.getElementById('${inputId}').click()">
    ${photoSrc(s)?`<img src="${photoSrc(s)}" alt="Foto do aluno">`:initials(s.name)}
    <input id="${inputId}" class="photoInput" type="file" accept="image/*" onchange="loadPhoto(event,'${s.id}')">
  </div>`;
}
function photoFileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=()=>reject(new Error("Não foi possível ler a foto."));
    r.onload=()=>resolve(r.result);
    r.readAsDataURL(file);
  });
}
function loadImgFromSrc(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("Foto inválida ou formato não suportado."));
    img.src=src;
  });
}
async function fileToCompressedPhoto(file,max=640,quality=.9){
  if(!file)return "";
  const src=await photoFileToDataUrl(file);
  let source;
  try{
    if(window.createImageBitmap){
      const blob=await (await fetch(src)).blob();
      source=await createImageBitmap(blob,{imageOrientation:"from-image"});
    }
  }catch(e){ source=null; }
  if(!source) source=await loadImgFromSrc(src);
  let w=source.width,h=source.height;
  if(!w||!h)throw new Error("Foto sem dimensão válida.");
  const ratio=Math.min(1,max/Math.max(w,h));
  w=Math.max(1,Math.round(w*ratio)); h=Math.max(1,Math.round(h*ratio));
  const c=document.createElement("canvas"); c.width=w; c.height=h;
  const ctx=c.getContext("2d",{alpha:false});
  ctx.fillStyle="#06117a"; ctx.fillRect(0,0,w,h);
  ctx.drawImage(source,0,0,w,h);
  if(source.close)source.close();
  return c.toDataURL("image/jpeg",quality);
}
async function loadPhoto(e,id){
  const input=e.target, file=input.files&&input.files[0];
  input.value="";
  if(!file)return;
  const dataUrl=await openCropper(file);
  if(!dataUrl)return;
  try{
    setSync("Salvando foto do aluno...","warn");
    const st=studentById(id);
    if(st){
      photoUrlCache[st.id]=dataUrl; // mostra na hora
      try{
        const path=await uploadPhotoToStorage(st.id,dataUrl);
        st.photoPath=path; delete st.photo; // não guarda mais a imagem no JSON
        setSync("Foto salva no Storage.","ok");
      }catch(upErr){
        console.error("Storage indisponível, guardando foto no modo antigo:",upErr);
        st.photo=dataUrl; // fallback: mantém funcionando mesmo sem Storage
        setSync("Foto salva (modo antigo).","warn");
      }
      saveLocal();
      renderAll();
      await saveCloudNow();
    }
  }catch(err){console.error(err);alert("Não consegui salvar essa foto. Tente outra imagem.");setSync("Erro ao salvar foto.","error")}
}

/* ===== V34 - FOTOS NO SUPABASE STORAGE (bucket privado) ===== */
const PHOTO_BUCKET="fotos-alunos";
function dataUrlToBlob(dataUrl){
  const parts=String(dataUrl||"").split(",");
  const meta=parts[0]||"", b64=parts[1]||"";
  const mime=(meta.match(/data:(.*?);/)||[])[1]||"image/jpeg";
  const bin=atob(b64), arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:mime});
}
async function uploadPhotoToStorage(studentId,dataUrl){
  if(!isAdminAuthenticated())throw new Error("Sem login de administrador.");
  const blob=dataUrlToBlob(dataUrl);
  const path=APP_ID+"/"+studentId+".jpg";
  const url=cloudUrl()+"/storage/v1/object/"+PHOTO_BUCKET+"/"+path;
  const token=getAdminToken();
  const r=await withTimeout(fetch(url,{method:"POST",headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+token,"Content-Type":"image/jpeg","x-upsert":"true"},body:blob}),20000,"Envio da foto demorou");
  if(!r.ok){const t=await r.text();throw new Error("Storage upload "+r.status+": "+t);}
  return path;
}
async function refreshPhotoUrls(){
  // Bucket público: a foto é mostrada direto pela URL pública (photoSrc).
  // Limpa previews temporários para usar sempre a versão salva no Storage.
  try{ (state.students||[]).forEach(s=>{ if(s.photoPath) delete photoUrlCache[s.id]; }); }catch(e){}
}
async function migratePhotosToStorage(){
  if(!requireAdmin())return;
  const pending=(state.students||[]).filter(s=>s.photo&&!s.photoPath);
  if(!pending.length){alert("Nenhuma foto para migrar. Tudo já está no Storage.");return;}
  if(!confirm(pending.length+" foto(s) serão movidas para o Storage. Continuar?"))return;
  let ok=0,fail=0;
  for(const s of pending){
    try{ setSync("Migrando fotos... "+(ok+fail+1)+"/"+pending.length,"warn"); const path=await uploadPhotoToStorage(s.id,s.photo); s.photoPath=path; photoUrlCache[s.id]=s.photo; delete s.photo; ok++; }
    catch(e){ console.error("Migração falhou para",s.id,e); fail++; }
  }
  saveLocal(); await saveCloudNow(); await refreshPhotoUrls(); renderAll();
  setSync("Migração concluída.","ok");
  alert("Migração concluída.\nEnviadas: "+ok+"\nCom erro: "+fail+(fail?"\n\nAs que deram erro continuam funcionando no modo antigo. Tente de novo mais tarde.":""));
}

/* ===== V34 - UMA LINHA POR ALUNO (tabela primo_students, sincronizada) ===== */
async function syncStudentsTable(){
  try{
    if(!isAdminAuthenticated())return;
    const rows=(state.students||[]).map(s=>({
      student_id:s.id, app_id:APP_ID, name:s.name||"", birth:s.birth||null,
      category:s.category||"", photo_path:s.photoPath||null, active:s.active!==false,
      month_points:totalStudent(s.id), annual_points:(typeof annualTotalStudent==="function"?annualTotalStudent(s.id):0),
      updated_at:new Date().toISOString()
    }));
    if(!rows.length)return;
    const url=cloudUrl()+"/rest/v1/primo_students?on_conflict=student_id";
    await authedFetch(url,{method:"POST",headers:{"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(rows)});
    // remove do banco alunos que foram apagados no app (best-effort)
    const ids=rows.map(r=>'"'+r.student_id+'"').join(",");
    if(ids && ids.length<1500){
      const del=cloudUrl()+"/rest/v1/primo_students?app_id=eq."+encodeURIComponent(APP_ID)+"&student_id=not.in.("+ids+")";
      await authedFetch(del,{method:"DELETE",headers:{"Prefer":"return=minimal"}});
    }
  }catch(e){ console.warn("Sync da tabela de alunos falhou (não afeta o app):",e); }
}

/* ===== V35 - RECORTE CIRCULAR DA FOTO (arrastar + aproximar) + qualidade melhor ===== */
let _crop=null;
let pendingStudentPhoto=""; // foto já recortada, esperando o cadastro
const CROP_STAGE=288, CROP_OUT=512;
function openCropper(file){
  return new Promise((resolve)=>{
    const ov=document.getElementById("cropOverlay");
    const canvas=document.getElementById("cropCanvas");
    const zoom=document.getElementById("cropZoom");
    if(!ov||!canvas){ photoFileToDataUrl(file).then(resolve).catch(()=>resolve(null)); return; }
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const dpr=Math.min(2,window.devicePixelRatio||1);
        canvas.width=CROP_STAGE*dpr; canvas.height=CROP_STAGE*dpr;
        const ctx=canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
        const base=Math.max(CROP_STAGE/img.width, CROP_STAGE/img.height);
        const st={img,base,scale:1,ox:0,oy:0,ctx};
        _crop={st,resolve};
        if(zoom)zoom.value="1";
        clampAndDraw(st);
        ov.classList.remove("hidden");
      };
      img.onerror=()=>resolve(null);
      img.src=reader.result;
    };
    reader.onerror=()=>resolve(null);
    reader.readAsDataURL(file);
  });
}
function clampAndDraw(st){
  const eff=st.base*st.scale, w=st.img.width*eff, h=st.img.height*eff;
  const maxX=Math.max(0,(w-CROP_STAGE)/2), maxY=Math.max(0,(h-CROP_STAGE)/2);
  st.ox=Math.max(-maxX,Math.min(maxX,st.ox));
  st.oy=Math.max(-maxY,Math.min(maxY,st.oy));
  const ctx=st.ctx;
  ctx.clearRect(0,0,CROP_STAGE,CROP_STAGE);
  ctx.fillStyle="#06117a"; ctx.fillRect(0,0,CROP_STAGE,CROP_STAGE);
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
  ctx.drawImage(st.img,(CROP_STAGE-w)/2+st.ox,(CROP_STAGE-h)/2+st.oy,w,h);
}
function setCropZoom(v){ if(!_crop)return; _crop.st.scale=Math.max(1,Math.min(4,+v||1)); clampAndDraw(_crop.st); }
function cancelCrop(){ const ov=document.getElementById("cropOverlay"); if(ov)ov.classList.add("hidden"); if(_crop){const r=_crop.resolve; _crop=null; r(null);} }
function confirmCrop(){
  if(!_crop)return;
  const st=_crop.st, o=document.createElement("canvas"); o.width=CROP_OUT; o.height=CROP_OUT;
  const octx=o.getContext("2d",{alpha:false});
  const k=CROP_OUT/CROP_STAGE, eff=st.base*st.scale*k, w=st.img.width*eff, h=st.img.height*eff;
  octx.fillStyle="#06117a"; octx.fillRect(0,0,CROP_OUT,CROP_OUT);
  octx.imageSmoothingEnabled=true; octx.imageSmoothingQuality="high";
  octx.drawImage(st.img,(CROP_OUT-w)/2+st.ox*k,(CROP_OUT-h)/2+st.oy*k,w,h);
  const dataUrl=o.toDataURL("image/jpeg",0.92);
  const ov=document.getElementById("cropOverlay"); if(ov)ov.classList.add("hidden");
  const r=_crop.resolve; _crop=null; r(dataUrl);
}
function initCropGestures(){
  const canvas=document.getElementById("cropCanvas");
  if(!canvas||canvas.dataset.ready)return; canvas.dataset.ready="1";
  let dragging=false,lastX=0,lastY=0,pinch=0,startScale=1;
  const factor=()=>CROP_STAGE/(canvas.clientWidth||CROP_STAGE);
  const dist=e=>{const a=e.touches[0],b=e.touches[1];return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);};
  canvas.addEventListener("touchstart",e=>{ if(!_crop)return;
    if(e.touches.length===2){pinch=dist(e);startScale=_crop.st.scale;}
    else{dragging=true;lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;}
  },{passive:false});
  canvas.addEventListener("touchmove",e=>{ if(!_crop)return; e.preventDefault();
    if(e.touches.length===2&&pinch){ setCropZoom(startScale*(dist(e)/pinch)); const z=document.getElementById("cropZoom"); if(z)z.value=_crop.st.scale; }
    else if(dragging){ const f=factor(); _crop.st.ox+=(e.touches[0].clientX-lastX)*f; _crop.st.oy+=(e.touches[0].clientY-lastY)*f; lastX=e.touches[0].clientX; lastY=e.touches[0].clientY; clampAndDraw(_crop.st); }
  },{passive:false});
  canvas.addEventListener("touchend",()=>{dragging=false;pinch=0;});
  canvas.addEventListener("mousedown",e=>{ if(!_crop)return; dragging=true; lastX=e.clientX; lastY=e.clientY; });
  window.addEventListener("mousemove",e=>{ if(!_crop||!dragging)return; const f=factor(); _crop.st.ox+=(e.clientX-lastX)*f; _crop.st.oy+=(e.clientY-lastY)*f; lastX=e.clientX; lastY=e.clientY; clampAndDraw(_crop.st); });
  window.addEventListener("mouseup",()=>{dragging=false;});
}
function showStudentPhotoPreview(dataUrl){
  const el=document.getElementById("studentPhotoPreview");
  if(el)el.innerHTML=dataUrl?`<img src="${dataUrl}" alt="Prévia da foto">`:"";
}
async function onPickStudentPhoto(e){
  const file=e.target.files&&e.target.files[0];
  e.target.value="";
  if(!file){return;}
  const dataUrl=await openCropper(file);
  if(dataUrl){ pendingStudentPhoto=dataUrl; showStudentPhotoPreview(dataUrl); }
}
function setSync(msg,type="warn"){const el=document.getElementById("syncStatus");el.textContent=msg;el.style.color=type==="ok"?"#8ff0b3":type==="error"?"#ff8b8b":"#ffe082"}
function scheduleSave(delay=350){saveLocal();clearTimeout(saveTimer);saveTimer=setTimeout(saveCloudNow,delay)}
async function saveCloudNow(){
  try{
    return await saveCloud();
  }catch(e){
    console.error(e);
    return false;
  }
}
function setCategory(cat){activeCategory=cat;renderAll()}
function openCategory(cat){activeCategory=cat;showPage("disputa")}
function showPage(page){
  ["dashboard","cadastro","agenda","disputa","ranking","imprimir","config","pais"].forEach(p=>{
    const pg = document.getElementById("page-"+p);
    const tb = document.getElementById("tab-"+p);
    if(pg) pg.classList.toggle("hidden",p!==page);
    if(tb) tb.classList.toggle("active",p===page);
  });
  renderAll();
}
function renderAll(){fillDbConfigScreen();
  norm();
  renderMonth();
  renderSelectors();
  renderDashboard();
  renderStudents();
  renderAgenda();
  renderScore();
  renderRankings();
  renderPrintSelect();
  renderRules();
  renderCustomScheduleControls();
  applyAppTitle();
  if(typeof applyDashboardCover==="function") applyDashboardCover();
}
function renderMonth(){const sel=document.getElementById("monthSelect");if(!sel.dataset.ready){sel.innerHTML=MONTHS.map(m=>`<option value="${m}">${m}</option>`).join("");sel.dataset.ready="1";sel.onchange=()=>{currentMonth=sel.value;if(!state.months[currentMonth])state.months[currentMonth]={participants:{}};scheduleSave();renderAll()}}sel.value=currentMonth;document.getElementById("heroMonth").textContent=currentMonth}

const MULTI_SCHEDULE_CATEGORIES = ["Futbaby 4-5 Anos","Sub 6-7-8 anos","Sub 8-9-10 anos","Sub 11-12-13-14 anos"];
function canHaveTwoSchedules(cat){return MULTI_SCHEDULE_CATEGORIES.includes(cat)}
function annualTotalStudent(id){return MONTHS.reduce((sum,m)=>sum+totalStudent(id,m),0)}
function rankedAnnual(cat=null){return state.students.filter(s=>s.active!==false&&(!cat||s.category===cat)).map(s=>({...s,total:annualTotalStudent(s.id)})).filter(s=>s.total>0).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name))}
function studentOptionLabel(s){const p=participant(s.id,false);const count=p?.schedules?.length||0;const icon=count>=2?"🔥":count===1?"✅":"⚽";return `${icon} ${s.name} • ${s.category}`}
function restoreSelectValue(id,value){const el=document.getElementById(id);if(el&&value&&[...el.options].some(o=>o.value===value))el.value=value}
function scheduleDay(sch){return String(sch||"").split(" ")[0]||""}
function trainingKey(cat,week,sch){return `${cat}__S${week+1}__${sch}`}
function isTrainingFinished(cat,week,sch){return !!monthObj().finishedTrainings?.[trainingKey(cat,week,sch)]}

let disputeFocusMode=false;
function enterDisputeFocus(){
  disputeFocusMode=true;
  document.body.classList.add("disputeFocus");
  document.body.style.overflow="hidden";
  const wrap=document.querySelector("#page-disputa .scoreTableWrap");
  if(wrap)wrap.scrollTop=0;
  if(document.documentElement.requestFullscreen){document.documentElement.requestFullscreen().catch(()=>{});}
  renderScore();
}
function exitDisputeFocus(){
  disputeFocusMode=false;
  document.body.classList.remove("disputeFocus");
  document.body.style.overflow="";
  if(document.fullscreenElement&&document.exitFullscreen){document.exitFullscreen().catch(()=>{});}
}
function scoreKey(id,week,sch){return `${id}__${week}__${sch}`}
function scoreCardHtml(s,i,week,sch,score){
  const key=esc(scoreKey(s.id,week,sch));
  const id=JSON.stringify(s.id), safeSch=JSON.stringify(sch);
  const bonus=(field,label,icon)=>`<button type="button" class="bonusMini ${(+score[field]||0)>0?"active":""}" onclick='toggleBonus(${id},${week},${safeSch},${JSON.stringify(field)},this)' title="${label}"><span>${icon}</span><small data-bonus="${field}">${+score[field]||0}</small></button>`;
  return `<div class="scorePlayerCard scorePlayerCompact" data-score-key="${key}">
    <div class="compactMain">
      <span class="scorePos">${i+1}</span>
      ${avatarHtml(s)}
      <div class="compactName"><strong>${esc(s.name)}</strong><small>ID: ${esc(s.studentCode||s.id)}</small></div>
      <div class="compactControls">
        <div class="compactField"><label>PD</label>${scoreStepperHtml(s.id,week,sch,"pd",score.pd)}</div>
        <div class="compactField"><label>PE</label>${scoreStepperHtml(s.id,week,sch,"pe",score.pe)}</div>
      </div>
      <div class="compactBonus">
        ${bonus("comportamento","Comportamento","🙂")}
        ${bonus("fruta","Fruta","🍎")}
        ${bonus("uniforme","Uniforme","👕")}
      </div>
      <div class="scoreTotalBadge"><span data-total>${scoreTotal(score)}</span><small>pts</small></div>
    </div>
  </div>`;
}
function updateScoreDisplays(id,week,sch){
  const sc=getScore(id,week,sch), key=scoreKey(id,week,sch);
  document.querySelectorAll(`[data-score-key="${CSS.escape(key)}"]`).forEach(el=>{
    const total=el.querySelector("[data-total]"); if(total)total.textContent=scoreTotal(sc);
    el.querySelectorAll(".quickScore").forEach(q=>{const f=q.dataset.field;if(f&&q.querySelector("input"))q.querySelector("input").value=sc[f]||0});
    el.querySelectorAll(".bonusMini").forEach(btn=>{const f=btn.querySelector("small")?.dataset.bonus;if(f){btn.classList.toggle("active",(+sc[f]||0)>0);btn.querySelector("small").textContent=+sc[f]||0}});
    el.querySelectorAll(".bonusChip").forEach(btn=>{const f=btn.querySelector("strong")?.dataset.bonus;if(f){btn.classList.toggle("active",(+sc[f]||0)>0);btn.querySelector("strong").textContent=+sc[f]||0}});
  });
}
function toggleBonus(id,week,sch,field,el){
  if(el&&el.blur)el.blur();
  const sc=getScore(id,week,sch);
  sc[field]=(+sc[field]||0)>0?0:2;
  updateScoreDisplays(id,week,sch);
  scheduleSave(250);
  renderRankings();
}

function renderSelectors(){
  const currentStudent=document.getElementById("studentPicker")?.value||"";
  const currentSchedule=document.getElementById("schedulePicker")?.value||"";
  const currentScoreSchedule=document.getElementById("scoreSchedule")?.value||"";
  const currentScoreDay=document.getElementById("scoreDay")?.value||"";
  const currentWeek=document.getElementById("scoreWeek")?.value||"";
  document.getElementById("studentCategory").innerHTML=CATEGORIES.map(c=>`<option value="${c[0]}">${c[0]}</option>`).join("");
  ["agendaCategory","disputeCategory"].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.innerHTML=CATEGORIES.map(c=>`<option value="${c[0]}">${c[0]}</option>`).join("");el.value=activeCategory});
  const sp=document.getElementById("studentPicker");
  if(sp){sp.innerHTML=state.students.filter(s=>s.active!==false&&s.category===activeCategory).map(s=>`<option value="${s.id}">${esc(studentOptionLabel(s))}</option>`).join("")||`<option value="">Cadastre alunos nesta categoria</option>`;restoreSelectValue("studentPicker",currentStudent)}
  const sch=schedulesFor(activeCategory);
  const ap=document.getElementById("schedulePicker");if(ap){ap.innerHTML=sch.map(s=>`<option value="${s}">${s}</option>`).join("");restoreSelectValue("schedulePicker",currentSchedule)}
  const daySel=document.getElementById("scoreDay");
  const days=[...new Set(sch.map(scheduleDay).filter(Boolean))];
  if(daySel){daySel.innerHTML=[`<option value="">Todos os dias</option>`,...days.map(d=>`<option value="${d}">${d}</option>`)].join("");restoreSelectValue("scoreDay",currentScoreDay)}
  const selectedDay=daySel?.value||"";
  const scoreSchedules=selectedDay?sch.filter(x=>scheduleDay(x)===selectedDay):sch;
  const ss=document.getElementById("scoreSchedule");if(ss){ss.innerHTML=scoreSchedules.map(s=>`<option value="${s}">${s}</option>`).join("")||`<option value="">Nenhum horário neste dia</option>`;restoreSelectValue("scoreSchedule",currentScoreSchedule)}
  const sw=document.getElementById("scoreWeek");if(sw){sw.innerHTML=[0,1,2,3,4].map(i=>`<option value="${i}">Semana ${i+1}</option>`).join("");restoreSelectValue("scoreWeek",currentWeek)}
  renderCopyMonthPicker();
}
function renderDashboard(){document.getElementById("categoryButtons").innerHTML=CATEGORIES.map(c=>`<button class="btn-${c[1]}" onclick="openCategory('${c[0]}')">${c[0]}</button>`).join("");document.getElementById("dashActive").textContent=activeStudents().length;document.getElementById("dashBank").textContent=state.students.filter(s=>s.active!==false).length;document.getElementById("dashPoints").textContent=activeStudents().reduce((a,s)=>a+totalStudent(s.id),0);renderRules()}

function renderRules(){
  const dash=document.getElementById("championshipRules");
  if(dash)dash.innerHTML=rulesHtml();
  const editor=document.getElementById("rulesEditor");
  if(editor&&document.activeElement!==editor)editor.value=state?.settings?.rules||DEFAULT_RULES;
}
function saveRules(){
  const editor=document.getElementById("rulesEditor");
  state.settings=state.settings||{};
  state.settings.rules=(editor?.value||DEFAULT_RULES).trim()||DEFAULT_RULES;
  scheduleSave();renderRules();alert("Regras atualizadas!");
}
function renderCustomScheduleControls(){
  const catSel=document.getElementById("newScheduleCategory");
  if(catSel&&!catSel.dataset.ready){catSel.innerHTML=CATEGORIES.map(c=>`<option value="${c[0]}">${c[0]}</option>`).join("");catSel.dataset.ready="1"}
  const list=document.getElementById("customScheduleList");
  if(list){const items=Object.entries(state?.settings?.customSchedules||{}).flatMap(([cat,arr])=>(arr||[]).map((sch,i)=>({cat,sch,i})));list.innerHTML=items.map(x=>`<div class="item"><span><strong>${esc(x.cat)}</strong><br>${esc(x.sch)}</span><button class="danger" onclick="removeCustomSchedule('${esc(x.cat)}',${x.i})">Excluir</button></div>`).join("")||"<p>Nenhum horário extra cadastrado.</p>"}
}
function addCustomSchedule(){
  const cat=document.getElementById("newScheduleCategory")?.value||activeCategory;
  const day=document.getElementById("newScheduleDay")?.value||"";
  const time=document.getElementById("newScheduleTime")?.value||"";
  const label=(document.getElementById("newScheduleLabel")?.value||cat).trim();
  if(!day||!time)return alert("Escolha o dia e o horário.");
  const sch=`${day} ${time} • ${label}`;
  state.settings=state.settings||{};state.settings.customSchedules=state.settings.customSchedules||{};
  state.settings.customSchedules[cat]=state.settings.customSchedules[cat]||[];
  if(state.settings.customSchedules[cat].includes(sch)||schedulesFor(cat).includes(sch))return alert("Esse horário já existe.");
  state.settings.customSchedules[cat].push(sch);
  activeCategory=cat;
  scheduleSave();renderAll();alert("Novo horário adicionado!");
}
function removeCustomSchedule(cat,index){
  if(!confirm("Excluir esse horário extra?"))return;
  const arr=state?.settings?.customSchedules?.[cat];if(!arr)return;
  const sch=arr[index];arr.splice(index,1);
  Object.values(state.months||{}).forEach(m=>Object.values(m.participants||{}).forEach(p=>{if(p.schedules)p.schedules=p.schedules.filter(x=>x!==sch)}));
  scheduleSave();renderAll();
}

async function addStudent(){
  const name=document.getElementById("studentName").value.trim(),birth=document.getElementById("studentBirth").value,category=document.getElementById("studentCategory").value;
  if(!name)return alert("Digite o nome do aluno.");
  const id=uid();
  let photo="", photoPath="", dataUrl=pendingStudentPhoto||"";
  if(dataUrl){
    photoUrlCache[id]=dataUrl; // mostra na hora
    try{ photoPath=await uploadPhotoToStorage(id,dataUrl); }
    catch(upErr){ console.error("Storage indisponível no cadastro:",upErr); photo=dataUrl; } // fallback modo antigo
  }
  const student={id,studentCode:id,name,birth,category,active:true,createdAt:new Date().toISOString()};
  if(photoPath)student.photoPath=photoPath; if(photo)student.photo=photo;
  state.students.push(student);
  pendingStudentPhoto=""; showStudentPhotoPreview("");
  document.getElementById("studentName").value="";document.getElementById("studentBirth").value="";if(document.getElementById("studentPhoto"))document.getElementById("studentPhoto").value="";
  saveLocal();renderAll();const ok=await saveCloudNow();
  alert(ok?"Aluno cadastrado e salvo online!":"Aluno cadastrado neste celular. Banco online não confirmou ainda. Toque em Sincronizar agora quando conectar.");
}
function renderStudents(){
  const body = document.getElementById("studentsTable");
  if(!body) return;
  const active = state.students.filter(s=>s.active!==false);
  if(!active.length){
    body.innerHTML = `<tr><td colspan="8">Nenhum aluno cadastrado.</td></tr>`;
    return;
  }

  let html = "";
  CATEGORIES.forEach(cat=>{
    const list = active.filter(s=>s.category===cat[0]);
    if(!list.length) return;

    html += `<tr class="categoryDivider cat-${cat[1]}"><td colspan="8">🏆 ${cat[0]} • ${list.length} aluno(s)</td></tr>`;
    html += list.map((s,i)=>`<tr>
      <td>${i+1}</td>
      <td><code class="studentIdCode">${esc(s.studentCode||s.id)}</code></td>
      <td>${photoPickerHtml(s)}</td>
      <td><input value="${esc(s.name)}" oninput="editStudent('${s.id}','name',this.value)"></td>
      <td><input type="date" value="${s.birth||""}" oninput="editStudent('${s.id}','birth',this.value)"></td>
      <td>${ageFromBirth(s.birth)} anos</td>
      <td><select onchange="editStudent('${s.id}','category',this.value)">
        ${CATEGORIES.map(c=>`<option value="${c[0]}" ${s.category===c[0]?"selected":""}>${c[0]}</option>`).join("")}
      </select></td>
      <td><button class="danger" onclick="deleteStudent('${s.id}')">Excluir</button></td>
    </tr>`).join("");
  });

  body.innerHTML = html || `<tr><td colspan="8">Nenhum aluno cadastrado.</td></tr>`;
}
function editStudent(id,field,value){const s=studentById(id);if(s){s[field]=value;scheduleSave();renderAll()}}
function deleteStudent(id){if(!confirm("Excluir aluno e todos os pontos dele?"))return;state.students=state.students.filter(s=>s.id!==id);Object.values(state.months||{}).forEach(m=>{if(m.participants)delete m.participants[id]});scheduleSave();renderAll()}
function addToSchedule(){
  const id=document.getElementById("studentPicker").value,sch=document.getElementById("schedulePicker").value;if(!id||!sch)return;
  const student=studentById(id);if(!student)return;
  const p=participant(id);const maxSchedules=canHaveTwoSchedules(student.category)?2:1;
  if(p.schedules.includes(sch))return alert("Esse aluno já está nesse horário.");
  if(p.schedules.length>=maxSchedules)return alert(canHaveTwoSchedules(student.category)?"Esse aluno já está em 2 horários nesta semana.":"Essa categoria permite apenas 1 horário por aluno.");
  const studentsInSlot=activeByCategory().filter(s=>(participant(s.id,false)?.schedules||[]).includes(sch));if(studentsInSlot.length>=6)return alert("Esse horário já está com 6 vagas preenchidas.");
  p.schedules.push(sch);scheduleSave();renderAll();const picker=document.getElementById("studentPicker");if(picker)picker.value=id;
}
function renderAgenda(){
  const schList=schedulesFor(activeCategory);
  document.getElementById("agendaGrid").innerHTML=schList.map(sch=>{
    const list=activeByCategory().filter(s=>(participant(s.id,false)?.schedules||[]).includes(sch));
    return`<div class="slotCard"><div class="slotTitle"><span>${sch}</span><span class="badge">${list.length}/6</span></div><button class="success compactGo" onclick='goToDisputeSlot(${JSON.stringify(sch)})'>Ir para disputa desta turma</button>${list.map(s=>{const count=participant(s.id,false)?.schedules?.length||0;const icon=count>=2?"🔥":count===1?"✅":"⚽";const cls=count>=2?"multiSchedule":"singleSchedule";return `<div class="item ${cls}"><span>${icon} ${esc(s.name)}</span><button class="danger" onclick="removeFromSchedule('${s.id}','${sch}')">Remover</button></div>`}).join("")||"<p>Nenhum aluno.</p>"}</div>`;
  }).join("");
}
function goToDisputeSlot(sch){const ss=document.getElementById("scoreSchedule");if(ss)ss.value=sch;showPage("disputa");setTimeout(()=>{const s2=document.getElementById("scoreSchedule");if(s2)s2.value=sch;enterDisputeFocus();renderScore();},80)}
function removeFromSchedule(id,sch){const p=participant(id,false);if(p){p.schedules=p.schedules.filter(x=>x!==sch);scheduleSave();renderAll()}}
function scoreStepperHtml(id,week,sch,field,value){
  const safeId=JSON.stringify(id), safeSch=JSON.stringify(sch), safeField=JSON.stringify(field);
  return `<div class="quickScore" data-field="${field}">
    <button type="button" class="scoreMinus" onpointerdown="event.preventDefault()" onclick='adjustScore(${safeId},${week},${safeSch},${safeField},-1,this)'>−</button>
    <input class="scoreInput quickScoreInput" type="number" value="${value}" oninput='setScore(${safeId},${week},${safeSch},${safeField},this.value,this)'>
    <button type="button" class="scorePlus" onpointerdown="event.preventDefault()" onclick='adjustScore(${safeId},${week},${safeSch},${safeField},1,this)'>+</button>
  </div>`;
}
function renderScore(){
  const sch=document.getElementById("scoreSchedule")?.value||(schedulesFor(activeCategory))[0]||"",week=+document.getElementById("scoreWeek")?.value||0;
  const title=document.getElementById("scoreTitle");
  if(title)title.textContent=`${activeCategory} • ${sch||"Selecione um horário"} • Semana ${week+1}`;
  const finished=isTrainingFinished(activeCategory,week,sch);
  const finishBox=document.getElementById("finishStatus");
  if(finishBox)finishBox.innerHTML=finished?`✅ Treino finalizado e salvo no banco online.`:`Treino em andamento. Ao terminar, toque em <strong>Finalizar treino</strong> para gravar no banco online.`;
  const list=activeByCategory().filter(s=>(participant(s.id,false)?.schedules||[]).includes(sch));
  const table=document.getElementById("scoreTable");
  const cards=document.getElementById("scoreCards");
  if(cards)cards.innerHTML=list.map((s,i)=>scoreCardHtml(s,i,week,sch,getScore(s.id,week,sch))).join("")||`<div class="emptyScoreNotice">Nenhum aluno neste dia/horário. Vá em Agenda e adicione alunos neste horário.</div>`;
  if(table)table.innerHTML=list.map((s,i)=>{const score=getScore(s.id,week,sch);const key=esc(scoreKey(s.id,week,sch));return`<tr data-score-key="${key}"><td>${i+1}</td><td class="sticky"><div class="playerCell">${avatarHtml(s)}<strong>${esc(s.name)}</strong></div></td><td>${scoreStepperHtml(s.id,week,sch,"pd",score.pd)}</td><td>${scoreStepperHtml(s.id,week,sch,"pe",score.pe)}</td>${["uniforme","fruta","comportamento"].map(field=>`<td><button type="button" class="bonusMini tableBonus ${(+score[field]||0)>0?"active":""}" onclick='toggleBonus(${JSON.stringify(s.id)},${week},${JSON.stringify(sch)},${JSON.stringify(field)},this)'><small data-bonus="${field}">${+score[field]||0}</small></button></td>`).join("")}<td class="totalCell"><strong data-total>${scoreTotal(score)}</strong></td></tr>`}).join("")||`<tr><td colspan="8">Nenhum aluno neste dia/horário. Vá em Agenda e adicione alunos neste horário.</td></tr>`
}
function setScore(id,week,sch,field,value,el){const sc=getScore(id,week,sch);sc[field]=+value||0;updateScoreDisplays(id,week,sch);scheduleSave(250);renderRankings()}
function adjustScore(id,week,sch,field,delta,el){if(el&&el.blur)el.blur();const sc=getScore(id,week,sch);sc[field]=Math.max(0,(+sc[field]||0)+delta);updateScoreDisplays(id,week,sch);scheduleSave(250);renderRankings()}
function clearTrainingScore(){const sch=document.getElementById("scoreSchedule").value,week=+document.getElementById("scoreWeek").value;if(!confirm("Limpar pontuação deste treino?"))return;activeByCategory().forEach(s=>{const p=participant(s.id,false);if(p?.weeks?.[week]?.[sch])p.weeks[week][sch]=emptyScore()});scheduleSave();renderAll()}
async function finishTraining(){const sch=document.getElementById("scoreSchedule")?.value,week=+document.getElementById("scoreWeek")?.value||0;if(!sch)return alert("Selecione um horário para finalizar.");const mo=monthObj();mo.finishedTrainings=mo.finishedTrainings||{};mo.finishedTrainings[trainingKey(activeCategory,week,sch)]={category:activeCategory,week:week+1,schedule:sch,month:currentMonth,finishedAt:new Date().toISOString()};saveLocal();setSync("Finalizando e salvando treino online...","warn");const ok=await saveCloudNow();renderScore();renderRankings();if(isParentMode())renderParentMode();alert(ok?"Treino finalizado e salvo no banco online!":"Treino salvo neste celular, mas houve erro no banco online. Toque em Sincronizar agora quando a internet melhorar.");}
function rankRow(s,i){return`<div class="rankRow"><div class="rankLeft"><span>${i===0?"🥇":i===1?"🥈":i===2?"🥉":"⚽"}</span>${avatarHtml(s)}<span>${i+1}º - ${esc(s.name)}</span></div><strong>${s.total} pts</strong></div>`}
function renderRankings(){
  const categoryRanking=document.getElementById("categoryRanking");
  if(categoryRanking){const monthList=ranked(activeCategory),yearList=rankedAnnual(activeCategory);categoryRanking.innerHTML=`<h3>🏆 Pontuação mensal • ${currentMonth}</h3>${monthList.map(rankRow).join("")||"<p>Nenhum aluno ativo nesta categoria.</p>"}<h3 class="annualTitle">📅 Pontuação geral do ano</h3>${yearList.map(rankRow).join("")||"<p>Nenhuma pontuação anual nesta categoria.</p>"}`}
  const rg=document.getElementById("rankingGeneral");if(rg)rg.innerHTML="";
  const all=document.getElementById("allCategoryRankings");
  if(all){all.innerHTML=CATEGORIES.map(c=>{const monthly=ranked(c[0]),annual=rankedAnnual(c[0]);return`<div class="catCard cat-${c[1]}"><h2>${c[0]}</h2><h3>🏆 Pontuação mensal • ${currentMonth}</h3>${monthly.map(rankRow).join("")||"<p>Nenhum aluno ativo no mês.</p>"}<h3 class="annualTitle">📅 Pontuação geral do ano</h3>${annual.map(rankRow).join("")||"<p>Nenhuma pontuação anual.</p>"}</div>`}).join("")}
}
function renderCopyMonthPicker(){const picker=document.getElementById("copyMonthPicker");const available=MONTHS.filter(m=>m!==currentMonth&&Object.values(state.months?.[m]?.participants||{}).some(p=>p.schedules&&p.schedules.some(s=>(schedulesFor(activeCategory)).includes(s))));picker.innerHTML=available.map(m=>`<option value="${m}">${m}</option>`).join("")||`<option value="">Nenhum mês com agenda</option>`}
function copyAgendaFromMonth(){const source=document.getElementById("copyMonthPicker").value;if(!source)return alert("Nenhum mês com agenda para copiar.");const sourceMo=monthObj(source),targetMo=monthObj(currentMonth),schList=schedulesFor(activeCategory);const entries=Object.entries(sourceMo.participants||{}).filter(([id,p])=>{const st=studentById(id);return st&&st.category===activeCategory&&p.schedules&&p.schedules.some(s=>schList.includes(s))});if(!entries.length)return alert("Esse mês não possui agenda nessa categoria.");entries.forEach(([id,p])=>{targetMo.participants[id]={studentId:id,schedules:p.schedules.filter(s=>schList.includes(s)),weeks:Array.from({length:5},()=>({}))}});scheduleSave();renderAll();alert("Agenda da categoria copiada com pontuação zerada.")}
function clearCategoryAgenda(){if(!confirm("Limpar agenda desta categoria no mês atual?"))return;const schList=schedulesFor(activeCategory);activeByCategory().forEach(s=>{const p=participant(s.id,false);if(p)p.schedules=p.schedules.filter(x=>!schList.includes(x))});scheduleSave();renderAll()}
function renderPrintSelect(){const el=document.getElementById("printCategory");if(el)el.innerHTML=CATEGORIES.map(c=>`<option value="${c[0]}">${c[0]}</option>`).join("")}
function preparePrint(type){const cat=document.getElementById("printCategory").value;const list=type==="general"?ranked():ranked(cat);const title=type==="general"?"RANKING GERAL DO MÊS":cat;document.getElementById("printArea").innerHTML=`<div class="printCard"><img src="primo-logo.png" class="printLogo"><h1>${APP_TITLE_HTML}</h1><h2>${title} • ${currentMonth}</h2>${list.map((s,i)=>`<div class="printRow"><span>${i+1}º</span><span class="printPhoto">${photoSrc(s)?`<img src="${photoSrc(s)}">`:initials(s.name)}</span><span>${esc(s.name)}</span><strong>${s.total} pts</strong></div>`).join("")||"<p>Nenhum aluno.</p>"}</div>`}
function withTimeout(promise,ms,msg){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(msg||"Tempo de conexão esgotado")),ms))])}
function cloudReady(){return !!(SUPABASE_URL&&SUPABASE_KEY&&APP_ID)}
function supabaseHeaders(){const token=(typeof getAdminToken==="function"&&getAdminToken())||SUPABASE_KEY;return {"apikey":SUPABASE_KEY,"Authorization":"Bearer "+token,"Content-Type":"application/json","Accept":"application/json","Prefer":"return=representation"}}
function cloudUrl(){return String(SUPABASE_URL||"").replace(/\/$/,"")}
/* Faz a requisição autenticada com o token do admin. Se o token expirar (401),
   tenta renovar automaticamente uma vez e refaz a requisição. */
async function authedFetch(url,opts={},allowRefresh=true){
  const headers=Object.assign({},supabaseHeaders(),opts.headers||{});
  const r=await withTimeout(fetch(url,Object.assign({},opts,{headers,cache:"no-store"})),12000,"Banco demorou para responder");
  if((r.status===401||r.status===403)&&allowRefresh&&typeof getAdminToken==="function"&&getAdminToken()){
    const ok=await refreshAdminToken();
    if(ok)return authedFetch(url,opts,false);
  }
  return r;
}
function cloudErrText(e){
  if(!e)return "erro desconhecido";
  if(typeof e==="string")return e;
  return e.message||e.error_description||e.details||e.hint||e.code||JSON.stringify(e);
}
async function loadCloudRest(){
  const url=cloudUrl()+"/rest/v1/primo_app_state?select=data,updated_at&app_id=eq."+encodeURIComponent(APP_ID)+"&limit=1";
  const r=await authedFetch(url,{method:"GET",headers:{"Accept":"application/json"}});
  const txt=await r.text();
  let json=null;try{json=txt?JSON.parse(txt):null}catch(e){}
  if(!r.ok)throw new Error("REST leitura "+r.status+": "+(json?cloudErrText(json):txt));
  return Array.isArray(json)?json[0]:json;
}
async function saveCloudRest(){
  norm();
  const payload={app_id:APP_ID,data:state,updated_at:new Date().toISOString()};
  const url=cloudUrl()+"/rest/v1/primo_app_state?on_conflict=app_id";
  const r=await authedFetch(url,{method:"POST",headers:{"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=representation"},body:JSON.stringify(payload)});
  const txt=await r.text();
  let json=null;try{json=txt?JSON.parse(txt):null}catch(e){}
  if(!r.ok)throw new Error("REST salvar "+r.status+": "+(json?cloudErrText(json):txt));
  return json;
}
/* ===== TABELA PÚBLICA (só ranking) para o link dos pais =====
   Contém apenas nome do aluno + pontos, por mês e por categoria.
   NÃO contém data de nascimento nem foto. É a única coisa que o link
   dos pais consegue ler. Os dados sensíveis ficam só na tabela protegida. */
function publicPhotoFor(s){ return s.photoPath ? photoPublicUrl(s.photoPath) : (s.photo||null); }
function buildPublicState(){
  const pub={rules:(state&&state.settings&&state.settings.rules)||DEFAULT_RULES,months:{},generatedAt:new Date().toISOString()};
  MONTHS.forEach(mo=>{
    const bucket={};
    CATEGORIES.forEach(c=>{
      const list=rankedByMonth(c[0],mo).map(s=>({name:s.name,total:s.total,photo:publicPhotoFor(s)}));
      if(list.length)bucket[c[0]]=list;
    });
    if(Object.keys(bucket).length)pub.months[mo]=bucket;
  });
  return pub;
}
async function savePublicStateRest(){
  const payload={app_id:APP_ID,data:buildPublicState(),updated_at:new Date().toISOString()};
  const url=cloudUrl()+"/rest/v1/primo_public_state?on_conflict=app_id";
  const r=await authedFetch(url,{method:"POST",headers:{"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=representation"},body:JSON.stringify(payload)});
  if(!r.ok){const t=await r.text();throw new Error("REST público salvar "+r.status+": "+t);}
  return true;
}
async function loadPublicStateRest(){
  const url=cloudUrl()+"/rest/v1/primo_public_state?select=data,updated_at&app_id=eq."+encodeURIComponent(APP_ID)+"&limit=1";
  const r=await withTimeout(fetch(url,{method:"GET",headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY,"Accept":"application/json"},cache:"no-store"}),12000,"Banco demorou para responder");
  const txt=await r.text();
  let json=null;try{json=txt?JSON.parse(txt):null}catch(e){}
  if(!r.ok)throw new Error("REST público leitura "+r.status+": "+txt);
  const row=Array.isArray(json)?json[0]:json;
  return (row&&row.data)||null;
}
async function loadCloudClient(){
  if(!window.supabase)throw new Error("Biblioteca Supabase não carregou");
  sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{apikey:SUPABASE_KEY}}});
  const result=await withTimeout(sb.from("primo_app_state").select("data,updated_at").eq("app_id",APP_ID).maybeSingle(),12000,"Banco demorou para responder pelo client");
  if(result.error)throw result.error;
  return result.data;
}
async function saveCloudClient(){
  if(!window.supabase)throw new Error("Biblioteca Supabase não carregou");
  if(!sb)sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{apikey:SUPABASE_KEY}}});
  norm();
  const payload={app_id:APP_ID,data:state,updated_at:new Date().toISOString()};
  const result=await withTimeout(sb.from("primo_app_state").upsert(payload,{onConflict:"app_id"}),12000,"Banco demorou para salvar pelo client");
  if(result.error)throw result.error;
  return true;
}
async function initCloud(){
  // MODO PAIS: lê SOMENTE a tabela pública (ranking, sem dados sensíveis).
  if(isParentMode()){
    try{
      setSync("Carregando resultados...");
      parentData=await loadPublicStateRest();
      setSync("✅ Resultados carregados.","ok");
    }catch(e){
      console.error("Erro ao carregar tabela pública:",e);
      setSync("❌ Não carregou os resultados. Verifique a internet.","error");
    }
    if(typeof renderParentMode==="function")renderParentMode();
    return;
  }
  // MODO ADMIN: precisa estar logado para ler a tabela protegida.
  if(!isAdminAuthenticated()){
    setSync("🔒 Faça login de administrador para carregar os dados.","warn");
    saveLocal();renderAll();return;
  }
  let errors=[];
  try{
    setSync("Conectando ao banco online...");
    if(!SUPABASE_URL||!SUPABASE_KEY)throw new Error("URL ou Publishable Key ausente no supabase-config.js");
    // V28: usa REST direto. Evita travar por CDN/cache do Supabase Client no iPhone/PWA.
    const data=await loadCloudRest();
    if(data&&data.data&&Object.keys(data.data).length){
      state=data.data; norm(); currentMonth=state.currentMonth||currentMonth; saveLocal();
    }else{
      await saveCloudRest();
    }
    // Atualiza o espelho público (ranking) para o link dos pais.
    try{await savePublicStateRest();}catch(e){console.warn("Espelho público não atualizou agora:",e);}
    await refreshPhotoUrls();       // gera as URLs temporárias das fotos do Storage
    syncStudentsTable();            // mantém a tabela "um aluno por linha" atualizada
    setSync("✅ Banco online conectado.","ok");renderAll();
  }catch(e){
    errors.push(cloudErrText(e));
    console.error("Erro Supabase REST:",errors,e,{SUPABASE_URL,APP_ID});
    const detail=errors.join(" | ").slice(0,260);
    setSync("❌ Banco não conectou. REST: " + detail,"error");
    saveLocal();renderAll();
  }
}
async function saveCloud(){
  if(!cloudReady())return false;
  if(!isAdminAuthenticated())return false; // só o admin logado grava no banco
  const stamp=new Date().toISOString();
  try{
    state.updatedAt=stamp;norm();
    await saveCloudRest();
    await savePublicStateRest();
    syncStudentsTable(); // atualiza a tabela "um aluno por linha" (não trava se falhar)
    localStorage.setItem("primo_kids_last_cloud_ok",stamp);
    setSync("✅ Dados salvos online.","ok");return true;
  }catch(e){
    console.error("Erro ao salvar Supabase REST:",e,{SUPABASE_URL,APP_ID});
    setSync("❌ Não salvou online: REST "+cloudErrText(e).slice(0,180),"error");return false;
  }
}
function saveDbConfigFromScreen(){
  const url=document.getElementById("dbUrl")?.value?.trim();
  const anonKey=document.getElementById("dbKey")?.value?.trim();
  const appId=document.getElementById("dbAppId")?.value?.trim()||"primo_soccer_kids_league_2026";
  if(!url||!anonKey)return alert("Cole a Project URL e a Publishable Key do Supabase.");
  localStorage.setItem("primo_kids_db_config",JSON.stringify({url,anonKey,appId}));
  alert("Configuração salva neste aparelho. Agora feche e abra o app novamente para carregar com o banco correto.");
}
function fillDbConfigScreen(){
  const u=document.getElementById("dbUrl"), k=document.getElementById("dbKey"), a=document.getElementById("dbAppId");
  if(u)u.value=SUPABASE_URL||""; if(k)k.value=SUPABASE_KEY||""; if(a)a.value=APP_ID||"primo_soccer_kids_league_2026";
}
async function syncNow(){setSync("Sincronizando agora...");const ok=await saveCloud();alert(ok?"Sincronizado no banco online.":"Não conectou ao banco. Veja a mensagem verde/vermelha na tela para saber o erro exato.")}
async function loadCloud(){await initCloud()}

// ===== Logo + Link dos Pais v5 - seletor de todos os meses =====
let parentCategory = CATEGORIES[0][0];
let parentData = null; // ranking sanitizado carregado da tabela pública
let parentSelectedMonth = (()=>{
  try{
    const p = new URLSearchParams(location.search);
    const fromUrl = (p.get("mes") || p.get("month") || "").toUpperCase();
    const saved = localStorage.getItem("primo_kids_parent_month") || "";
    return MONTHS.includes(fromUrl) ? fromUrl : (MONTHS.includes(saved) ? saved : currentMonth);
  }catch(e){ return currentMonth; }
})();

function isParentMode(){
  const p = new URLSearchParams(location.search);
  return p.get("pais")==="1" || p.get("parents")==="1" || location.hash==="#pais";
}

function copyParentLink(){
  const url = location.origin + location.pathname + "?pais=1&mes=" + encodeURIComponent(parentSelectedMonth || currentMonth) + "&t=" + Date.now();
  const el = document.getElementById("parentLinkText");
  if(el) el.textContent = url;
  if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(()=>alert("Link dos pais copiado!"));
  } else {
    alert(url);
  }
}

function setParentCategory(cat){
  parentCategory = cat;
  renderParentMode();
}

function setParentMonth(m){
  if(!MONTHS.includes(m)) return;
  parentSelectedMonth = m;
  localStorage.setItem("primo_kids_parent_month", m);
  renderParentMode();
}

function renderParentMonthSelect(){
  ["parentMonthSelect","parentHeroMonthSelect"].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel)return;
    sel.innerHTML=MONTHS.map(m=>`<option value="${m}">${m}</option>`).join("");
    sel.value=parentSelectedMonth;
  });
}

function ensureParentHeroMonthSelect(){
  if(!isParentMode()) return;
  let box=document.querySelector(".parentHeroMonthBox");
  const monthTitle=document.querySelector(".officialMonth");
  if(!box){
    box=document.createElement("div");
    box.className="parentHeroMonthBox";
    box.innerHTML='<select id="parentHeroMonthSelect" onchange="setParentMonth(this.value)" aria-label="Selecionar mês da disputa"></select>';
    if(monthTitle && monthTitle.parentNode) monthTitle.insertAdjacentElement("afterend", box);
  }
  let sel=document.getElementById("parentHeroMonthSelect");
  if(!sel){
    sel=document.createElement("select");
    sel.id="parentHeroMonthSelect";
    sel.setAttribute("aria-label","Selecionar mês da disputa");
    sel.onchange=()=>setParentMonth(sel.value);
    box.appendChild(sel);
  }
  box.style.setProperty("display","block","important");
  box.style.setProperty("visibility","visible","important");
  box.style.setProperty("opacity","1","important");
  sel.style.setProperty("display","block","important");
  sel.innerHTML=MONTHS.map(m=>`<option value="${m}">${m}</option>`).join("");
  sel.value=parentSelectedMonth;
}

function renderParentMode(){
  if(!MONTHS.includes(parentSelectedMonth)) parentSelectedMonth=currentMonth;
  const m=document.getElementById("parentMonth");if(m)m.textContent=parentSelectedMonth;
  const hm=document.getElementById("heroMonth");if(hm)hm.textContent=parentSelectedMonth;
  ensureParentHeroMonthSelect();
  renderParentMonthSelect();
  const tabs=document.getElementById("parentCategoryTabs");if(tabs){tabs.innerHTML=CATEGORIES.map(c=>{const active=c[0]===parentCategory?"active":"";return `<button class="btn-${c[1]} ${active}" onclick="setParentCategory('${c[0]}')">${c[0]}</button>`}).join("")}
  const area=document.getElementById("parentRankingArea");if(area){
    const monthList=(parentData&&parentData.months&&parentData.months[parentSelectedMonth]&&parentData.months[parentSelectedMonth][parentCategory])||[];
    const rules=esc((parentData&&parentData.rules)||DEFAULT_RULES).replace(/\n/g,"<br>");
    area.innerHTML=`<div class="card neonRankCard"><h2 class="neonCatTitle">${esc(parentCategory)}</h2><h3 class="neonSub">🏆 Classificação • ${parentSelectedMonth}</h3><div class="rankList neonRankList">${monthList.map(parentRankRow).join("")||"<p>Nenhum resultado nesta categoria neste mês.</p>"}</div></div><div class="card rulesCard parentRulesOnly neonRulesCard"><h2>REGRAS DO CAMPEONATO</h2><p id="parentRulesInline">${rules}</p></div>`;
  }
}
function parentRankRow(o,i){const pos=i+1;const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":`${pos}º`;const top=i<3?`neonTop neonTop${pos}`:"";const av=o.photo?`<span class="avatar"><img src="${o.photo}" onclick="openPhoto('${o.photo}')"></span>`:`<span class="avatar">${initials(o.name)}</span>`;return`<div class="rankRow neonRow ${top}"><div class="rankLeft"><span class="neonPos">${medal}</span>${av}<span class="neonName">${esc(o.name)}</span></div><strong class="neonPts">${o.total} pts</strong></div>`}
const renderRankingsBase = renderRankings;
renderRankings = function(){
  renderRankingsBase();
  if(isParentMode()) renderParentMode();
};

function initParentModeIfNeeded(){
  if(!isParentMode()) return;
  document.body.classList.add("parentMode");
  if(!localStorage.getItem("primo_kids_parent_month")) parentSelectedMonth=currentMonth;
  showPage("pais");
  renderParentMode();
}

/* ===== PATCH FINAL JOÃO - IMPRESSÃO INTERNA + FOTO AMPLIADA + CAPA ESTÁVEL ===== */

function applyDashboardCover(){
  const hero = document.getElementById("appHero");
  if(!hero) return;

  const cover = state?.settings?.dashboardCoverCustom || "visual-kids-oficial.jpeg";

  hero.style.backgroundImage =
    `linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.20) 42%,rgba(2,8,23,.94)), url("${cover}")`;
}

function uploadCover(event){
  const file = event.target.files && event.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1200;
      let w = img.width;
      let h = img.height;

      if(w > maxW){
        h = Math.round(h * maxW / w);
        w = maxW;
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img,0,0,w,h);

      state.settings = state.settings || {};
      state.settings.dashboardCoverCustom = canvas.toDataURL("image/jpeg",0.86);

      scheduleSave();
      applyDashboardCover();
      alert("Capa do Dashboard atualizada!");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function clearCover(){
  if(!confirm("Remover capa personalizada?")) return;

  state.settings = state.settings || {};
  delete state.settings.dashboardCover;
  delete state.settings.dashboardCoverV9;
  delete state.settings.dashboardCoverCustom;

  scheduleSave();
  applyDashboardCover();
}

function openPhoto(src){
  let modal = document.getElementById("photoModal");

  if(!modal){
    modal = document.createElement("div");
    modal.id = "photoModal";
    modal.innerHTML = '<img id="photoModalImg" alt="Foto ampliada">';
    modal.onclick = () => modal.classList.remove("show");
    document.body.appendChild(modal);
  }

  const img = document.getElementById("photoModalImg");
  img.src = src;
  modal.classList.add("show");
}

function preparePrint(type){
  const cat = document.getElementById("printCategory").value;
  const list = type==="general" ? ranked() : ranked(cat);
  const title = type==="general" ? "RANKING GERAL DO MÊS" : cat;

  document.getElementById("printArea").innerHTML = `
    <div class="printCard printOnlyCard">
      <img src="primo-logo.png" class="printLogo">
      <h1>${APP_TITLE_HTML}</h1>
      <h2>${title} • ${currentMonth}</h2>
      <div class="printTableOnly">
        ${list.map((s,i)=>`
          <div class="printRow">
            <span>${i+1}º</span>
            <span class="printPhoto">
              ${photoSrc(s)?`<img src="${photoSrc(s)}" onclick="openPhoto('${photoSrc(s)}')">`:initials(s.name)}
            </span>
            <span>${esc(s.name)}</span>
            <strong>${s.total} pts</strong>
          </div>
        `).join("") || "<p>Nenhum aluno.</p>"}
      </div>
    </div>`;
}



/* ===== V13 PRINT POR CATEGORIA ===== */
preparePrint = function(type){
  const cat=document.getElementById("printCategory").value;
  const color=document.getElementById("printColor")?.value||"azul";
  const list=type==="annual"?rankedAnnual(cat):ranked(cat);
  const title=type==="annual"?`RANKING ANUAL • ${cat}`:`${cat} • ${currentMonth}`;
  document.getElementById("printArea").innerHTML=`<div class="printCard printOnlyCard print-${color}"><img src="primo-logo.png" class="printLogo"><h1>${APP_TITLE_HTML}</h1><h2>${title}</h2><div class="printTableOnly">${list.map((s,i)=>`<div class="printRow"><span>${i+1}º</span><span class="printPhoto">${photoSrc(s)?`<img src="${photoSrc(s)}" onclick="openPhoto('${photoSrc(s)}')">`:initials(s.name)}</span><span>${esc(s.name)}</span><strong>${s.total} pts</strong></div>`).join("")||"<p>Nenhum aluno.</p>"}</div></div>`;
};

window.addEventListener("beforeunload",()=>{try{saveLocal()}catch(e){}});
if(typeof isParentMode==="function" && isParentMode()){
  document.body.classList.add("parentMode");
  renderAll();
  initParentModeIfNeeded();
  renderParentMode();
}else{
  renderAll();
  showPage("dashboard");
}
initCloud();
setTimeout(()=>{ if(typeof initParentModeIfNeeded==="function") initParentModeIfNeeded(); if(typeof renderParentMode==="function" && isParentMode()) renderParentMode(); applyDashboardCover(); if(typeof initCropGestures==="function") initCropGestures(); },300);
setInterval(()=>{if(isParentMode())loadCloud();},10000);

/* ===== V33 SEGURANÇA - LOGIN REAL (SUPABASE AUTH via REST) ===== */
/* A senha NÃO fica mais no código. O login é feito no Supabase Auth.
   O admin recebe um token (JWT) temporário que autoriza gravar no banco.
   Sem esse token, ninguém consegue gravar (o RLS do banco bloqueia). */
const ADMIN_TOKEN_KEY = "primo_kids_admin_token_v33";
const ADMIN_REFRESH_KEY = "primo_kids_admin_refresh_v33";
function getAdminToken(){try{return sessionStorage.getItem(ADMIN_TOKEN_KEY)||""}catch(e){return ""}}
function isAdminAuthenticated(){return !!getAdminToken()}
function showAdminOverlay(show=true){const ov=document.getElementById("adminLoginOverlay");if(ov)ov.classList.toggle("hidden",!show);document.body.classList.toggle("adminLocked",show)}
async function refreshAdminToken(){
  let rt="";try{rt=sessionStorage.getItem(ADMIN_REFRESH_KEY)||""}catch(e){}
  if(!rt)return false;
  try{
    const r=await fetch(cloudUrl()+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:rt})});
    const j=await r.json().catch(()=>null);
    if(r.ok&&j&&j.access_token){sessionStorage.setItem(ADMIN_TOKEN_KEY,j.access_token);if(j.refresh_token)sessionStorage.setItem(ADMIN_REFRESH_KEY,j.refresh_token);return true;}
  }catch(e){}
  return false;
}
async function adminLogin(){
  const email=document.getElementById("adminUser")?.value?.trim();
  const pass=document.getElementById("adminPass")?.value||"";
  const err=document.getElementById("adminLoginError");
  if(err)err.textContent="";
  if(!email||!pass){if(err)err.textContent="Digite o e-mail e a senha do administrador.";return;}
  try{
    if(err)err.textContent="Entrando...";
    const r=await fetch(cloudUrl()+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password:pass})});
    const j=await r.json().catch(()=>null);
    if(!r.ok||!j||!j.access_token){if(err)err.textContent="E-mail ou senha incorretos.";return;}
    sessionStorage.setItem(ADMIN_TOKEN_KEY,j.access_token);
    if(j.refresh_token)sessionStorage.setItem(ADMIN_REFRESH_KEY,j.refresh_token);
    if(err)err.textContent="";
    showAdminOverlay(false);
    const b=document.getElementById("adminLogoutBtn");if(b)b.classList.remove("hidden");
    setSync("Admin conectado. Carregando dados...","ok");
    await initCloud();
    showPage("dashboard");renderAll();
  }catch(e){if(err)err.textContent="Falha ao conectar. Verifique a internet e tente de novo.";}
}
async function adminLogout(){
  const token=getAdminToken();
  try{if(token)await fetch(cloudUrl()+"/auth/v1/logout",{method:"POST",headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+token}});}catch(e){}
  try{sessionStorage.removeItem(ADMIN_TOKEN_KEY);sessionStorage.removeItem(ADMIN_REFRESH_KEY);}catch(e){}
  const b=document.getElementById("adminLogoutBtn");if(b)b.classList.add("hidden");
  showAdminOverlay(true);
}
function requireAdmin(){if(isParentMode())return false;if(isAdminAuthenticated())return true;showAdminOverlay(true);return false}
function initAdminGate(){if(isParentMode()){showAdminOverlay(false);return;}const ok=isAdminAuthenticated();showAdminOverlay(!ok);const b=document.getElementById("adminLogoutBtn");if(b)b.classList.toggle("hidden",!ok)}
["addStudent","editStudent","deleteStudent","addToSchedule","removeFromSchedule","setScore","adjustScore","toggleBonus","clearTrainingScore","finishTraining","copyAgendaFromMonth","clearCategoryAgenda","addCustomSchedule","removeCustomSchedule","saveRules","saveDbConfigFromScreen","uploadCover","clearCover","syncNow"].forEach(name=>{const fn=window[name];if(typeof fn==="function"){window[name]=function(...args){if(!requireAdmin())return;return fn.apply(this,args)}}});

const normBaseV32 = norm;
norm = function(){normBaseV32();Object.values(state.months||{}).forEach(m=>{Object.values(m.participants||{}).forEach(p=>{if(!p.presence)p.presence=Array.from({length:5},()=>({}));if(!Array.isArray(p.presence))p.presence=Array.from({length:5},(_,i)=>p.presence?.[i]||{});});});state.schemaVersion=32;};
function getPresence(id,w,sch){const p=participant(id);if(!p.presence)p.presence=Array.from({length:5},()=>({}));if(!p.presence[w])p.presence[w]={};return !!p.presence[w][sch]}
function setPresence(id,w,sch,val){const p=participant(id);if(!p.presence)p.presence=Array.from({length:5},()=>({}));if(!p.presence[w])p.presence[w]={};p.presence[w][sch]=!!val;scheduleSave(250);renderScore();}
function togglePresence(id,w,sch){if(!requireAdmin())return;setPresence(id,w,sch,!getPresence(id,w,sch))}
function presenceCount(id,m=currentMonth){const p=monthObj(m).participants[id];if(!p||!p.presence)return 0;return p.presence.reduce((a,w)=>a+Object.values(w||{}).filter(Boolean).length,0)}
function trainingCountPossible(id,m=currentMonth){const p=monthObj(m).participants[id];if(!p)return 0;return (p.schedules||[]).length*5}

scoreCardHtml = function(s,i,week,sch,score){
  const key=esc(scoreKey(s.id,week,sch));
  const id=JSON.stringify(s.id), safeSch=JSON.stringify(sch);
  const bonus=(field,label)=>`<div class="srItem"><label>${label}</label><button type="button" class="bonusMini srBonus ${(+score[field]||0)>0?"active":""}" onclick='toggleBonus(${id},${week},${safeSch},${JSON.stringify(field)},this)' title="${label}"><small data-bonus="${field}">${+score[field]||0}</small></button></div>`;
  return `<div class="scorePlayerCard scoreRowV37" data-score-key="${key}"><div class="srScroll"><div class="srAthlete"><span class="scorePos">${i+1}</span>${avatarHtml(s)}<strong class="srName">${esc(s.name)}</strong></div><div class="srCtrls"><div class="srItem srStep"><label>P/D</label>${scoreStepperHtml(s.id,week,sch,"pd",score.pd)}</div><div class="srItem srStep"><label>P/E</label>${scoreStepperHtml(s.id,week,sch,"pe",score.pe)}</div>${bonus("comportamento","Com")}${bonus("fruta","Fru")}${bonus("uniforme","Unif")}</div><div class="srTotal"><b data-total>${scoreTotal(score)}</b><small>pts</small></div></div></div>`;
};

renderScore = function(){
  const sch=document.getElementById("scoreSchedule")?.value||(schedulesFor(activeCategory))[0]||"",week=+document.getElementById("scoreWeek")?.value||0;
  const title=document.getElementById("scoreTitle"); if(title)title.textContent=`${activeCategory} • ${sch||"Selecione um horário"} • Semana ${week+1}`;
  const finished=isTrainingFinished(activeCategory,week,sch); const finishBox=document.getElementById("finishStatus");
  if(finishBox)finishBox.innerHTML=finished?`✅ Treino finalizado e salvo no banco online.`:`Treino em andamento. Ao terminar, toque em <strong>Finalizar treino</strong>.`;
  const list=activeByCategory().filter(s=>(participant(s.id,false)?.schedules||[]).includes(sch));
  const cards=document.getElementById("scoreCards"); if(cards)cards.innerHTML=list.map((s,i)=>scoreCardHtml(s,i,week,sch,getScore(s.id,week,sch))).join("")||`<div class="emptyScoreNotice">Nenhum aluno neste dia/horário. Vá em Agenda e adicione alunos neste horário.</div>`;
  const table=document.getElementById("scoreTable"); if(table)table.innerHTML=list.map((s,i)=>{const score=getScore(s.id,week,sch);const key=esc(scoreKey(s.id,week,sch));return`<tr data-score-key="${key}"><td>${i+1}</td><td class="sticky"><div class="playerCell">${avatarHtml(s)}<strong>${esc(s.name)}</strong></div></td><td>${scoreStepperHtml(s.id,week,sch,"pd",score.pd)}</td><td>${scoreStepperHtml(s.id,week,sch,"pe",score.pe)}</td>${["uniforme","fruta","comportamento"].map(field=>`<td><select class="bonusSelect" onchange='setScore(${JSON.stringify(s.id)},${week},${JSON.stringify(sch)},${JSON.stringify(field)},this.value,this)'><option value="0" ${score[field]==0?"selected":""}>0</option><option value="5" ${score[field]==5?"selected":""}>5</option></select></td>`).join("")}<td class="totalCell"><strong data-total>${scoreTotal(score)}</strong></td></tr>`}).join("")||`<tr><td colspan="8">Nenhum aluno neste dia/horário. Vá em Agenda e adicione alunos neste horário.</td></tr>`;
  syncScoreScroll();
};
/* V38 - rolar a linha de um aluno move a de todos (P/D, P/E... alinhados) */
function syncScoreScroll(){
  const rows=document.querySelectorAll("#scoreCards .srScroll");
  if(!rows.length)return;
  let lock=false;
  const apply=x=>{ rows.forEach(o=>{ if(Math.abs(o.scrollLeft-x)>1) o.scrollLeft=x; }); };
  rows.forEach(row=>{
    if(row.dataset.syncReady)return; row.dataset.syncReady="1";
    row.addEventListener("scroll",()=>{ if(lock)return; lock=true; const x=row.scrollLeft; apply(x); requestAnimationFrame(()=>{lock=false;}); },{passive:true});
  });
}

const finishTrainingV32Base = finishTraining;
finishTraining = async function(){if(!requireAdmin())return;const sch=document.getElementById("scoreSchedule")?.value,week=+document.getElementById("scoreWeek")?.value||0;if(sch){activeByCategory().filter(s=>(participant(s.id,false)?.schedules||[]).includes(sch)).forEach(s=>{if(!getPresence(s.id,week,sch))setPresence(s.id,week,sch,true)});}return finishTrainingV32Base();};

function totalStudentFiltered(id,m=currentMonth,weekFilter="all",scheduleFilter="all"){const p=monthObj(m).participants[id];if(!p)return 0;const weeks=p.weeks||[];return weeks.reduce((sum,w,i)=>{if(weekFilter!=="all"&&String(i)!==String(weekFilter))return sum;return sum+Object.entries(w||{}).reduce((s,[sch,sc])=>{if(scheduleFilter!=="all"&&sch!==scheduleFilter)return s;return s+scoreTotal(sc)},0)},0)}
function rankedFiltered(cat,m,weekFilter,scheduleFilter){return activeStudents(m).filter(s=>!cat||cat==="all"||s.category===cat).map(s=>({...s,total:totalStudentFiltered(s.id,m,weekFilter,scheduleFilter)})).filter(s=>s.total>0||presenceCount(s.id,m)>0).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name))}
function fillRankingFilters(){const m=document.getElementById("rankingMonthFilter"),c=document.getElementById("rankingCategoryFilter"),sch=document.getElementById("rankingScheduleFilter");if(m&&!m.dataset.ready){m.innerHTML=MONTHS.map(x=>`<option value="${x}">${x}</option>`).join("");m.dataset.ready="1"}if(m)m.value=m.value||currentMonth;if(c&&!c.dataset.ready){c.innerHTML=`<option value="all">Todas as categorias</option>`+CATEGORIES.map(x=>`<option value="${x[0]}">${x[0]}</option>`).join("");c.dataset.ready="1"}if(sch){const cat=c?.value||"all";const all=[...new Set((cat==="all"?CATEGORIES.flatMap(x=>schedulesFor(x[0])):schedulesFor(cat)))];const old=sch.value;sch.innerHTML=`<option value="all">Todos os horários</option>`+all.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");if([...sch.options].some(o=>o.value===old))sch.value=old}}
renderRankings = function(){
  fillRankingFilters();
  const month=document.getElementById("rankingMonthFilter")?.value||currentMonth,catFilter=document.getElementById("rankingCategoryFilter")?.value||"all",week=document.getElementById("rankingWeekFilter")?.value||"all",sch=document.getElementById("rankingScheduleFilter")?.value||"all";
  const categoryRanking=document.getElementById("categoryRanking"); if(categoryRanking){const monthList=ranked(activeCategory);categoryRanking.innerHTML=`<h3>🏆 Pontuação mensal • ${currentMonth}</h3>${monthList.map(rankRow).join("")||"<p>Nenhum aluno ativo nesta categoria.</p>"}`}
  const rg=document.getElementById("rankingGeneral");if(rg){const list=rankedFiltered(catFilter,month,week,sch);rg.innerHTML=`<h3>Filtro selecionado • ${month}</h3>${list.map((s,i)=>rankRow({...s,total:s.total},i)).join("")||"<p>Nenhum resultado com esse filtro.</p>"}`;}
  const all=document.getElementById("allCategoryRankings"); if(all){const cats=catFilter==="all"?CATEGORIES:CATEGORIES.filter(x=>x[0]===catFilter);all.innerHTML=cats.map(c=>{const monthly=rankedFiltered(c[0],month,week,sch);return`<div class="catCard cat-${c[1]}"><h2>${c[0]}</h2><h3>🏆 Pontuação filtrada • ${month}</h3>${monthly.map(rankRow).join("")||"<p>Nenhum aluno ativo no filtro.</p>"}</div>`}).join("")}
  if(typeof renderReportStudentSelect==="function")renderReportStudentSelect();
};

function renderReportStudentSelect(){const el=document.getElementById("reportStudentSelect");if(!el)return;const old=el.value;el.innerHTML=state.students.filter(s=>s.active!==false).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>`<option value="${s.id}">${esc(s.name)} • ${esc(s.category)}</option>`).join("");if([...el.options].some(o=>o.value===old))el.value=old}
function exportBackup(){if(!requireAdmin())return;norm();const blob=new Blob([JSON.stringify({app:"Primo Soccer Kids",version:"v32-pro",exportedAt:new Date().toISOString(),state},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`backup-primo-soccer-kids-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function importBackup(event){if(!requireAdmin())return;const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=async()=>{try{const json=JSON.parse(reader.result);const incoming=json.state||json;if(!incoming.students||!incoming.months)throw new Error("Arquivo inválido");if(!confirm("Restaurar este backup? Isso substituirá os dados deste aparelho e salvará no banco online."))return;state=incoming;currentMonth=state.currentMonth||currentMonth;norm();saveLocal();renderAll();await saveCloudNow();alert("Backup restaurado com sucesso!");}catch(e){alert("Não consegui importar esse backup: "+e.message)}finally{event.target.value=""}};reader.readAsText(file)}
function reportRows(cat=null){return state.students.filter(s=>s.active!==false&&(!cat||s.category===cat)).map(s=>({s,total:totalStudent(s.id),annual:annualTotalStudent(s.id),presence:presenceCount(s.id),possible:trainingCountPossible(s.id)})).sort((a,b)=>b.total-a.total||a.s.name.localeCompare(b.s.name))}
function reportHtml(title,rows){const totalPts=rows.reduce((a,r)=>a+r.total,0),pres=rows.reduce((a,r)=>a+r.presence,0),poss=rows.reduce((a,r)=>a+r.possible,0);return `<div class="reportCard"><img src="primo-logo.png" class="printLogo"><h1>${APP_TITLE_HTML}</h1><h2>${title}</h2><div class="reportGrid"><div class="reportMetric"><strong>${rows.length}</strong><br>aluno(s)</div><div class="reportMetric"><strong>${totalPts}</strong><br>pontos no mês</div><div class="reportMetric"><strong>${pres}/${poss}</strong><br>presenças marcadas</div><div class="reportMetric"><strong>${currentMonth}</strong><br>mês</div></div><table class="reportTable"><thead><tr><th>#</th><th>Aluno</th><th>Categoria</th><th>Mês</th><th>Anual</th><th>Presença</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.s.name)}</td><td>${esc(r.s.category)}</td><td>${r.total}</td><td>${r.annual}</td><td>${r.presence}/${r.possible}</td></tr>`).join("")}</tbody></table><p>Use o botão “Imprimir / Salvar imagem” para salvar em PDF.</p></div>`}
function prepareGeneralReport(){if(!requireAdmin())return;document.getElementById("printArea").innerHTML=reportHtml("Relatório geral do mês",reportRows());showPage("imprimir")}
function prepareStudentReport(){if(!requireAdmin())return;const id=document.getElementById("reportStudentSelect")?.value;const s=studentById(id)||state.students.find(x=>x.active!==false);if(!s)return alert("Cadastre pelo menos um aluno.");const rows=[{s,total:totalStudent(s.id),annual:annualTotalStudent(s.id),presence:presenceCount(s.id),possible:trainingCountPossible(s.id)}];document.getElementById("printArea").innerHTML=reportHtml(`Relatório individual • ${esc(s.name)}`,rows);showPage("imprimir")}

const PRIMO_SPONSORS=["iocontabil.jpg","somafra.jpg","saosilvestre.jpg","octo.jpg","saofrancisco.jpg","ademicon.jpg","dulopes.jpg","dosanjos.jpg","neimotos.jpg"];
preparePrint = function(type){
  const cat=document.getElementById("printCategory")?.value||activeCategory;
  const color=document.getElementById("printColor")?.value||"neon";
  const limit=document.getElementById("printLimit")?.value||"10";
  let list=(type==="general"?ranked():ranked(cat));
  if(limit!=="all")list=list.slice(0,+limit);
  const catName=type==="general"?"CLASSIFICAÇÃO GERAL":cat;
  const rows=list.map((s,i)=>{
    const pos=i+1, medal=pos===1?"🥇":pos===2?"🥈":pos===3?"🥉":`${pos}º`;
    const top=pos<=3?`printTop printTop${pos}`:"";
    const ph=photoSrc(s)?`<img src="${photoSrc(s)}">`:initials(s.name);
    return `<div class="printRow ${top}"><span class="printPos">${medal}</span><span class="printPhoto">${ph}</span><span class="printName">${esc(s.name)}</span><strong class="printPts">${s.total} pts</strong></div>`;
  }).join("")||"<p>Nenhum aluno nesta categoria.</p>";
  const sponsors=PRIMO_SPONSORS.map(src=>`<span class="printSponsor"><img src="${src}" alt=""></span>`).join("");
  document.getElementById("printArea").innerHTML=`<div class="printCard printOnlyCard printStory print-${color}">
    <div class="printHead"><img src="primo-logo.png" class="printLogo"><div class="printLeague"><span>PRIMO SOCCER</span><small>LEAGUE 2026</small></div></div>
    <div class="printMonth">MÊS: ${esc(currentMonth)}</div>
    <div class="printCatBanner">${esc(catName)}</div>
    <div class="printClassif">CLASSIFICAÇÃO • MAIOR PONTUADOR</div>
    <div class="printTableOnly">${rows}</div>
    <div class="printThanks">AGRADECIMENTO</div>
    <div class="printSponsors">${sponsors}</div>
  </div>`;
};

/* ===== V43 - BAIXAR CLASSIFICAÇÃO EM ALTA (Story 1080x1920, canvas) ===== */
function _loadImg(src){return new Promise(res=>{if(!src)return res(null);const im=new Image();im.crossOrigin="anonymous";im.onload=()=>res(im);im.onerror=()=>res(null);im.src=src;});}
function _rr(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function _fit(ctx,t,maxW){if(ctx.measureText(t).width<=maxW)return t;while(t.length>1&&ctx.measureText(t+"…").width>maxW)t=t.slice(0,-1);return t+"…";}
function _cover(ctx,img,x,y,w,h){const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;const s=Math.max(w/iw,h/ih),dw=iw*s,dh=ih*s;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
async function downloadStoryImage(type){
  if(!requireAdmin())return;
  try{
    setSync("Gerando imagem em alta definição...","warn");
    const cat=type==="general"?null:(document.getElementById("printCategory")?.value||activeCategory);
    const catName=(type==="general"?"CLASSIFICAÇÃO GERAL":cat)||"CLASSIFICAÇÃO";
    const limit=document.getElementById("printLimit")?.value||"all";
    let list=type==="general"?ranked():ranked(cat);
    if(limit!=="all")list=list.slice(0,+limit);
    if(!list.length){setSync("Nenhum aluno para gerar a imagem.","warn");alert("Não há alunos com pontos nessa classificação ainda.");return;}
    const logo=await _loadImg("primo-logo.png");
    const spImg=await _loadImg("patrocinadores.png?v=3");
    const photos=await Promise.all(list.map(s=>_loadImg(photoSrc(s))));
    const W=1080,H=1920,M=40;
    const TH={
      azul:{bg:["#0b2350","#061334","#020714"],accent:"56,189,248",soft:"#7dd3fc",rowFill:"9,20,52",rowBorder:"90,140,220"},
      ciano:{bg:["#08343a","#052227","#011114"],accent:"34,211,238",soft:"#67e8f9",rowFill:"8,47,73",rowBorder:"34,211,238"},
      verde:{bg:["#06351f","#04231a","#01120b"],accent:"52,211,153",soft:"#86efac",rowFill:"6,40,28",rowBorder:"52,211,153"},
      roxo:{bg:["#2a1150","#1a0b34","#0a0417"],accent:"167,139,250",soft:"#d8b4fe",rowFill:"30,16,60",rowBorder:"167,139,250"},
      vermelho:{bg:["#4a0f18","#2c0a10","#140406"],accent:"248,113,113",soft:"#fca5a5",rowFill:"50,14,20",rowBorder:"248,113,113"},
      rosa:{bg:["#4a0f33","#2c0a20","#140410"],accent:"244,114,182",soft:"#f9a8d4",rowFill:"50,14,40",rowBorder:"244,114,182"},
      dourado:{bg:["#3a2e08","#241c05","#120e02"],accent:"251,191,36",soft:"#fde047",rowFill:"40,32,8",rowBorder:"251,191,36"},
      grafite:{bg:["#20262e","#141920","#080b0f"],accent:"148,163,184",soft:"#cbd5e1",rowFill:"24,30,40",rowBorder:"148,163,184"}
    };
    const th=TH[document.getElementById("printColor")?.value]||TH.azul;
    const AC=a=>`rgba(${th.accent},${a})`,softC=th.soft;
    const cv=document.getElementById("storyCanvas")||document.createElement("canvas");
    cv.width=W;cv.height=H;const ctx=cv.getContext("2d");
    const spacer=(ctx.letterSpacing!==undefined);
    // fundo
    let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,th.bg[0]);g.addColorStop(.5,th.bg[1]);g.addColorStop(1,th.bg[2]);
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // logos grandes
    const LS=196;
    if(logo){ctx.drawImage(logo,28,38,LS,LS);ctx.drawImage(logo,W-28-LS,38,LS,LS);}
    // banner do título
    const bx=238,bw=W-2*bx,by=58,bh=150;
    _rr(ctx,bx,by,bw,bh,16);ctx.fillStyle="rgba(2,8,23,.75)";ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=AC(.55);ctx.stroke();
    ctx.textAlign="center";ctx.textBaseline="alphabetic";
    let sg=ctx.createLinearGradient(0,by,0,by+70);sg.addColorStop(0,"#ffffff");sg.addColorStop(1,"#dfe8f6");
    ctx.fillStyle=sg;let fs1=56;ctx.font=`900 ${fs1}px "Arial Black",Arial,sans-serif`;
    while(ctx.measureText("PRIMO SOCCER").width>bw-40&&fs1>34){fs1-=2;ctx.font=`900 ${fs1}px "Arial Black",Arial,sans-serif`;}
    ctx.fillText("PRIMO SOCCER",W/2,by+66);
    ctx.fillStyle=softC;let fs2=34;ctx.font=`900 ${fs2}px "Arial Black",Arial,sans-serif`;
    while(ctx.measureText("KIDS / INFANTO / JUVENIL").width>bw-30&&fs2>22){fs2-=2;ctx.font=`900 ${fs2}px "Arial Black",Arial,sans-serif`;}
    ctx.fillText("KIDS / INFANTO / JUVENIL",W/2,by+118);
    // MÊS pill
    ctx.font='900 40px Arial';const mtxt="MÊS: "+String(currentMonth||"").toUpperCase();const mw=ctx.measureText(mtxt).width+70;
    _rr(ctx,(W-mw)/2,228,mw,64,32);ctx.fillStyle="rgba(6,20,52,.85)";ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=AC(.7);ctx.stroke();
    ctx.fillStyle="#fff";ctx.textBaseline="middle";ctx.fillText(mtxt,W/2,262);ctx.textBaseline="alphabetic";
    // painel
    const pT=316,pB=H-300;_rr(ctx,M,pT,W-2*M,pB-pT,26);ctx.fillStyle="rgba(4,12,34,.5)";ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=AC(.45);ctx.stroke();
    // título categoria (grosso e destacado)
    let ts=76;ctx.font=`italic 900 ${ts}px "Arial Black",Arial,sans-serif`;
    const bigMax=W-2*M-70;while(ctx.measureText(catName.toUpperCase()).width>bigMax&&ts>40){ts-=2;ctx.font=`italic 900 ${ts}px "Arial Black",Arial,sans-serif`;}
    const tyBase=pT+66;
    ctx.save();ctx.shadowColor=AC(.85);ctx.shadowBlur=22;ctx.lineJoin="round";ctx.lineWidth=9;ctx.strokeStyle="rgba(2,8,23,.6)";ctx.strokeText(catName.toUpperCase(),W/2,tyBase);
    let tg=ctx.createLinearGradient(0,tyBase-ts,0,tyBase);tg.addColorStop(0,"#ffffff");tg.addColorStop(.5,"#dbe6f7");tg.addColorStop(.55,"#b9c6dc");tg.addColorStop(1,"#ffffff");
    ctx.fillStyle=tg;ctx.fillText(catName.toUpperCase(),W/2,tyBase);ctx.restore();
    if(spacer)ctx.letterSpacing="8px";
    ctx.fillStyle=softC;ctx.font='800 27px Arial';ctx.fillText("MAIOR PONTUADOR",W/2,pT+108);
    if(spacer)ctx.letterSpacing="0px";
    // linhas
    const rowsTop=pT+150,rowsBot=pB-20,gap=8,n=list.length;
    let rowH=Math.max(30,Math.min(88,(rowsBot-rowsTop-gap*(n-1))/n));
    const rowX=M+20,rowW=W-2*rowX;
    const gold="#ffd54a",silver="#eef4ff",bronze="#ff9d5c",blue="#bcd3ff";
    for(let i=0;i<n;i++){
      const s=list[i],y=rowsTop+i*(rowH+gap),pos=i+1;
      const isTop=pos<=3,accent=pos===1?gold:pos===2?silver:pos===3?bronze:blue;
      _rr(ctx,rowX,y,rowW,rowH,rowH/2);
      if(pos===1){let f=ctx.createLinearGradient(rowX,0,rowX+rowW,0);f.addColorStop(0,"rgba(70,56,12,.95)");f.addColorStop(1,"rgba(24,18,4,.9)");ctx.fillStyle=f;}
      else if(pos===2){ctx.fillStyle="rgba(40,48,66,.9)";}
      else if(pos===3){let f=ctx.createLinearGradient(rowX,0,rowX+rowW,0);f.addColorStop(0,"rgba(70,38,16,.95)");f.addColorStop(1,"rgba(24,14,6,.9)");ctx.fillStyle=f;}
      else{ctx.fillStyle=`rgba(${th.rowFill},.9)`;}
      ctx.fill();
      ctx.lineWidth=isTop?3:1.5;ctx.strokeStyle=isTop?accent:`rgba(${th.rowBorder},.5)`;
      if(isTop){ctx.save();ctx.shadowColor=accent;ctx.shadowBlur=18;ctx.stroke();ctx.restore();}else{ctx.stroke();}
      const cy=y+rowH/2,fs=Math.min(34,rowH*0.42);
      ctx.textBaseline="middle";
      ctx.textAlign="left";ctx.font=`900 ${fs}px Arial`;ctx.fillStyle=isTop?accent:softC;ctx.fillText(pos+"º",rowX+30,cy);
      // foto
      const r=rowH*0.40,pcx=rowX+140,ph=photos[i];
      ctx.save();ctx.beginPath();ctx.arc(pcx,cy,r,0,7);ctx.closePath();ctx.clip();
      if(ph){_cover(ctx,ph,pcx-r,cy-r,2*r,2*r);}else{ctx.fillStyle="#0b1c44";ctx.fillRect(pcx-r,cy-r,2*r,2*r);ctx.fillStyle=softC;ctx.font=`900 ${r*0.8}px Arial`;ctx.textAlign="center";ctx.fillText(initials(s.name),pcx,cy);}
      ctx.restore();
      ctx.lineWidth=2.5;ctx.strokeStyle=accent;ctx.beginPath();ctx.arc(pcx,cy,r,0,7);ctx.stroke();
      // nome
      ctx.textAlign="left";ctx.font=`800 ${fs}px Arial`;ctx.fillStyle="#fff";
      const nameX=pcx+r+24,ptsMax=160;
      ctx.fillText(_fit(ctx,String(s.name).toUpperCase(),rowW-(nameX-rowX)-ptsMax),nameX,cy);
      // pontos
      ctx.textAlign="right";ctx.font=`900 ${fs}px Arial`;ctx.fillStyle=isTop?accent:softC;ctx.fillText(s.total+" pts",rowX+rowW-30,cy);
    }
    ctx.textBaseline="alphabetic";
    // AGRADECIMENTO
    ctx.textAlign="center";if(spacer)ctx.letterSpacing="12px";
    ctx.fillStyle=softC;ctx.font='900 30px Arial';ctx.fillText("AGRADECIMENTO",W/2,pB+56);
    if(spacer)ctx.letterSpacing="0px";
    // faixa patrocinadores (imagem única)
    const spY=pB+80,spH=150,spX=M,spW=W-2*M;
    if(spImg){ctx.save();_rr(ctx,spX,spY,spW,spH,20);ctx.clip();_cover(ctx,spImg,spX,spY,spW,spH);ctx.restore();}
    else{_rr(ctx,spX,spY,spW,spH,20);let sgr=ctx.createLinearGradient(0,spY,0,spY+spH);sgr.addColorStop(0,"#050c22");sgr.addColorStop(1,"#010512");ctx.fillStyle=sgr;ctx.fill();ctx.fillStyle=softC;ctx.font='700 22px Arial';ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("(envie o arquivo patrocinadores.png)",W/2,spY+spH/2);ctx.textBaseline="alphabetic";}
    ctx.lineWidth=2;ctx.strokeStyle=AC(.5);ctx.save();ctx.shadowColor=AC(.5);ctx.shadowBlur=14;_rr(ctx,spX,spY,spW,spH,20);ctx.stroke();ctx.restore();
    // exportar
    const fname=`primo-${(catName).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${String(currentMonth||"").toLowerCase()}.png`;
    cv.toBlob(async(blob)=>{
      if(!blob){setSync("Não consegui gerar a imagem.","error");return;}
      const file=new File([blob],fname,{type:"image/png"});
      try{
        if(navigator.canShare&&navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:"Classificação Primo Soccer"});
          setSync("✅ Imagem pronta. Toque em Salvar imagem ou envie ao Instagram.","ok");return;
        }
      }catch(err){ if(err&&err.name==="AbortError"){setSync("Ok.","ok");return;} }
      const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=fname;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),3000);
      setSync("✅ Imagem baixada em alta definição.","ok");
    },"image/png");
  }catch(e){console.error(e);setSync("Erro ao gerar a imagem: "+(e.message||e),"error");alert("Não consegui gerar a imagem. Tente de novo.");}
}
(function(){
  var _renderAllBase = renderAll;
  renderAll = function(){ _renderAllBase(); fillRankingFilters(); renderReportStudentSelect(); initAdminGate(); };
})();
initAdminGate();renderAll();

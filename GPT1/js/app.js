const state = {
  lang: localStorage.getItem("lang") || "ru",
  course: null,
  i18n: null,
  currentModuleId: null,
  currentPageIndex: 0,
  quizAnswers: {}
};

function capFirst(s){
  if(!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function t(key){
  return (state.i18n?.[state.lang]?.[key]) || key;
}

function getText(obj){
  if(!obj) return "";
  return obj[state.lang] ?? obj["en"] ?? obj["ru"] ?? "";
}

function saveProgress(){
  const progress = {
    currentModuleId: state.currentModuleId,
    currentPageIndex: state.currentPageIndex,
    quizAnswers: state.quizAnswers
  };
  localStorage.setItem("progress", JSON.stringify(progress));
}

function loadProgress(){
  try{
    const raw = localStorage.getItem("progress");
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}

function setLang(lang){
  state.lang = lang;
  localStorage.setItem("lang", lang);
  render();
}

function setActiveModule(moduleId){
  state.currentModuleId = moduleId;
  state.currentPageIndex = 0;
  saveProgress();
  render();
}

function setPage(idx){
  state.currentPageIndex = idx;
  saveProgress();
  render();
}

function pct(n){ return Math.max(0, Math.min(100, n)); }

function moduleProgress(mod){
  const total = mod.pages.length + 1;
  const pos = Math.min(mod.pages.length, state.currentPageIndex) + 1;
  return pct(Math.round((pos/total)*100));
}

function quizScore(mod){
  const answers = state.quizAnswers[mod.id] || {};
  const qs = mod.quiz?.questions || [];
  if(qs.length === 0) return {score:0, max:0, percent:0};
  let correct = 0;
  qs.forEach((q, i)=>{ if(answers[i] === q.answerIndex) correct += 1; });
  const percent = Math.round((correct/qs.length)*100);
  return {score: correct, max: qs.length, percent};
}

function canPrintCertificate(){
  return state.course.modules.every(m=>{
    const s = quizScore(m).percent;
    return s >= (m.quiz?.passScore ?? 0);
  });
}

function render(){
  document.documentElement.style.setProperty("--primary", state.course?.branding?.primaryColor || "#008080");

  document.getElementById("courseTitle").textContent = t("courseTitle");
  document.getElementById("courseSub").textContent = `${state.course?.branding?.system || "SMS BOLLARD"}`;

  const ruBtn = document.getElementById("langRu");
  const enBtn = document.getElementById("langEn");
  ruBtn.setAttribute("aria-pressed", state.lang === "ru" ? "true" : "false");
  enBtn.setAttribute("aria-pressed", state.lang === "en" ? "true" : "false");

  const list = document.getElementById("moduleList");
  list.innerHTML = "";
  document.getElementById("chooseModule").textContent = capFirst(t("chooseModule"));

  state.course.modules.forEach(mod=>{
    const div = document.createElement("div");
    div.className = "item";
    div.onclick = ()=> setActiveModule(mod.id);

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = getText(mod.title);

    const small = document.createElement("div");
    small.className = "small";
    small.textContent = `${capFirst(t("continue"))}: ${moduleProgress(mod)}%`;

    div.appendChild(name);
    div.appendChild(small);
    list.appendChild(div);
  });

  const mod = state.course.modules.find(m=>m.id===state.currentModuleId) || state.course.modules[0];
  if(!state.currentModuleId) state.currentModuleId = mod.id;

  document.getElementById("progbar").style.width = `${moduleProgress(mod)}%`;

  const view = document.getElementById("view");
  view.innerHTML = "";

  const isQuiz = state.currentPageIndex >= mod.pages.length;
  if(!isQuiz){
    const page = mod.pages[state.currentPageIndex];
    const h1 = document.createElement("h1");
    h1.textContent = getText(page.title);

    const body = document.createElement("div");
    body.className = "body";
    body.innerHTML = page.body ? getText(page.body) : "";

    const wrap = document.createElement("div");
    wrap.className = "content";
    wrap.appendChild(h1);
    wrap.appendChild(body);
    view.appendChild(wrap);
  } else {
    const h1 = document.createElement("h1");
    h1.textContent = capFirst(t("quiz"));

    const wrap = document.createElement("div");
    wrap.className = "content";
    wrap.appendChild(h1);

    const qs = mod.quiz?.questions || [];
    qs.forEach((q, qi)=>{
      const box = document.createElement("div");
      box.className = "quiz-q";

      const qtext = document.createElement("div");
      qtext.style.fontWeight = "750";
      qtext.style.marginBottom = "8px";
      qtext.textContent = getText(q.text);
      box.appendChild(qtext);

      const name = `q_${mod.id}_${qi}`;
      q.options.forEach((opt, oi)=>{
        const label = document.createElement("label");
        label.className = "opt";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = name;
        input.checked = (state.quizAnswers?.[mod.id]?.[qi] === oi);
        input.onchange = ()=>{
          state.quizAnswers[mod.id] = state.quizAnswers[mod.id] || {};
          state.quizAnswers[mod.id][qi] = oi;
          saveProgress();
        };

        const span = document.createElement("span");
        span.textContent = getText(opt);

        label.appendChild(input);
        label.appendChild(span);
        box.appendChild(label);
      });

      wrap.appendChild(box);
    });

    const btnRow = document.createElement("div");
    btnRow.className = "btnrow";

    const submit = document.createElement("button");
    submit.className = "btn";
    submit.textContent = capFirst(t("submit"));
    submit.onclick = ()=>{
      const res = quizScore(mod);
      const pass = res.percent >= (mod.quiz?.passScore ?? 0);
      const badge = document.getElementById("resultBadge");
      badge.className = "badge " + (pass ? "ok" : "no");
      badge.textContent = `${pass ? capFirst(t("passed")) : capFirst(t("failed"))}: ${res.percent}%`;
      document.getElementById("toast").textContent = t("progressSaved");
      saveProgress();
    };

    const retry = document.createElement("button");
    retry.className = "btn secondary";
    retry.textContent = capFirst(t("retry"));
    retry.onclick = ()=>{
      state.quizAnswers[mod.id] = {};
      saveProgress();
      render();
    };

    btnRow.appendChild(submit);
    btnRow.appendChild(retry);
    wrap.appendChild(btnRow);

    const res = quizScore(mod);
    const pass = res.percent >= (mod.quiz?.passScore ?? 0);

    const badge = document.createElement("div");
    badge.id = "resultBadge";
    badge.className = "badge " + (pass ? "ok" : "no");
    badge.style.marginTop = "12px";
    badge.textContent = `${pass ? capFirst(t("passed")) : capFirst(t("failed"))}: ${res.percent}%`;
    wrap.appendChild(badge);

    view.appendChild(wrap);
  }

  const back = document.getElementById("btnBack");
  const next = document.getElementById("btnNext");
  const finish = document.getElementById("btnFinish");

  back.textContent = capFirst(t("back"));
  next.textContent = capFirst(t("next"));
  finish.textContent = capFirst(t("printCertificate"));

  back.disabled = state.currentPageIndex === 0;
  next.disabled = state.currentPageIndex >= mod.pages.length;
  finish.disabled = !canPrintCertificate();

  back.onclick = ()=> setPage(Math.max(0, state.currentPageIndex-1));
  next.onclick = ()=> setPage(Math.min(mod.pages.length, state.currentPageIndex+1));
  finish.onclick = ()=>{
    const name = prompt(capFirst(t("yourName")) + ":", "");
    if(name === null) return;
    const dt = new Date();
    const dateStr = dt.toISOString().slice(0,10);
    const url = `certificate.html?name=${encodeURIComponent(name)}&date=${encodeURIComponent(dateStr)}&lang=${encodeURIComponent(state.lang)}`;
    window.open(url, "_blank");
  };
}

async function boot(){
  const [courseRes, i18nRes] = await Promise.all([
    fetch("data/course.json"),
    fetch("data/i18n.json")
  ]);
  state.course = await courseRes.json();
  state.i18n = await i18nRes.json();

  const prog = loadProgress();
  if(prog?.currentModuleId){
    state.currentModuleId = prog.currentModuleId;
    state.currentPageIndex = prog.currentPageIndex ?? 0;
    state.quizAnswers = prog.quizAnswers ?? {};
  } else {
    state.currentModuleId = state.course.modules[0]?.id || null;
  }

  document.getElementById("langRu").onclick = ()=> setLang("ru");
  document.getElementById("langEn").onclick = ()=> setLang("en");

  render();
}
boot();

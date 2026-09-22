const PAGES = {};
let lastRun = null;
let pendingPreset = null;

function storeGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch (error) { return []; }
}

function storeSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function admin() { return role() === "admin"; }

function canOpen(name) {
  if (admin()) return true;
  return name === "home" || name === "mine" || name === "wear";
}

function ico(path) {
  return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
}

const ICO = {
  home: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z",
  box: "M4 8l8-4 8 4-8 4-8-4zM4 8v8l8 4 8-4V8",
  db: "M5 7c0-2 3-3 7-3s7 1 7 3-3 3-7 3-7-1-7-3zM5 7v5c0 2 3 3 7 3s7-1 7-3V7M5 12v5c0 2 3 3 7 3s7-1 7-3v-5",
  cpu: "M8 8h8v8H8zM4 10h4M4 14h4M16 10h4M16 14h4M10 4v4M14 4v4M10 16v4M14 16v4",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5",
  clock: "M12 7v6l4 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  scale: "M12 3v18M5 8h14M7 8l-3 6a3 3 0 0 0 6 0zM17 8l-3 6a3 3 0 0 0 6 0z"
};

function navBtn(active, id, label, icon, sub) {
  const cls = (sub ? "nav-sub" : "nav-btn") + (active === id ? " active" : "");
  return `<button class="${cls}" type="button" data-go="${id}">${icon ? ico(ICO[icon]) : ""}${esc(label)}</button>`;
}

function frame(active, body) {
  const predict = admin() ? `<div class="nav-label">预测中心</div>${navBtn(active, "hammer", "锤头", "", true)}${navBtn(active, "roller", "辊套", "", true)}${navBtn(active, "disc", "磨盘", "", true)}${navBtn(active, "grid", "篦板", "", true)}` : "";
  const manage = admin() ? `${navBtn(active, "models", "模型中心", "cpu")}${navBtn(active, "compare", "方案对比", "scale")}${navBtn(active, "report", "决策报告", "doc")}${navBtn(active, "history", "历史记录", "clock")}` : "";
  app.innerHTML = `<div class="app-shell">
    <aside class="side">
      <div class="side-brand"><strong>冀东装备</strong><span>核心备件智能预测与决策平台</span></div>
      <nav class="side-nav">
        ${navBtn(active, "home", "综合首页", "home")}
        ${predict}
        <div class="nav-label">数据中心</div>
        ${navBtn(active, "mine", "矿山原料", "", true)}
        ${navBtn(active, "wear", "耐磨材料", "", true)}
        ${manage}
      </nav>
      <div class="side-foot">浏览器内计算 · 与原软件同一套模型</div>
    </aside>
    <div class="workspace">
      <header class="top">
        <h1>核心备件智能预测与决策平台</h1>
        <div class="top-gap"></div>
        <span class="pill"><i class="dot"></i>模型就绪</span>
        <span class="muted">${admin() ? "管理员" : "查询账号"}</span>
        <button class="ghost" type="button" id="logout">退出</button>
      </header>
      <div class="content">${body}</div>
    </div>
  </div>`;
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.onclick = () => go(button.dataset.go);
  });
  document.querySelector("#logout").onclick = () => {
    sessionStorage.removeItem("jidong-role");
    if (location.hash) location.hash = "";
    renderLogin();
  };
}

function go(name, preset) {
  pendingPreset = preset || null;
  if (!canOpen(name)) name = "home";
  const next = "#" + name;
  if (location.hash === next) renderPage(name);
  else location.hash = name;
}

function renderPage(name) {
  const page = canOpen(name) ? name : "home";
  const fn = PAGES[page] || PAGES.home;
  if (fn) fn();
}

function onHash() {
  if (!role()) return renderLogin();
  let name = (location.hash || "#home").replace("#", "") || "home";
  if (!canOpen(name)) name = "home";
  if (location.hash !== "#" + name) {
    location.hash = name;
    return;
  }
  renderPage(name);
}

function numField(id, label, value) {
  return `<label class="field"><span>${label}</span><input id="${id}" type="number" step="any" value="${esc(value)}"></label>`;
}

function selectField(id, label, list) {
  return `<label class="field"><span>${label}</span><select id="${id}">${options(list)}</select></label>`;
}

function applyPreset(preset) {
  if (!preset) return;
  Object.keys(preset).forEach((key) => {
    const node = document.getElementById(key);
    if (!node || preset[key] == null || preset[key] === "") return;
    node.value = preset[key];
  });
}

function takePreset() {
  const preset = pendingPreset;
  pendingPreset = null;
  return preset;
}

function stepsHtml() {
  return `<ol class="steps" id="steps"><li class="done">01 参数输入</li><li>02 AI 预测</li><li>03 性能评估</li><li>04 敏感度</li><li>05 优化建议</li></ol>`;
}

function pageHead(kicker, title, lede, file) {
  return `<header class="page-head"><div><p class="kicker">${esc(kicker)}</p><h1>${esc(title)}</h1><p class="lede">${lede}</p></div><div class="model-pill"><b>XGBoost</b>${esc(file)}</div></header>`;
}

function resultShell(metrics) {
  return `<div id="stages" class="stages" hidden></div><div id="range-note" class="domain" hidden></div><div id="wait" class="wait">配置左侧参数后开始预测。结果会给出指标、同条件对比和原有文字建议。</div><div id="result-body" hidden><div class="metrics">${metrics}</div><div class="chart-grid"><section class="card"><h2>关键指标对比</h2><div id="bars"></div></section><section class="card"><h2>综合性能</h2><div class="radar-wrap" id="radar"></div></section></div><div class="two"><section class="card" id="extra"></section><section class="card" id="explain"></section></div><div class="decision-grid"><section class="card" id="advice"></section><section class="card gain" id="gain"></section></div><div class="row-actions no-print" style="margin-top:12px"><button class="ghost" type="button" id="pin">加入方案对比</button><button class="ghost" type="button" id="to-report">生成报告</button></div></div>`;
}

function metric(id, title) {
  return `<article class="metric"><h3>${title}</h3><strong id="${id}">—</strong><p class="muted" id="${id}-note"></p></article>`;
}

async function runStages() {
  const lines = ["正在加载模型", "正在进行特征编码", "正在运行预测", "正在生成智能分析"];
  for (let i = 0; i < lines.length; i += 1) {
    const el = document.querySelector("#stages");
    if (!el) return;
    el.hidden = false;
    el.textContent = lines[i];
    await new Promise((resolve) => setTimeout(resolve, 140));
  }
}

function showRange(notes) {
  const note = document.querySelector("#range-note");
  if (!note) return;
  if (!notes.length) {
    note.hidden = true;
    note.textContent = "";
    return;
  }
  note.hidden = false;
  note.textContent = "当前输入超出建议范围，本次仍会预测。" + notes.join("；");
}

function tone(label) {
  if (["极低", "很低", "低", "极优", "优秀", "卓越"].indexOf(label) >= 0) return "tone-good";
  if (["中等", "良好", "偏高"].indexOf(label) >= 0) return "tone-mid";
  return "tone-bad";
}

function median(nums) {
  const sorted = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (!sorted.length) return 0;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function bars(rows) {
  const max = Math.max.apply(null, rows.map((row) => row.value).concat([1e-9]));
  return rows.map((row) => {
    const width = Math.max(2, row.value / max * 100);
    return `<div class="bar-row"><span>${esc(row.label)}</span><div class="track"><i style="width:${width.toFixed(1)}%"></i></div><b>${esc(row.text)}</b></div>`;
  }).join("");
}

function radar(items) {
  const n = items.length;
  const cx = 120;
  const cy = 112;
  const radius = 70;
  const pt = (index, scale) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / n;
    return [cx + Math.cos(angle) * radius * scale, cy + Math.sin(angle) * radius * scale];
  };
  let rings = "";
  for (let scale = 0.25; scale <= 1; scale += 0.25) {
    const points = [];
    for (let index = 0; index < n; index += 1) points.push(pt(index, scale).map((value) => value.toFixed(1)).join(","));
    rings += `<polygon points="${points.join(" ")}" fill="none" stroke="#e4e9f0"/>`;
  }
  const poly = items.map((item, index) => pt(index, Math.max(0, Math.min(100, item.value)) / 100).map((value) => value.toFixed(1)).join(",")).join(" ");
  const labels = items.map((item, index) => {
    const point = pt(index, 1.28);
    return `<text x="${point[0].toFixed(1)}" y="${point[1].toFixed(1)}" text-anchor="middle" font-size="11" fill="#5c6b7a">${esc(item.label)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 240 230" role="img">${rings}<polygon points="${poly}" fill="rgba(23,105,224,0.25)" stroke="#1769E0"/>${labels}</svg>`;
}

function scatter(points) {
  const width = 320;
  const height = 210;
  const pad = 28;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min.apply(null, xs);
  const maxX = Math.max.apply(null, xs);
  const minY = Math.min.apply(null, ys);
  const maxY = Math.max.apply(null, ys);
  const sx = (value) => pad + (value - minX) / ((maxX - minX) || 1) * (width - pad * 2);
  const sy = (value) => height - pad - (value - minY) / ((maxY - minY) || 1) * (height - pad * 2);
  const dots = points.map((point) => `<circle cx="${sx(point.x).toFixed(1)}" cy="${sy(point.y).toFixed(1)}" r="${point.current ? 5.5 : 3.5}" fill="${point.current ? "#1769E0" : "#9db7d6"}"><title>${esc(point.name)}</title></circle>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img">${dots}</svg>`;
}

function adviceCards(text) {
  return text.trim().split(/\n\n+/).slice(1).map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const head = (lines[0] || "").replace(/：$/, "");
    const items = lines.slice(1).map((line) => `<li>${esc(line)}</li>`).join("");
    return `<section class="decision-card"><h3>${esc(head)}</h3>${items ? `<ul>${items}</ul>` : ""}</section>`;
  }).join("");
}

function pickLine(text, prefix) {
  const line = text.split("\n").map((item) => item.trim()).filter((item) => item.indexOf(prefix) === 0)[0];
  return line ? line.slice(prefix.length) : "";
}

function sensitivityHtml(models, row, fields, bases, names) {
  const head = names.map((name) => `<th>${esc(name)}</th>`).join("");
  const body = fields.map((field) => {
    const next = row.slice();
    const base = Number(next[field.index]);
    next[field.index] = base === 0 ? 1 : base * 1.1;
    const cells = models.map((model, index) => {
      const delta = predictXgb(model, next) - bases[index];
      return `<td class="${delta >= 0 ? "tone-good" : "tone-bad"}">${esc(signed(delta, 2))}</td>`;
    }).join("");
    return `<tr><td>${esc(field.label)} +10%</td>${cells}</tr>`;
  }).join("");
  return `<h2>输入敏感度</h2><p class="muted">每个数值输入提高 10% 后，用同一个模型重算。这是扰动结果，页面没有树模型的 SHAP 分解。</p><div class="table-wrap"><table><thead><tr><th>输入</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function remember(entry) {
  lastRun = entry;
  const list = storeGet("jidong-history");
  list.unshift(entry);
  storeSet("jidong-history", list.slice(0, 30));
}

function finishRun() {
  document.querySelectorAll("#steps li").forEach((item) => item.classList.add("done"));
  const stages = document.querySelector("#stages");
  const wait = document.querySelector("#wait");
  const body = document.querySelector("#result-body");
  if (stages) stages.hidden = true;
  if (wait) wait.hidden = true;
  if (body) body.hidden = false;
  const pin = document.querySelector("#pin");
  if (pin) pin.onclick = () => {
    if (!lastRun) return;
    const list = storeGet("jidong-compare");
    list.unshift(lastRun);
    storeSet("jidong-compare", list.slice(0, 8));
    pin.textContent = "已加入对比";
  };
  const report = document.querySelector("#to-report");
  if (report) report.onclick = () => {
    if (!lastRun) return;
    sessionStorage.setItem("jidong-report", String(lastRun.id));
    go("report");
  };
}

function renderLogin(message) {
  app.innerHTML = `<div class="login">
    <section class="login-hero">
      <h1>让核心备件选型从经验驱动走向数据与模型驱动</h1>
      <div class="login-stats"><div><strong>11</strong><span>预测模型</span></div><div><strong>4</strong><span>类核心备件</span></div><div><strong>244</strong><span>条业务数据</span></div></div>
    </section>
    <form class="login-panel" id="login-form">
      <p class="kicker">冀东装备</p>
      <h2>核心备件智能预测与决策平台</h2>
      <label class="field"><span>账号</span><input id="account" name="username" autocomplete="username" spellcheck="false" placeholder="请输入账号"></label>
      <label class="field"><span>密码</span><input id="password" name="password" type="password" autocomplete="current-password" placeholder="请输入密码"></label>
      <div class="error" id="login-error" role="alert">${esc(message || "")}</div>
      <div class="row-actions"><button class="primary" type="submit">登录系统</button><button class="ghost" type="button" id="reset-login">清空</button></div>
      <p class="fine">JD Equipment · AI Decision Platform</p>
    </form>
  </div>`;
  document.querySelector("#login-form").onsubmit = (event) => {
    event.preventDefault();
    const account = document.querySelector("#account").value.trim();
    const password = document.querySelector("#password").value.trim();
    if (account === "冀东装备" && password === "123456") {
      sessionStorage.setItem("jidong-role", "admin");
      location.hash = "home";
      renderPage("home");
    } else if (account === "材料查询" && password === "88888888") {
      sessionStorage.setItem("jidong-role", "viewer");
      location.hash = "home";
      renderPage("home");
    } else {
      document.querySelector("#login-error").textContent = "账号或密码不对，请再试一次。";
      document.querySelector("#password").value = "";
      document.querySelector("#password").focus();
    }
  };
  document.querySelector("#reset-login").onclick = () => {
    document.querySelector("#account").value = "";
    document.querySelector("#password").value = "";
    document.querySelector("#account").focus();
  };
}

function renderHome() {
  const cards = admin() ? [
    ["hammer", "锤头智能预测", "输入：矿石性能、设备型号、材料牌号", "输出：产量、成本效益、替换建议", "hammer.json"],
    ["roller", "辊套智能预测", "输入：矿石性能、规格型号", "输出：磨耗、更换产量、磨损量", "roller_*.json"],
    ["disc", "磨盘智能预测", "输入：矿石性能、规格型号", "输出：磨耗、更换产量、磨损量", "disc_*.json"],
    ["grid", "篦板智能预测", "输入：磨蚀性、小磨时间、硬度、面积、牌号", "输出：高低温端周期和产量", "grid_*.json"]
  ] : [
    ["mine", "矿山原料", "按公司和矿山查看化学成分与机械性能", "可把三项性能带入锤头预测", "mine.json"],
    ["wear", "耐磨材料", "按牌号、类别、硬度和成本筛选", "点击一行查看成分、热处理和性能", "wear.json"]
  ];
  frame("home", `<header class="page-head"><div><p class="kicker">综合首页</p><h1>${admin() ? "核心备件智能预测" : "材料与矿山数据"}</h1><p class="lede">${admin() ? "先看数据规模和模型状态，再进入锤头、辊套、磨盘或篦板。" : "当前账号可以查询矿山原料和耐磨材料。"}</p></div></header>
    <section class="kpi-row">
      <article class="card kpi"><span>数据记录</span><strong id="kpi-rows">244</strong><span>矿山与耐磨材料</span></article>
      <article class="card kpi"><span>预测模型</span><strong>11</strong><span>XGBoost 文件</span></article>
      <article class="card kpi"><span>核心备件</span><strong>4</strong><span>锤头、辊套、磨盘、篦板</span></article>
      <article class="card kpi"><span>覆盖企业</span><strong id="kpi-co">—</strong><span>按矿山数据统计</span></article>
    </section>
    <div class="split">
      <div class="card-grid">${cards.map((card) => `<button class="entry" type="button" data-go="${card[0]}"><b>${esc(card[1])}</b><small>${esc(card[2])}</small><small>${esc(card[3])}</small><small>模型 ${esc(card[4])}</small><em>进入</em></button>`).join("")}</div>
      <aside class="card"><h2>模型运行状态</h2><div class="status-list"><div><span>锤头模型</span><span class="pill"><i class="dot"></i>就绪</span></div><div><span>辊套模型</span><span class="pill"><i class="dot"></i>就绪</span></div><div><span>磨盘模型</span><span class="pill"><i class="dot"></i>就绪</span></div><div><span>篦板模型</span><span class="pill"><i class="dot"></i>就绪</span></div></div><p class="muted" style="margin-top:12px">文件随页面发布，计算在浏览器内完成。页面不展示未计算的准确率。</p></aside>
    </div>`);
  Promise.all([loadJson("data/mine.json"), loadJson("data/wear.json")]).then((pair) => {
    const rows = document.querySelector("#kpi-rows");
    const companies = document.querySelector("#kpi-co");
    if (!rows || !companies) return;
    rows.textContent = String(pair[0].length + pair[1].length);
    companies.textContent = String(new Set(pair[0].map((row) => cell(row, "公司名称")).filter(Boolean)).size);
  }).catch(() => {});
}

PAGES.home = renderHome;

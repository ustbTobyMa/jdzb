const app = document.querySelector("#app");
const modelCache = {};
let mineRows = null;
let wearRows = null;
let gridThresholds = null;
let mineResult = [];
let wearResult = [];
let mineDescending = true;
let wearDescending = true;

const MODELS = ["2-PCF2022", "2PCF2025", "PCF2018", "PCF2022", "PCF2425", "PSJ-0306", "TC-01", "TKPC20D22"];
const SUPPLIERS = ["富强", "恒达", "浙江长兴军毅", "热加工"];
const GRADES = [
  "Fe-13Mn-Al-C耐磨钢",
  "Fe-18Mn-Al-C耐磨钢",
  "Mn13 硼钇多元合金化",
  "Mn13 钒铌合金化",
  "Mn13 钼铈合金化",
  "Mn13Cr2 V-Ti-Nb 合金化 分级固溶",
  "Mn13Cr2/Mn18Cr2 分级固溶处理",
  "Mn13Cr2VTi改性高锰钢",
  "Mn13钨钇合金化",
  "Mn17Cr2 Ti-V-Nb-Ni合金化",
  "Mn18Cr2 TI-V-Nb合金化 分级固溶",
  "ZGMn18Cr2Mo复合超高锰钢"
];
const GRADE_COSTS = {
  "Fe-13Mn-Al-C耐磨钢": 6555.795,
  "Fe-18Mn-Al-C耐磨钢": 4030.57,
  "Mn13 硼钇多元合金化": 8745.35,
  "Mn13 钒铌合金化": 3385.675,
  "Mn13 钼铈合金化": 8547.31,
  "Mn13Cr2 V-Ti-Nb 合金化 分级固溶": 4053.29,
  "Mn13Cr2/Mn18Cr2 分级固溶处理": 8631.975,
  "Mn13Cr2VTi改性高锰钢": 4275.47,
  "Mn13钨钇合金化": 5083.605,
  "Mn17Cr2 Ti-V-Nb-Ni合金化": 3599.36,
  "Mn18Cr2 TI-V-Nb合金化 分级固溶": 7208.86,
  "ZGMn18Cr2Mo复合超高锰钢": 5696.92
};
const ROLLER_TYPES = ["HRM3400", "HRM3400B", "HRM3700", "HRM4800", "JLM1-46.4", "JLM5-46.4", "JLM7-46.4", "UM46.4", "盾石4.6M", "盾石5.4M"];
const DISC_TYPES = ROLLER_TYPES.concat(["莱歇5.6M"]);
const GRID_TYPES = ["冀东装备", "史密斯", "天津院"];
const GRID_BRANDS = GRADES.concat(GRID_TYPES);
const HALF = (total) => Math.floor(total / 2);

const MINE_SORT = [
  ["实际产能（万吨/年）", "实际产能（万吨/年）"],
  ["设计规模（万吨/年）", "设计规模（万吨/年）"],
  ["估算产值（万元）", "估算产值（万元）"],
  ["CaO含量（%）", "CaO（%）"],
  ["MgO含量（%）", "MgO（%）"],
  ["SiO₂含量（%）", "SiO₂（%）"],
  ["Al₂O₃含量（%）", "Al₂O₃（%）"],
  ["Fe₂O₃含量（%）", "Fe₂O₃（%）"],
  ["抗压强度（MPa）", "抗压强度（MPa）"],
  ["磨蚀性（g）", "磨蚀性（g）"],
  ["易磨性（KWh/t）", "易磨性（KWh/t）"]
];
const WEAR_SORT = [
  ["硬度/HB", "硬度/HB"],
  ["基体硬度/HRC", "基体硬度/HRC"],
  ["耐磨层硬度/HRC", "耐磨层硬度/HRC"],
  ["U口冲击值/J·cm⁻²", "U口冲击值/J·cm⁻²"],
  ["抗拉强度/MPa", "抗拉强度/MPa"],
  ["屈服强度/MPa", "屈服强度/MPa"],
  ["磨损率", "磨损率"],
  ["制作成本/元", "制作成本/元"]
];

function role() {
  return sessionStorage.getItem("jidong-role") || "";
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function num(value, digits) {
  return Number(value).toFixed(digits);
}

function signed(value, digits) {
  const text = Number(value).toFixed(digits);
  return value > 0 ? "+" + text : text;
}

function options(list) {
  return list.map((item) => `<option>${esc(item)}</option>`).join("");
}

function shell(title, body) {
  return `<div class="shell">
    <div class="topbar">
      <button class="ghost" id="back">返回首页</button>
      <div class="brand">${esc(title)}</div>
      <button class="ghost" id="logout">退出</button>
    </div>
    ${body}
  </div>`;
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("无法读取 " + url);
  return response.json();
}

async function loadModel(name) {
  if (!modelCache[name]) modelCache[name] = await loadJson("data/" + name + ".json");
  return modelCache[name];
}

function encode(numbers, groups) {
  const row = numbers.slice();
  groups.forEach((group) => {
    group.options.forEach((option) => row.push(option === group.selected ? 1 : 0));
  });
  return row;
}

function readNumber(id, fallback) {
  const text = document.querySelector(id).value.trim();
  if (text === "") return fallback;
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error("请输入有效数字");
  return value;
}

function bindChrome() {
  const back = document.querySelector("#back");
  const logout = document.querySelector("#logout");
  if (back) back.onclick = () => renderHome();
  if (logout) logout.onclick = () => {
    sessionStorage.removeItem("jidong-role");
    renderLogin();
  };
}

function renderLogin(message) {
  app.innerHTML = `<div class="login-wrap"><form class="plate stack" id="login-form">
    <header class="nameplate">
      <h1>冀东装备</h1>
      <p>核心备件智能预测系统</p>
    </header>
    <label class="field"><span>账号</span><input id="account" name="username" autocomplete="username" spellcheck="false" placeholder="请输入账号…"></label>
    <label class="field"><span>密码</span><input id="password" name="password" type="password" autocomplete="current-password" placeholder="请输入密码…"></label>
    <div class="error" id="login-error" role="alert">${esc(message || "")}</div>
    <div class="row-actions">
      <button class="primary" type="submit">登录</button>
      <button class="ghost" type="button" id="reset-login">清空</button>
    </div>
    <div class="hint">
      管理员：冀东装备 / 123456（预测和查询）<br>
      访客：材料查询 / 88888888（仅数据查询）
    </div>
  </form></div>`;
  document.querySelector("#login-form").onsubmit = (event) => {
    event.preventDefault();
    const account = document.querySelector("#account").value.trim();
    const password = document.querySelector("#password").value.trim();
    if (account === "冀东装备" && password === "123456") {
      sessionStorage.setItem("jidong-role", "admin");
      renderHome();
    } else if (account === "材料查询" && password === "88888888") {
      sessionStorage.setItem("jidong-role", "viewer");
      renderHome();
    } else {
      const error = document.querySelector("#login-error");
      error.textContent = "账号或密码不对，请再试一次。";
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
  if (!role()) return renderLogin();
  const admin = role() === "admin";
  const buttons = [];
  if (admin) {
    buttons.push(["hammer", "锤头产量预测", "predict", "按强度、磨蚀性和牌号估算产量"]);
    buttons.push(["roller", "辊套性能预测", "predict", "估算辊套消耗、产量和磨损"]);
    buttons.push(["disc", "磨盘寿命预测", "predict", "估算磨盘消耗、产量和磨损"]);
    buttons.push(["grid", "篦板周期预测", "predict", "估算两个周期的运行时间和产量"]);
  }
  buttons.push(["mine", "矿山原料查询", "query", "按矿山查看原料成分"]);
  buttons.push(["wear", "耐磨材料查询", "query", "按牌号查看耐磨材料性能"]);
  const title = admin ? "核心备件智能预测" : "材料性能查询";
  const sub = admin
    ? "按矿石性能预测锤头、辊套、磨盘和篦板。"
    : "查询矿山原料和耐磨材料。";
  app.innerHTML = `<div class="home"><main class="plate home-card">
    <header class="nameplate">
      <h1>冀东装备</h1>
      <p>${title}</p>
    </header>
    <p class="sub">${sub}</p>
    <div class="index">
      ${buttons.map(([id, label, kind, note]) => `<button class="entry ${kind}" data-go="${id}"><span class="entry-text"><b>${esc(label)}</b><small>${esc(note)}</small></span></button>`).join("")}
    </div>
    <p class="footer">© 2026 冀东装备</p>
  </main></div>`;
  app.querySelectorAll("[data-go]").forEach((button) => {
    button.onclick = () => openModule(button.dataset.go);
  });
}

function openModule(name) {
  if (name === "hammer") renderHammer();
  if (name === "roller") renderParts("roller");
  if (name === "disc") renderParts("disc");
  if (name === "grid") renderGrid();
  if (name === "mine") renderMine();
  if (name === "wear") renderWear();
}

function consumptionRating(value) {
  if (value < 0.05) return ["极低", "#009966"];
  if (value < 0.1) return ["很低", "#66cc66"];
  if (value < 0.2) return ["低", "#99cc66"];
  if (value < 0.4) return ["中等", "#ffcc00"];
  if (value < 0.6) return ["偏高", "#ff9933"];
  if (value < 0.8) return ["高", "#ff6666"];
  return ["很高", "#ff3333"];
}

function productionRating(value) {
  if (value > 80) return ["极优", "#009966"];
  if (value > 60) return ["优秀", "#66cc66"];
  if (value > 40) return ["良好", "#99cc66"];
  if (value > 25) return ["中等", "#ffcc00"];
  if (value > 15) return ["一般", "#ff9933"];
  if (value > 8) return ["较差", "#ff6666"];
  return ["很差", "#ff3333"];
}

function wearAmountRating(value) {
  if (value < 200) return ["极低", "#009966"];
  if (value < 400) return ["很低", "#66cc66"];
  if (value < 600) return ["低", "#99cc66"];
  if (value < 800) return ["中等", "#ffcc00"];
  if (value < 1000) return ["偏高", "#ff9933"];
  if (value < 1200) return ["高", "#ff6666"];
  return ["很高", "#ff3333"];
}

function percentileRating(value, thresholds) {
  const labels = ["极优", "优秀", "良好", "中等", "一般", "较差"];
  const colors = ["#009966", "#66cc66", "#99cc66", "#ffcc00", "#ff9933", "#ff6666"];
  for (let i = 5; i >= 0; i -= 1) {
    if (value > thresholds[i]) return [labels[5 - i], colors[5 - i]];
  }
  return ["很差", "#ff3333"];
}

function renderHammer() {
  app.innerHTML = shell("锤头产量预测", `<div class="layout">
    <form class="panel stack" id="form">
      <h2>智能锤头产量预测</h2>
      <p class="desc">输入矿石性能、设备和牌号，预测产量与成本效益。</p>
      <label class="field"><span>抗压强度（MPa）</span><input id="strength" type="number" step="any" value="250"></label>
      <label class="field"><span>磨蚀性（g）</span><input id="abrasion" type="number" step="any" value="15.5"></label>
      <label class="field"><span>易磨性（KWh/t）</span><input id="grind" type="number" step="any" value="12.8"></label>
      <label class="field"><span>型号</span><select id="model">${options(MODELS)}</select></label>
      <label class="field"><span>供货单位</span><select id="supplier">${options(SUPPLIERS)}</select></label>
      <label class="field"><span>牌号</span><select id="grade">${options(GRADES)}</select></label>
      <p class="desc" id="cost-now"></p>
      <div class="warn" id="range-note" hidden></div>
      <button class="primary" id="go" type="submit">开始智能预测</button>
    </form>
    <div class="stack">
      <div class="metrics">
        <article class="metric"><h3>预测产量（万吨）</h3><strong id="out-prod">等待预测</strong><p id="out-rank"></p></article>
        <article class="metric"><h3>成本效益（吨/元）</h3><strong id="out-eff">等待计算</strong><p id="out-eff-rank"></p></article>
      </div>
      <div class="metrics">
        <article class="metric"><h3>更高产量牌号</h3><p id="rec-prod">等待预测分析...</p></article>
        <article class="metric"><h3>更高效益牌号</h3><p id="rec-eff">等待预测分析...</p></article>
      </div>
      <pre class="analysis" id="advice" role="status">在左侧配置参数后点击“开始智能预测”。</pre>
    </div>
  </div>`);
  bindChrome();
  const grade = document.querySelector("#grade");
  const showCost = () => {
    document.querySelector("#cost-now").textContent = "当前牌号成本: " + GRADE_COSTS[grade.value].toFixed(2) + " 元";
  };
  grade.onchange = showCost;
  showCost();
  document.querySelector("#form").onsubmit = async (event) => {
    event.preventDefault();
    const button = document.querySelector("#go");
    button.disabled = true;
    try {
      const strength = readNumber("#strength", 250);
      const abrasion = readNumber("#abrasion", 15.5);
      const grind = readNumber("#grind", 12.8);
      const notes = [];
      if (strength <= 0 || strength > 1000) notes.push("抗压强度建议范围：0-1000 MPa");
      if (abrasion < 0 || abrasion > 100) notes.push("磨蚀性建议范围：0-100 g");
      if (grind < 0 || grind > 50) notes.push("易磨性建议范围：0-50 KWh/t");
      const note = document.querySelector("#range-note");
      note.hidden = notes.length === 0;
      note.textContent = notes.join("；");
      const model = await loadModel("hammer");
      const selected = {
        model: document.querySelector("#model").value,
        supplier: document.querySelector("#supplier").value,
        grade: grade.value
      };
      const all = GRADES.map((item) => {
        const row = encode([strength, abrasion, grind], [
          { options: MODELS, selected: selected.model },
          { options: SUPPLIERS, selected: selected.supplier },
          { options: GRADES, selected: item }
        ]);
        const prediction = predictXgb(model, row);
        const cost = GRADE_COSTS[item] || 1;
        return { grade: item, prediction, cost, efficiency: prediction * 10000 / cost };
      });
      showHammer(all.find((item) => item.grade === selected.grade), all);
    } catch (error) {
      document.querySelector("#advice").textContent = "预测失败：" + error.message;
    } finally {
      button.disabled = false;
    }
  };
}

function showHammer(current, all) {
  const byProd = all.slice().sort((a, b) => b.prediction - a.prediction);
  const byEff = all.slice().sort((a, b) => b.efficiency - a.efficiency);
  const prodRank = byProd.findIndex((item) => item.grade === current.grade) + 1;
  const effRank = byEff.findIndex((item) => item.grade === current.grade) + 1;
  const total = all.length;
  document.querySelector("#out-prod").textContent = num(current.prediction, 2);
  document.querySelector("#out-eff").textContent = num(current.efficiency, 4);
  document.querySelector("#out-rank").textContent = "产量排名：第 " + prodRank + " 名";
  let effLabel = "一般";
  let effColor = "#ef476f";
  if (effRank <= 3) {
    effLabel = "优秀";
    effColor = "#009966";
  } else if (effRank <= HALF(total)) {
    effLabel = "良好";
    effColor = "#ff8c00";
  }
  const eff = document.querySelector("#out-eff");
  eff.style.color = effColor;
  document.querySelector("#out-eff-rank").textContent = "效益评级: " + effLabel + " (第" + effRank + "名)";
  document.querySelector("#rec-prod").textContent = topGrades(byProd, current, "prediction", "产量", "万吨", 2);
  document.querySelector("#rec-eff").textContent = topGrades(byEff, current, "efficiency", "效益", "吨/元", 4);
  document.querySelector("#advice").textContent = hammerAdvice(current, all, prodRank, effRank);
}

function topGrades(sorted, current, key, label, unit, digits) {
  const better = sorted.filter((item) => item[key] > current[key] && item.grade !== current.grade).slice(0, 3);
  if (!better.length) return "当前牌号" + label + "已是最优";
  return better.map((item, index) => {
    const change = current[key] === 0 ? 0 : (item[key] - current[key]) / current[key] * 100;
    return (index + 1) + ". " + item.grade + "  " + label + " " + num(item[key], digits) + " " + unit + " (" + signed(change, 1) + "%)  成本 " + num(item.cost, 2) + " 元";
  }).join("\n");
}

function hammerAdvice(current, all, prodRank, effRank) {
  const total = all.length;
  const maxP = Math.max.apply(null, all.map((item) => item.prediction));
  const maxE = Math.max.apply(null, all.map((item) => item.efficiency));
  const composite = (maxP > 0 ? current.prediction / maxP : 0) * 0.6 + (maxE > 0 ? current.efficiency / maxE : 0) * 0.4;
  let text = "智能生产优化建议\n\n综合性能评估：\n";
  if (composite >= 0.85) text += "   综合表现：卓越\n";
  else if (composite >= 0.7) text += "   综合表现：优秀\n";
  else if (composite >= 0.55) text += "   综合表现：良好\n";
  else text += "   综合表现：一般\n";
  text += prodRank === 1 ? "   产量表现：最优（第1名）\n" : "   产量表现：" + rankWord(prodRank, total) + "（第" + prodRank + "名）\n";
  text += effRank === 1 ? "   成本效益：最优（第1名）\n" : "   成本效益：" + rankWord(effRank, total) + "（第" + effRank + "名）\n";
  let shouldChange = false;
  let reason = "";
  if (prodRank > HALF(total) && effRank > HALF(total)) {
    shouldChange = true;
    reason = "当前牌号在产量和成本效益方面均表现不佳";
  }
  const better = all.some((item) => {
    if (item.grade === current.grade || current.prediction === 0 || current.efficiency === 0) return false;
    return (item.prediction - current.prediction) / current.prediction > 0.15 && (item.efficiency - current.efficiency) / current.efficiency > 0.15;
  });
  if (better) {
    shouldChange = true;
    reason = "存在明显更好的替代牌号";
  }
  text += "\n牌号替换建议：\n";
  if (shouldChange) {
    const best = all.slice().sort((a, b) => scoreOf(b, maxP, maxE) - scoreOf(a, maxP, maxE))[0];
    const prodChange = current.prediction === 0 ? 0 : (best.prediction - current.prediction) / current.prediction * 100;
    const effChange = current.efficiency === 0 ? 0 : (best.efficiency - current.efficiency) / current.efficiency * 100;
    text += "   建议更换为：" + best.grade + "\n   理由：" + reason + "\n   预计产量变化：" + signed(prodChange, 1) + "%\n   预计效益变化：" + signed(effChange, 1) + "%\n   新牌号成本：" + num(best.cost, 2) + "元\n";
  } else {
    text += "   当前牌号表现良好，无需更换\n";
  }
  text += "\n成本优化策略：\n";
  if (current.cost > 7000) {
    text += "   当前牌号属于高成本类别\n";
    text += effRank > HALF(total) ? "   建议评估低成本替代牌号，或与供应商谈判降低采购价格\n" : "   高成本但效益尚可，可继续使用，并关注原材料价格波动\n";
  } else if (current.cost > 5000) {
    text += "   当前牌号属于中成本类别\n   成本水平适中，建议维持现状，并定期评估新牌号性价比\n";
  } else {
    text += "   当前牌号属于低成本类别\n   成本控制良好，具有价格竞争优势\n";
    if (effRank <= 3) text += "   低成本高效益，是理想选择\n";
  }
  const risks = [];
  const chances = [];
  if (current.cost > 8000 && effRank > HALF(total)) risks.push("高成本低效益，存在严重亏损风险");
  if (current.prediction < 20) risks.push("产量过低，可能无法满足生产需求");
  if (effRank <= 3 && current.cost < 5000) chances.push("低成本高效益，具有显著竞争优势");
  if (prodRank === 1 && effRank <= 3) chances.push("产量和效益双优，是理想的生产选择");
  text += "\n风险提示与机会：\n";
  text += risks.length ? risks.map((item) => "   " + item).join("\n") + "\n" : "   当前配置风险可控\n";
  if (chances.length) text += "   发展机会：\n" + chances.map((item) => "   " + item).join("\n") + "\n";
  text += "\n总结建议：\n";
  if (composite >= 0.8) text += "   当前配置表现卓越，建议继续使用并扩大生产规模。";
  else if (composite >= 0.6) text += "   当前配置表现良好，建议维持现状并关注优化机会。";
  else if (composite >= 0.4) text += "   当前配置有优化空间，建议评估替代牌号或优化生产工艺。";
  else text += "   当前配置需要改进，强烈建议更换牌号或重新评估生产策略。";
  return text;
}

function rankWord(rank, total) {
  if (rank <= 3) return "优秀";
  if (rank <= Math.floor(total / 3)) return "良好";
  return "有待提升";
}

function scoreOf(item, maxP, maxE) {
  return (maxP > 0 ? item.prediction / maxP : 0) * 0.6 + (maxE > 0 ? item.efficiency / maxE : 0) * 0.4;
}

function renderParts(kind) {
  const isDisc = kind === "disc";
  const title = isDisc ? "磨盘寿命预测" : "辊套性能预测";
  const types = isDisc ? DISC_TYPES : ROLLER_TYPES;
  app.innerHTML = shell(title, `<div class="layout">
    <form class="panel stack" id="form">
      <h2>${title}</h2>
      <p class="desc">预测磨耗、更换产量和磨损量。</p>
      <label class="field"><span>抗压强度（MPa）</span><input id="strength" type="number" step="any" value="120"></label>
      <label class="field"><span>磨蚀性（g）</span><input id="abrasion" type="number" step="any" value="0.05"></label>
      <label class="field"><span>易磨性（KWh/t）</span><input id="grind" type="number" step="any" value="11.8"></label>
      <label class="field"><span>规格型号</span><select id="type">${options(types)}</select></label>
      <div class="warn" id="range-note" hidden></div>
      <button class="primary" type="submit" id="go">开始智能预测</button>
    </form>
    <div class="stack">
      <div class="metrics">
        <article class="metric"><h3>磨耗（kg/万吨）</h3><strong id="m1">等待预测</strong><p id="r1">评级: -</p></article>
        <article class="metric"><h3>更换产量（万吨）</h3><strong id="m2">等待预测</strong><p id="r2">评级: -</p></article>
        <article class="metric"><h3>磨损量（kg）</h3><strong id="m3">等待预测</strong><p id="r3">评级: -</p></article>
      </div>
      <pre class="analysis" id="advice" role="status">在左侧配置参数后点击“开始智能预测”。</pre>
    </div>
  </div>`);
  bindChrome();
  document.querySelector("#form").onsubmit = async (event) => {
    event.preventDefault();
    const button = document.querySelector("#go");
    button.disabled = true;
    try {
      const strength = readNumber("#strength", 120);
      const abrasion = readNumber("#abrasion", 0.05);
      const grind = readNumber("#grind", 11.8);
      const notes = [];
      if (strength <= 0 || strength > 1000) notes.push("抗压强度建议范围：0-1000 MPa");
      if (abrasion < 0 || abrasion > 100) notes.push("磨蚀性建议范围：0-100 g");
      if (grind < 0 || grind > 50) notes.push("易磨性建议范围：0-50 KWh/t");
      const note = document.querySelector("#range-note");
      note.hidden = notes.length === 0;
      note.textContent = notes.join("；");
      const names = isDisc
        ? ["disc_consumption", "disc_production", "disc_wear"]
        : ["roller_consumption", "roller_production", "roller_wear"];
      const models = await Promise.all(names.map(loadModel));
      const row = encode([strength, abrasion, grind], [{ options: types, selected: document.querySelector("#type").value }]);
      paintParts(isDisc ? "磨盘" : "辊套", models.map((model) => predictXgb(model, row)));
    } catch (error) {
      document.querySelector("#advice").textContent = "预测失败：" + error.message;
    } finally {
      button.disabled = false;
    }
  };
}

function paintParts(name, values) {
  const ratings = [consumptionRating(values[0]), productionRating(values[1]), wearAmountRating(values[2])];
  ["m1", "m2", "m3"].forEach((id, index) => {
    const digits = index === 0 ? 3 : index === 1 ? 2 : 1;
    const node = document.querySelector("#" + id);
    node.textContent = num(values[index], digits);
    node.style.color = ratings[index][1];
    document.querySelector("#r" + (index + 1)).textContent = "评级: " + ratings[index][0];
  });
  document.querySelector("#advice").textContent = partsAdvice(name, values, ratings.map((item) => item[0]));
}

function partsAdvice(name, values, labels) {
  const consumption = values[0];
  const production = values[1];
  const wear = values[2];
  const prodScore = production > 0 ? Math.min(100, production) : 0;
  const consScore = consumption > 0 ? Math.max(0, Math.min(100, 0.2 / consumption * 100)) : 0;
  const wearScore = wear > 0 ? Math.max(0, Math.min(100, 600 / wear * 100)) : 0;
  const overall = prodScore * 0.5 + consScore * 0.3 + wearScore * 0.2;
  let level = "较差";
  if (overall >= 85) level = "卓越";
  else if (overall >= 70) level = "优秀";
  else if (overall >= 55) level = "良好";
  else if (overall >= 40) level = "一般";
  let text = name + "性能综合分析\n\n总体评估：\n";
  text += "   综合表现：" + level + " (" + num(overall, 1) + "/100)\n";
  text += "   综合评分组成：更换产量 " + num(prodScore, 1) + " 分（权重0.5），磨耗 " + num(consScore, 1) + " 分（权重0.3），磨损量 " + num(wearScore, 1) + " 分（权重0.2）\n\n";
  text += "分项表现：\n";
  text += "   1. 更换产量：" + num(production, 2) + " 万吨（" + labels[1] + "）\n";
  text += "   2. 磨耗：" + num(consumption, 3) + " kg/万吨（" + labels[0] + "）\n";
  text += "   3. 磨损量：" + num(wear, 1) + " kg（" + labels[2] + "）\n\n关键发现：\n";
  if (production > 60) text += "   更换产量表现优异，设备寿命较长\n";
  else if (production < 20) text += "   更换产量偏低，可能需要频繁更换\n";
  if (consumption < 0.1) text += "   磨耗表现优秀，耐磨性能好\n";
  else if (consumption > 0.5) text += "   磨耗偏高，材料耐磨性有待提升\n";
  if (wear < 500) text += "   磨损量控制良好\n";
  else if (wear > 1000) text += "   磨损量较高，需关注材料强度\n";
  text += "\n优化建议：\n";
  if (production < 30 || consumption > 0.3 || wear > 800) {
    text += "   当前配置存在优化空间：\n";
    if (consumption > 0.3) text += "   选择更耐磨的材料配方，优化热处理工艺提高硬度\n";
    if (production < 30) text += "   考虑使用更高强度的合金，优化" + name + "结构设计\n";
    if (wear > 800) text += "   加强润滑和冷却，定期检查，预防过度磨损\n";
  } else {
    text += "   当前配置表现良好，建议保持工艺、定期监控并建立维护档案\n";
  }
  text += "\n经济性：\n";
  if (production > 50) text += "   预计每月产量 " + num(production / 12, 2) + " 万吨，更换频率低，运行成本低\n";
  else if (production > 25) text += "   运行成本适中\n";
  else text += "   更换频繁，运行成本较高\n";
  text += "\n维护建议：\n";
  text += consumption > 0.4 ? "   建议缩短检查周期至每月一次，重点关注磨耗较大的部位\n" : "   可按常规每季度检查一次\n";
  text += "\n总结：\n";
  if (overall >= 70) text += "   当前" + name + "配置性能优秀，建议继续使用并作为标准配置。";
  else if (overall >= 50) text += "   当前" + name + "配置可以满足生产需求，部分环节仍可优化。";
  else text += "   当前" + name + "配置有待改进，建议重新评估材料和工艺。";
  return text;
}

function renderGrid() {
  app.innerHTML = shell("篦板周期预测", `<div class="layout">
    <form class="panel stack" id="form">
      <h2>智能篦板预测</h2>
      <p class="desc">预测高、低温端的更换周期和更换产量。</p>
      <label class="field"><span>磨蚀性（g）</span><input id="abrasion" type="number" step="any" value="0.109"></label>
      <label class="field"><span>小磨实验时间（分钟）</span><input id="time" type="number" step="any" value="31"></label>
      <label class="field"><span>硬度（HB）</span><input id="hard" type="number" step="any" value="525"></label>
      <label class="field"><span>篦冷机面积（m²）</span><input id="area" type="number" step="any" value="286"></label>
      <label class="field"><span>规格型号</span><select id="type">${options(GRID_TYPES)}</select></label>
      <label class="field"><span>牌号</span><select id="brand">${options(GRID_BRANDS)}</select></label>
      <div class="warn" id="range-note" hidden></div>
      <button class="primary" type="submit" id="go">开始智能预测</button>
    </form>
    <div class="stack">
      <div class="metrics">
        <article class="metric"><h3>高温端更换周期（天）</h3><strong id="m1">等待预测</strong><p id="r1">评级: -</p></article>
        <article class="metric"><h3>高温端更换产量（万吨）</h3><strong id="m2">等待预测</strong><p id="r2">评级: -</p></article>
        <article class="metric"><h3>低温端更换周期（天）</h3><strong id="m3">等待预测</strong><p id="r3">评级: -</p></article>
        <article class="metric"><h3>低温端更换产量（万吨）</h3><strong id="m4">等待预测</strong><p id="r4">评级: -</p></article>
      </div>
      <pre class="analysis" id="advice" role="status">在左侧配置参数后点击“开始智能预测”。</pre>
    </div>
  </div>`);
  bindChrome();
  document.querySelector("#form").onsubmit = async (event) => {
    event.preventDefault();
    const button = document.querySelector("#go");
    button.disabled = true;
    try {
      const abrasion = readNumber("#abrasion", 0.109);
      const time = readNumber("#time", 31);
      const hard = readNumber("#hard", 525);
      const area = readNumber("#area", 286);
      const notes = [];
      if (abrasion <= 0 || abrasion > 10) notes.push("磨蚀性建议范围：0-10 g");
      if (time <= 0 || time > 100) notes.push("小磨实验时间建议范围：0-100 分钟");
      if (hard <= 0 || hard > 1000) notes.push("硬度建议范围：0-1000 HB");
      if (area <= 0 || area > 1000) notes.push("篦冷机面积建议范围：0-1000 m²");
      const note = document.querySelector("#range-note");
      note.hidden = notes.length === 0;
      note.textContent = notes.join("；");
      if (!gridThresholds) gridThresholds = await loadJson("data/grid_thresholds.json");
      const models = await Promise.all(["grid_cycle1", "grid_prod1", "grid_cycle2", "grid_prod2"].map(loadModel));
      const row = encode([abrasion, time, hard, area], [
        { options: GRID_TYPES, selected: document.querySelector("#type").value },
        { options: GRID_BRANDS, selected: document.querySelector("#brand").value }
      ]);
      const values = models.map((model) => predictXgb(model, row));
      const ratings = [
        percentileRating(values[0], gridThresholds.cycle1),
        percentileRating(values[1], gridThresholds.prod1),
        percentileRating(values[2], gridThresholds.cycle2),
        percentileRating(values[3], gridThresholds.prod2)
      ];
      values.forEach((value, index) => {
        const node = document.querySelector("#m" + (index + 1));
        node.textContent = num(value, 1);
        node.style.color = ratings[index][1];
        document.querySelector("#r" + (index + 1)).textContent = "评级: " + ratings[index][0];
      });
      document.querySelector("#advice").textContent = gridAdvice(values, ratings.map((item) => item[0]));
    } catch (error) {
      document.querySelector("#advice").textContent = "预测失败：" + error.message;
    } finally {
      button.disabled = false;
    }
  };
}

function gridAdvice(values, labels) {
  const scores = [
    values[0] > 0 ? Math.min(100, values[0] / 1000 * 100) : 0,
    values[1] > 0 ? Math.min(100, values[1] / 800 * 100) : 0,
    values[2] > 0 ? Math.min(100, values[2] / 1000 * 100) : 0,
    values[3] > 0 ? Math.min(100, values[3] / 800 * 100) : 0
  ];
  const overall = scores.reduce((sum, score) => sum + score * 0.25, 0);
  let level = "较差";
  if (overall >= 85) level = "卓越";
  else if (overall >= 70) level = "优秀";
  else if (overall >= 55) level = "良好";
  else if (overall >= 40) level = "一般";
  let text = "篦板性能综合分析\n\n总体评估：\n   综合表现：" + level + " (" + num(overall, 1) + "/100)\n";
  text += "   高温周期 " + num(scores[0], 1) + "，高温产量 " + num(scores[1], 1) + "，低温周期 " + num(scores[2], 1) + "，低温产量 " + num(scores[3], 1) + "（各项权重 0.25）\n\n";
  text += "分项表现：\n";
  text += "   1. 高温端更换周期：" + num(values[0], 1) + " 天（" + labels[0] + "）\n";
  text += "   2. 高温端更换产量：" + num(values[1], 1) + " 万吨（" + labels[1] + "）\n";
  text += "   3. 低温端更换周期：" + num(values[2], 1) + " 天（" + labels[2] + "）\n";
  text += "   4. 低温端更换产量：" + num(values[3], 1) + " 万吨（" + labels[3] + "）\n\n关键发现：\n";
  if (labels.some((item) => item === "极优" || item === "优秀")) text += "   部分指标达到优秀及以上水平\n";
  if (values[1] > 400 && values[3] > 400) text += "   高低温端更换产量均表现优异\n";
  else if (values[1] < 150 || values[3] < 150) text += "   部分端位更换产量偏低，可能需要频繁更换\n";
  if (values[0] > 500 && values[2] > 500) text += "   高低温端更换周期均较长，维护成本低\n";
  else if (values[0] < 200 || values[2] < 200) text += "   部分端位更换周期偏短，需关注耐磨性能\n";
  text += "\n优化建议：\n";
  if (labels.some((item) => item === "较差" || item === "很差")) {
    text += "   当前配置存在较大优化空间\n";
    if (labels[0] === "较差" || labels[0] === "很差" || labels[2] === "较差" || labels[2] === "很差") text += "   选择更耐磨的配方，优化热处理工艺\n";
    if (labels[1] === "较差" || labels[1] === "很差" || labels[3] === "较差" || labels[3] === "很差") text += "   更换更高强度合金，优化篦板结构\n";
  } else {
    text += "   当前配置表现良好，建议保持工艺并定期监控\n";
  }
  const avg = (values[1] + values[3]) / 2;
  text += "\n经济性：\n";
  if (avg > 500) text += "   预计平均月产量 " + num(avg / 12, 1) + " 万吨，更换频率低\n";
  else if (avg > 200) text += "   运行成本适中\n";
  else text += "   更换频繁，运维成本较高\n";
  text += "\n维护建议：\n";
  text += labels.some((item) => item === "一般" || item === "较差") ? "   建议每月检查一次，重点关注高温端\n" : "   可按常规每季度检查一次\n";
  text += "\n总结：\n";
  if (overall >= 70) text += "   当前篦板配置性能优秀，建议继续使用。";
  else if (overall >= 50) text += "   当前篦板配置可以满足生产需求，部分环节仍可优化。";
  else text += "   当前篦板配置有待改进，建议重新评估材料和工艺。";
  return text;
}

function cell(row, key) {
  const value = row[key];
  if (value == null || value === "" || value === "—" || value === "-") return "";
  return String(value);
}

function kv(row, group, kind) {
  const keepEmpty = kind === "chem" || kind === "mech";
  const parts = group.map(([label, key, suffix]) => {
    const value = cell(row, key);
    if (!value && !keepEmpty) return "";
    const name = String(label).replace(/：$/, "").replace(/:$/, "");
    const wide = /外包|种类|工艺|冷却/.test(String(key));
    const shown = value ? value + (suffix || "") : "—";
    return `<span class="stat${wide ? " stat-wide" : ""}"><b>${esc(name)}</b><em>${esc(shown)}</em></span>`;
  }).filter(Boolean);
  if (!parts.length) return "";
  return `<div class="kv kv-${kind || "sheet"}">${parts.join("")}</div>`;
}


function renderMine() {
  app.innerHTML = shell("矿山原料性能查询", `<div class="stack">
    <form class="panel toolbar" id="form">
      <input class="grow" id="keyword" placeholder="请输入公司名称，支持模糊查询">
      <select id="company"></select>
      <button class="primary" type="submit">查询</button>
    </form>
    <div class="panel toolbar">
      <span>排序字段</span>
      <select id="sort-field">${MINE_SORT.map(([label]) => `<option>${esc(label)}</option>`).join("")}</select>
      <button class="ghost" type="button" id="sort-btn">从大到小排序</button>
      <span class="count" id="count"></span>
    </div>
    <div class="error" id="msg"></div>
    <div class="cards" id="cards"></div>
  </div>`);
  bindChrome();
  loadJson("data/mine.json").then((rows) => {
    mineRows = rows;
    const names = Array.from(new Set(rows.map((row) => cell(row, "公司名称")).filter(Boolean))).sort();
    document.querySelector("#company").innerHTML = `<option>请选择公司名称</option>` + names.map((name) => `<option>${esc(name)}</option>`).join("");
  }).catch((error) => {
    document.querySelector("#msg").textContent = error.message;
  });
  document.querySelector("#company").onchange = () => {
    const value = document.querySelector("#company").value;
    if (value !== "请选择公司名称") document.querySelector("#keyword").value = value;
  };
  document.querySelector("#keyword").oninput = () => {
    document.querySelector("#company").selectedIndex = 0;
  };
  document.querySelector("#form").onsubmit = (event) => {
    event.preventDefault();
    if (!mineRows) {
      document.querySelector("#msg").textContent = "数据仍在加载，请稍候";
      return;
    }
    const keyword = document.querySelector("#keyword").value.trim().toLowerCase();
    if (!keyword) {
      document.querySelector("#msg").textContent = "请输入公司名称";
      return;
    }
    document.querySelector("#msg").textContent = "";
    mineResult = mineRows.filter((row) => cell(row, "公司名称").toLowerCase().indexOf(keyword) >= 0);
    mineDescending = true;
    document.querySelector("#sort-btn").textContent = "从大到小排序";
    paintMine();
  };
  document.querySelector("#sort-btn").onclick = () => {
    if (!mineResult.length) {
      document.querySelector("#msg").textContent = "请先执行查询，再进行排序";
      return;
    }
    const label = document.querySelector("#sort-field").value;
    const column = MINE_SORT.filter((item) => item[0] === label)[0][1];
    mineResult = sortNumeric(mineResult, column, mineDescending);
    mineDescending = !mineDescending;
    document.querySelector("#sort-btn").textContent = mineDescending ? "从大到小排序" : "从小到大排序";
    paintMine();
  };
}

function paintMine() {
  document.querySelector("#count").textContent = mineResult.length ? "共 " + mineResult.length + " 条" : "未查询到匹配数据";
  const groups = [
    [["区域：", "区域"], ["种类：", "矿山种类"], ["设计规模：", "设计规模（万吨/年）", " 万吨/年"], ["实际产能：", "实际产能（万吨/年）", " 万吨/年"], ["估算产值：", "估算产值（万元）", " 万元"], ["外包：", "外包情况"]],
    [["Loss：", "Loss（%）", "%"], ["CaO：", "CaO（%）", "%"], ["MgO：", "MgO（%）", "%"], ["SiO₂：", "SiO₂（%）", "%"], ["Al₂O₃：", "Al₂O₃（%）", "%"], ["Fe₂O₃：", "Fe₂O₃（%）", "%"]],
    [["抗压强度：", "抗压强度（MPa）", " MPa"], ["磨蚀性：", "磨蚀性（g）", " g"], ["易磨性：", "易磨性（KWh/t）", " KWh/t"]]
  ];
  document.querySelector("#cards").innerHTML = mineResult.map((row) => {
    return `<article class="card record"><h3>${esc(cell(row, "矿山名称"))}</h3><p class="record-co">${esc(cell(row, "公司名称"))}</p>${groups.map((group, index) => kv(row, group, ["meta", "chem", "mech"][index])).join("")}</article>`;
  }).join("");
}

function sortNumeric(rows, column, descending) {
  return rows.slice().sort((a, b) => {
    const av = Number(a[column]);
    const bv = Number(b[column]);
    const aBad = !Number.isFinite(av);
    const bBad = !Number.isFinite(bv);
    if (aBad && bBad) return 0;
    if (aBad) return 1;
    if (bBad) return -1;
    return descending ? bv - av : av - bv;
  });
}

function renderWear() {
  app.innerHTML = shell("耐磨材料数据查询", `<div class="stack">
    <form class="panel toolbar" id="search-form">
      <input class="grow" id="keyword" placeholder="请输入材料牌号，支持模糊搜索">
      <button class="primary" type="submit">立即搜索</button>
    </form>
    <div class="panel toolbar">
      <select id="category"><option>请选择材料类别</option></select>
      <select id="grade"><option>请选择材料牌号</option></select>
      <button class="primary" type="button" id="filter">筛选</button>
      <button class="ghost" type="button" id="reset">重置</button>
      <select id="sort-field"><option>默认排序</option>${WEAR_SORT.map(([label]) => `<option>${esc(label)}</option>`).join("")}</select>
      <button class="ghost" type="button" id="sort-btn">排序</button>
      <span class="count" id="count"></span>
    </div>
    <div class="error" id="msg"></div>
    <div class="cards" id="cards"></div>
  </div>`);
  bindChrome();
  loadJson("data/wear.json").then((rows) => {
    wearRows = rows;
    wearResult = rows.slice();
    const categories = Array.from(new Set(rows.map((row) => cell(row, "类别")).filter(Boolean))).sort();
    document.querySelector("#category").innerHTML = `<option>请选择材料类别</option>` + categories.map((item) => `<option>${esc(item)}</option>`).join("");
    fillWearGrades();
    paintWear();
  }).catch((error) => {
    document.querySelector("#msg").textContent = error.message;
  });
  document.querySelector("#category").onchange = fillWearGrades;
  document.querySelector("#search-form").onsubmit = (event) => {
    event.preventDefault();
    const keyword = document.querySelector("#keyword").value.trim();
    if (!keyword) {
      document.querySelector("#msg").textContent = "请输入材料牌号搜索关键词";
      return;
    }
    document.querySelector("#msg").textContent = "";
    wearResult = wearRows.filter((row) => cell(row, "材料牌号").indexOf(keyword) >= 0);
    paintWear();
  };
  document.querySelector("#filter").onclick = () => {
    const category = document.querySelector("#category").value;
    const grade = document.querySelector("#grade").value;
    wearResult = wearRows.filter((row) => {
      if (category !== "请选择材料类别" && cell(row, "类别") !== category) return false;
      if (grade !== "请选择材料牌号" && cell(row, "材料牌号") !== grade) return false;
      return true;
    });
    document.querySelector("#msg").textContent = "";
    paintWear();
  };
  document.querySelector("#reset").onclick = () => {
    document.querySelector("#keyword").value = "";
    document.querySelector("#category").selectedIndex = 0;
    document.querySelector("#sort-field").selectedIndex = 0;
    fillWearGrades();
    wearResult = wearRows.slice();
    paintWear();
  };
  document.querySelector("#sort-btn").onclick = () => {
    const label = document.querySelector("#sort-field").value;
    if (label === "默认排序") wearResult = wearResult.slice();
    else {
      const column = WEAR_SORT.filter((item) => item[0] === label)[0][1];
      wearResult = sortNumeric(wearResult, column, wearDescending);
      wearDescending = !wearDescending;
    }
    paintWear();
  };
}

function fillWearGrades() {
  if (!wearRows) return;
  const category = document.querySelector("#category").value;
  const source = category === "请选择材料类别" ? wearRows : wearRows.filter((row) => cell(row, "类别") === category);
  const grades = Array.from(new Set(source.map((row) => cell(row, "材料牌号")).filter(Boolean))).sort();
  document.querySelector("#grade").innerHTML = `<option>请选择材料牌号</option>` + grades.map((item) => `<option>${esc(item)}</option>`).join("");
}

function paintWear() {
  document.querySelector("#count").textContent = "共找到 " + wearResult.length + " 条匹配数据";
  const groups = [
    ["基础信息", [["制备工艺：", "制备工艺"], ["制作成本：", "制作成本/元", " 元"]]],
    ["主要化学成分", [["C：", "C", "%"], ["Mn：", "Mn", "%"], ["Si：", "Si", "%"], ["P：", "P", "%"], ["S：", "S", "%"], ["Cr：", "Cr", "%"], ["Ni：", "Ni", "%"], ["Mo：", "Mo", "%"]]],
    ["热处理", [["温度：", "热处理温度/°C", "°C"], ["保温：", "保温时间/h", " h"], ["冷却：", "冷却方式"], ["时效温度：", "时效处理温度/°C", "°C"], ["时效保温：", "时效保温时间/h", " h"]]],
    ["硬度与冲击", [["HB：", "硬度/HB", " HB"], ["基体HRC：", "基体硬度/HRC", " HRC"], ["耐磨层HRC：", "耐磨层硬度/HRC", " HRC"], ["U口冲击：", "U口冲击值/J·cm⁻²", " J·cm⁻²"]]],
    ["力学性能", [["抗拉强度：", "抗拉强度/MPa", " MPa"], ["屈服强度：", "屈服强度/MPa", " MPa"], ["延伸率：", "延伸率", " %"], ["密度：", "密度/g.cm3", " g/cm³"]]],
    ["耐磨性能", [["磨损率：", "磨损率"], ["动摩擦因数：", "动摩擦因数/μ"], ["磨损质量：", "磨损质量/g", " g"]]]
  ];
  document.querySelector("#cards").innerHTML = wearResult.map((row, index) => {
    return `<article class="card record"><h3>${index + 1}. ${esc(cell(row, "材料牌号"))} 【${esc(cell(row, "类别"))}】</h3>${groups.map(([title, group]) => {
      const body = kv(row, group, "sheet");
      return body ? `<div class="block-title">${esc(title)}</div>${body}` : "";
    }).join("")}</article>`;
  }).join("");
}

/* platform.js boots the interface */

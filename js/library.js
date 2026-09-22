const K_SIO2 = "SiO\u2082\uff08%\uff09";
const K_AL = "Al\u2082O\u2083\uff08%\uff09";
const K_FE = "Fe\u2082O\u2083\uff08%\uff09";
const K_IMPACT = "U\u53e3\u51b2\u51fb\u503c/J\u00b7cm\u207b\u00b2";
let mineSearched = false;

function renderMine() {
  frame("mine", `<header class="page-head"><div><p class="kicker">数据中心</p><h1>矿山原料数据库</h1><p class="lede">按公司或矿山名称筛选。点开一行查看化学组成、机械性能，管理员可以把三项性能带入锤头预测。</p></div></header>
    <form class="panel toolbar" id="form"><input class="grow" id="keyword" placeholder="公司或矿山名称，留空显示全部"><select id="company"></select><button class="primary" type="submit">查询</button></form>
    <div class="panel toolbar"><span>排序字段</span><select id="sort-field">${MINE_SORT.map(([label]) => `<option>${esc(label)}</option>`).join("")}</select><button class="ghost" type="button" id="sort-btn">从大到小排序</button><span class="count" id="count"></span></div>
    <div class="error" id="msg"></div><div id="skel" class="skeleton"></div><div id="cards"></div><div id="drawer-root"></div>`);
  loadJson("data/mine.json").then((rows) => {
    mineRows = rows;
    const names = Array.from(new Set(rows.map((row) => cell(row, "公司名称")).filter(Boolean))).sort();
    const company = document.querySelector("#company");
    if (!company) return;
    company.innerHTML = `<option>请选择公司名称</option>` + names.map((name) => `<option>${esc(name)}</option>`).join("");
    mineResult = rows.slice();
    mineSearched = true;
    const skel = document.querySelector("#skel");
    if (skel) skel.remove();
    paintMine();
  }).catch((error) => {
    const msg = document.querySelector("#msg");
    if (msg) msg.textContent = error.message;
  });
  document.querySelector("#company").onchange = () => {
    const value = document.querySelector("#company").value;
    if (value !== "请选择公司名称") document.querySelector("#keyword").value = value;
  };
  document.querySelector("#form").onsubmit = (event) => {
    event.preventDefault();
    if (!mineRows) {
      document.querySelector("#msg").textContent = "数据仍在加载，请稍候";
      return;
    }
    const keyword = document.querySelector("#keyword").value.trim().toLowerCase();
    document.querySelector("#msg").textContent = "";
    mineResult = mineRows.filter((row) => {
      if (!keyword) return true;
      return (cell(row, "公司名称") + " " + cell(row, "矿山名称")).toLowerCase().indexOf(keyword) >= 0;
    });
    mineSearched = true;
    mineDescending = true;
    document.querySelector("#sort-btn").textContent = "从大到小排序";
    paintMine();
  };
  document.querySelector("#sort-btn").onclick = () => {
    if (!mineResult.length) return;
    const label = document.querySelector("#sort-field").value;
    const column = MINE_SORT.filter((item) => item[0] === label)[0][1];
    mineResult = sortNumeric(mineResult, column, mineDescending);
    mineDescending = !mineDescending;
    document.querySelector("#sort-btn").textContent = mineDescending ? "从大到小排序" : "从小到大排序";
    paintMine();
  };
}

function paintMine() {
  const count = document.querySelector("#count");
  const cards = document.querySelector("#cards");
  if (!count || !cards) return;
  count.textContent = "共 " + mineResult.length + " 条";
  if (!mineResult.length) {
    cards.innerHTML = `<div class="empty">暂未找到符合条件的数据。尝试调整筛选条件。</div>`;
    return;
  }
  const body = mineResult.map((row, index) => `<tr class="clickable" data-idx="${index}"><td>${esc(cell(row, "矿山名称"))}</td><td>${esc(cell(row, "公司名称"))}</td><td>${esc(cell(row, "区域"))}</td><td>${esc(cell(row, "CaO\uff08%\uff09"))}</td><td>${esc(cell(row, K_SIO2))}</td><td>${esc(cell(row, "抗压强度\uff08MPa\uff09"))}</td><td>${esc(cell(row, "磨蚀性\uff08g\uff09"))}</td><td>${esc(cell(row, "易磨性\uff08KWh/t\uff09"))}</td></tr>`).join("");
  cards.innerHTML = `<div class="table-wrap"><table><thead><tr><th>矿山名称</th><th>公司</th><th>区域</th><th>CaO%</th><th>SiO2%</th><th>抗压强度</th><th>磨蚀性</th><th>易磨性</th></tr></thead><tbody>${body}</tbody></table></div>`;
  cards.querySelectorAll("[data-idx]").forEach((tr) => {
    tr.onclick = () => openMine(mineResult[Number(tr.dataset.idx)]);
  });
}

function openMine(row) {
  const root = document.querySelector("#drawer-root");
  if (!root) return;
  const chem = [["CaO", "CaO\uff08%\uff09"], ["MgO", "MgO\uff08%\uff09"], ["SiO2", K_SIO2], ["Al2O3", K_AL], ["Fe2O3", K_FE], ["Loss", "Loss\uff08%\uff09"]];
  const barsHtml = chem.map(([label, key]) => {
    const value = Number(cell(row, key));
    const width = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    return `<div class="bar-row"><span>${label}</span><div class="track"><i style="width:${width.toFixed(1)}%"></i></div><b>${esc(cell(row, key) || "—")}</b></div>`;
  }).join("");
  const groups = [
    [["区域：", "区域"], ["种类：", "矿山种类"], ["设计规模：", "设计规模\uff08万吨/年\uff09", " 万吨/年"], ["实际产能：", "实际产能\uff08万吨/年\uff09", " 万吨/年"], ["估算产值：", "估算产值\uff08万元\uff09", " 万元"], ["外包：", "外包情况"]],
    [["Loss：", "Loss\uff08%\uff09", "%"], ["CaO：", "CaO\uff08%\uff09", "%"], ["MgO：", "MgO\uff08%\uff09", "%"], ["SiO₂：", K_SIO2, "%"], ["Al₂O₃：", K_AL, "%"], ["Fe₂O₃：", K_FE, "%"]],
    [["抗压强度：", "抗压强度\uff08MPa\uff09", " MPa"], ["磨蚀性：", "磨蚀性\uff08g\uff09", " g"], ["易磨性：", "易磨性\uff08KWh/t\uff09", " KWh/t"]]
  ];
  const strength = cell(row, "抗压强度\uff08MPa\uff09");
  const abrasion = cell(row, "磨蚀性\uff08g\uff09");
  const grind = cell(row, "易磨性\uff08KWh/t\uff09");
  const canUse = admin() && strength && abrasion && grind;
  root.innerHTML = `<div class="drawer-back"></div><aside class="drawer"><button class="ghost" type="button" id="close-drawer">关闭</button><h2 style="margin:12px 0">${esc(cell(row, "矿山名称"))}</h2><p class="muted">${esc(cell(row, "公司名称"))}</p><div class="block-title">矿山画像</div>${kv(row, groups[0], "meta")}<div class="block-title">矿石化学组成</div>${barsHtml}${kv(row, groups[1], "chem")}<div class="block-title">机械性能</div>${kv(row, groups[2], "mech")}<p class="muted">锤头预测只使用抗压强度、磨蚀性和易磨性。同一矿山可以有多条化验。</p>${canUse ? `<button class="primary" type="button" id="use-ore" style="margin-top:12px">用这三项预测锤头</button>` : ""}</aside>`;
  const close = () => { root.innerHTML = ""; };
  root.querySelector(".drawer-back").onclick = close;
  root.querySelector("#close-drawer").onclick = close;
  const use = root.querySelector("#use-ore");
  if (use) use.onclick = () => go("hammer", { strength, abrasion, grind });
}

function bandPass(value, band, low, high) {
  const number = Number(value);
  if (band === "all") return true;
  if (!Number.isFinite(number)) return false;
  if (band === "lo") return number < low;
  if (band === "mid") return number >= low && number < high;
  return number >= high;
}

function renderWear() {
  frame("wear", `<header class="page-head"><div><p class="kicker">数据中心</p><h1>耐磨材料数据库</h1><p class="lede">用牌号、类别、硬度和成本筛选。点开一行查看成分、热处理和性能。</p></div></header>
    <form class="panel toolbar" id="search-form"><input class="grow" id="keyword" placeholder="材料牌号，支持模糊搜索"><select id="category"><option>请选择材料类别</option></select><select id="grade"><option>请选择材料牌号</option></select><select id="hard-band"><option value="all">硬度不限</option><option value="lo">硬度 &lt; 400</option><option value="mid">硬度 400-500</option><option value="hi">硬度 ≥ 500</option></select><select id="cost-band"><option value="all">成本不限</option><option value="lo">成本 &lt; 5000</option><option value="mid">成本 5000-8000</option><option value="hi">成本 ≥ 8000</option></select><button class="primary" type="submit">筛选</button><button class="ghost" type="button" id="reset">重置</button></form>
    <div class="panel toolbar"><select id="sort-field"><option>默认排序</option>${WEAR_SORT.map(([label]) => `<option>${esc(label)}</option>`).join("")}</select><button class="ghost" type="button" id="sort-btn">排序</button><span class="count" id="count"></span></div>
    <div class="error" id="msg"></div><div id="skel" class="skeleton"></div><div id="cards"></div><div id="drawer-root"></div>`);
  loadJson("data/wear.json").then((rows) => {
    wearRows = rows;
    wearResult = rows.slice();
    const categories = Array.from(new Set(rows.map((row) => cell(row, "类别")).filter(Boolean))).sort();
    const category = document.querySelector("#category");
    if (!category) return;
    category.innerHTML = `<option>请选择材料类别</option>` + categories.map((item) => `<option>${esc(item)}</option>`).join("");
    fillWearGrades();
    const skel = document.querySelector("#skel");
    if (skel) skel.remove();
    paintWear();
  }).catch((error) => {
    const msg = document.querySelector("#msg");
    if (msg) msg.textContent = error.message;
  });
  document.querySelector("#category").onchange = fillWearGrades;
  document.querySelector("#search-form").onsubmit = (event) => {
    event.preventDefault();
    applyWear();
  };
  document.querySelector("#reset").onclick = () => {
    document.querySelector("#keyword").value = "";
    document.querySelector("#category").selectedIndex = 0;
    document.querySelector("#hard-band").value = "all";
    document.querySelector("#cost-band").value = "all";
    document.querySelector("#sort-field").selectedIndex = 0;
    fillWearGrades();
    wearResult = wearRows.slice();
    paintWear();
  };
  document.querySelector("#sort-btn").onclick = () => {
    const label = document.querySelector("#sort-field").value;
    if (label === "默认排序") return;
    const column = WEAR_SORT.filter((item) => item[0] === label)[0][1];
    wearResult = sortNumeric(wearResult, column, wearDescending);
    wearDescending = !wearDescending;
    paintWear();
  };
}

function applyWear() {
  if (!wearRows) return;
  const keyword = document.querySelector("#keyword").value.trim();
  const category = document.querySelector("#category").value;
  const grade = document.querySelector("#grade").value;
  const hard = document.querySelector("#hard-band").value;
  const cost = document.querySelector("#cost-band").value;
  wearResult = wearRows.filter((row) => {
    if (keyword && cell(row, "材料牌号").indexOf(keyword) < 0) return false;
    if (category !== "请选择材料类别" && cell(row, "类别") !== category) return false;
    if (grade !== "请选择材料牌号" && cell(row, "材料牌号") !== grade) return false;
    if (!bandPass(row["硬度/HB"], hard, 400, 500)) return false;
    if (!bandPass(row["制作成本/元"], cost, 5000, 8000)) return false;
    return true;
  });
  document.querySelector("#msg").textContent = "";
  paintWear();
}

function paintWear() {
  const count = document.querySelector("#count");
  const cards = document.querySelector("#cards");
  if (!count || !cards) return;
  count.textContent = "共 " + wearResult.length + " 条";
  if (!wearResult.length) {
    cards.innerHTML = `<div class="empty">暂未找到符合条件的数据。尝试调整筛选条件。</div>`;
    return;
  }
  const body = wearResult.map((row, index) => `<tr class="clickable" data-idx="${index}"><td>${esc(cell(row, "材料牌号"))}</td><td>${esc(cell(row, "类别"))}</td><td>${esc(cell(row, "硬度/HB"))}</td><td>${esc(cell(row, "抗拉强度/MPa"))}</td><td>${esc(cell(row, "磨损率"))}</td><td>${esc(cell(row, "制作成本/元"))}</td></tr>`).join("");
  cards.innerHTML = `<div class="table-wrap"><table><thead><tr><th>材料牌号</th><th>类别</th><th>硬度/HB</th><th>抗拉强度</th><th>磨损率</th><th>成本</th></tr></thead><tbody>${body}</tbody></table></div>`;
  cards.querySelectorAll("[data-idx]").forEach((tr) => {
    tr.onclick = () => openWear(wearResult[Number(tr.dataset.idx)]);
  });
}

function openWear(row) {
  const root = document.querySelector("#drawer-root");
  if (!root) return;
  const groups = [
    ["基础信息", [["制备工艺：", "制备工艺"], ["制作成本：", "制作成本/元", " 元"]]],
    ["主要化学成分", [["C：", "C", "%"], ["Mn：", "Mn", "%"], ["Si：", "Si", "%"], ["P：", "P", "%"], ["S：", "S", "%"], ["Cr：", "Cr", "%"], ["Ni：", "Ni", "%"], ["Mo：", "Mo", "%"]]],
    ["热处理", [["温度：", "热处理温度/°C", "°C"], ["保温：", "保温时间/h", " h"], ["冷却：", "冷却方式"], ["时效温度：", "时效处理温度/°C", "°C"], ["时效保温：", "时效保温时间/h", " h"]]],
    ["硬度与冲击", [["HB：", "硬度/HB", " HB"], ["基体HRC：", "基体硬度/HRC", " HRC"], ["耐磨层HRC：", "耐磨层硬度/HRC", " HRC"], ["U口冲击：", K_IMPACT, " J·cm⁻²"]]],
    ["力学性能", [["抗拉强度：", "抗拉强度/MPa", " MPa"], ["屈服强度：", "屈服强度/MPa", " MPa"], ["延伸率：", "延伸率", " %"], ["密度：", "密度/g.cm3", " g/cm³"]]],
    ["耐磨性能", [["磨损率：", "磨损率"], ["动摩擦因数：", "动摩擦因数/μ"], ["磨损质量：", "磨损质量/g", " g"]]]
  ];
  root.innerHTML = `<div class="drawer-back"></div><aside class="drawer"><button class="ghost" type="button" id="close-drawer">关闭</button><h2 style="margin:12px 0">${esc(cell(row, "材料牌号"))}</h2><p class="muted">${esc(cell(row, "类别"))}</p>${groups.map(([title, group]) => { const body = kv(row, group, "sheet"); return body ? `<div class="block-title">${esc(title)}</div>${body}` : ""; }).join("")}</aside>`;
  const close = () => { root.innerHTML = ""; };
  root.querySelector(".drawer-back").onclick = close;
  root.querySelector("#close-drawer").onclick = close;
}

function renderModels() {
  const rows = [
    ["锤头产量", "hammer.json", "产量（万吨）", "抗压强度 0-1000 MPa；磨蚀性 0-100 g；易磨性 0-50 KWh/t"],
    ["辊套磨耗", "roller_consumption.json", "kg/万吨", "同上，另加规格型号"],
    ["辊套产量", "roller_production.json", "万吨", "同上"],
    ["辊套磨损", "roller_wear.json", "kg", "同上"],
    ["磨盘磨耗", "disc_consumption.json", "kg/万吨", "同上，规格含莱歇 5.6M"],
    ["磨盘产量", "disc_production.json", "万吨", "同上"],
    ["磨盘磨损", "disc_wear.json", "kg", "同上"],
    ["篦板高温周期", "grid_cycle1.json", "天", "磨蚀性 0-10 g；小磨 0-100 分钟；硬度 0-1000 HB；面积 0-1000 m²"],
    ["篦板高温产量", "grid_prod1.json", "万吨", "同上"],
    ["篦板低温周期", "grid_cycle2.json", "天", "同上"],
    ["篦板低温产量", "grid_prod2.json", "万吨", "同上"]
  ];
  frame("models", `<header class="page-head"><div><p class="kicker">模型中心</p><h1>模型说明</h1><p class="lede">这些文件从原桌面预测软件导出。页面只说明文件、输出和建议输入范围，不填写没有随文件提供的 R²、MAE 或样本数。</p></div></header>
    <div class="table-wrap"><table><thead><tr><th>名称</th><th>文件</th><th>输出</th><th>建议输入范围</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${esc(row[0])}</td><td>${esc(row[1])}</td><td>${esc(row[2])}</td><td>${esc(row[3])}</td></tr>`).join("")}</tbody></table></div>
    <section class="card" style="margin-top:16px"><h2>使用边界</h2><p>算法是 XGBoost。预测在浏览器内完成，输入不会上传。登录状态只保存在本机会话里。公开页面没有后端账号、权限审计或操作日志。正式承载企业数据时，需要单独的认证和接口，而不是把口令放在前端脚本中。</p><p class="muted" style="margin-top:8px">输入超出建议范围时，页面会提示，并仍然给出预测。</p></section>`);
}

function runStamp(item) {
  const date = new Date(item.at);
  const pad = (value) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

function renderHistory() {
  const list = storeGet("jidong-history");
  frame("history", `<header class="page-head"><div><p class="kicker">历史记录</p><h1>本机预测记录</h1><p class="lede">记录保存在这台浏览器里，最多 30 条。换电脑或清除站点数据后不会保留。</p></div></header>
    <section class="card">${list.length ? list.map((item) => `<article class="history-item"><div><b>${esc(runStamp(item))} · ${esc(item.moduleName)}</b><p>${esc(item.spec)}</p><p>${esc(item.summary)}</p></div><div class="row-actions"><button class="ghost" type="button" data-act="open" data-id="${item.id}">查看</button><button class="ghost" type="button" data-act="copy" data-id="${item.id}">复制方案</button><button class="ghost" type="button" data-act="pin" data-id="${item.id}">方案对比</button><button class="ghost" type="button" data-act="report" data-id="${item.id}">生成报告</button></div></article>`).join("") : `<div class="empty">还没有预测记录。完成一次预测后会出现在这里。</div>`}</section>`);
  document.querySelectorAll("[data-act]").forEach((button) => {
    button.onclick = () => {
      const item = storeGet("jidong-history").filter((row) => String(row.id) === button.dataset.id)[0];
      if (!item) return;
      if (button.dataset.act === "open" || button.dataset.act === "copy") go(item.module, item.inputs);
      if (button.dataset.act === "pin") {
        const compare = storeGet("jidong-compare");
        compare.unshift(item);
        storeSet("jidong-compare", compare.slice(0, 8));
        go("compare");
      }
      if (button.dataset.act === "report") {
        sessionStorage.setItem("jidong-report", String(item.id));
        go("report");
      }
    };
  });
}

function renderCompare() {
  const list = storeGet("jidong-compare");
  const groups = {};
  list.forEach((item) => {
    if (!groups[item.module]) groups[item.module] = [];
    groups[item.module].push(item);
  });
  const tables = Object.keys(groups).map((key) => {
    const items = groups[key];
    const labels = [];
    items.forEach((item) => item.metrics.forEach((metric) => {
      if (labels.indexOf(metric.label) < 0) labels.push(metric.label);
    }));
    const head = items.map((item) => `<th>${esc(item.spec)}</th>`).join("");
    const body = labels.map((label) => {
      const cells = items.map((item) => {
        const found = item.metrics.filter((metric) => metric.label === label)[0];
        return `<td>${found ? esc(found.value + " " + found.unit) : "—"}</td>`;
      }).join("");
      return `<tr><th>${esc(label)}</th>${cells}</tr>`;
    }).join("");
    return `<section class="card" style="margin-bottom:16px"><h2>${esc(items[0].moduleName)}</h2><div class="table-wrap"><table><thead><tr><th>指标</th>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
  }).join("");
  frame("compare", `<header class="page-head"><div><p class="kicker">方案对比</p><h1>已保存的预测方案</h1><p class="lede">数字来自各次实际预测。在预测结果或历史记录里加入对比，最多保留 8 条。</p></div><button class="ghost no-print" type="button" id="clear-compare">清空对比</button></header>${list.length ? tables : `<div class="empty">还没有对比方案。预测完成后点击「加入方案对比」。</div>`}`);
  const clear = document.querySelector("#clear-compare");
  if (clear) clear.onclick = () => { storeSet("jidong-compare", []); renderCompare(); };
}

function renderReport() {
  const id = sessionStorage.getItem("jidong-report");
  const list = storeGet("jidong-history");
  const item = list.filter((row) => String(row.id) === String(id))[0] || list[0];
  if (!item) {
    frame("report", `<header class="page-head"><div><p class="kicker">决策报告</p><h1>还没有可生成的报告</h1><p class="lede">先完成一次预测，再从结果页或历史记录生成报告。</p></div></header>`);
    return;
  }
  const inputs = Object.keys(item.inputs || {}).map((key) => `<tr><th>${esc(key)}</th><td>${esc(item.inputs[key])}</td></tr>`).join("");
  const metrics = item.metrics.map((metric) => `<tr><th>${esc(metric.label)}</th><td>${esc(metric.value)}</td><td>${esc(metric.unit)}</td></tr>`).join("");
  frame("report", `<header class="page-head"><div><p class="kicker">决策报告</p><h1>${esc(item.moduleName)}智能预测报告</h1><p class="lede">${esc(item.spec)} · ${esc(runStamp(item))}</p></div><div class="row-actions no-print"><button class="primary" type="button" id="print-report" style="width:auto">打印</button><button class="ghost" type="button" id="save-report">导出文本</button></div></header>
    <section class="card"><h2>输入参数</h2><div class="table-wrap"><table>${inputs}</table></div><h2 style="margin-top:16px">预测结果</h2><div class="table-wrap"><table><thead><tr><th>指标</th><th>数值</th><th>单位</th></tr></thead><tbody>${metrics}</tbody></table></div><h2 style="margin-top:16px">模型</h2><p>${esc(item.model)} · XGBoost · 与原桌面软件同一套文件。本报告不附带未提供的精度统计。</p><h2 style="margin-top:16px">分析</h2>${adviceCards(item.advice || "")}</section>`);
  document.querySelector("#print-report").onclick = () => window.print();
  document.querySelector("#save-report").onclick = () => {
    const lines = [item.moduleName + "智能预测报告", item.spec, runStamp(item), "", "输入"];
    Object.keys(item.inputs || {}).forEach((key) => lines.push(key + ": " + item.inputs[key]));
    lines.push("", "结果");
    item.metrics.forEach((metric) => lines.push(metric.label + ": " + metric.value + " " + metric.unit));
    lines.push("", item.advice || "");
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "jidong-report.txt";
    link.click();
  };
}

PAGES.mine = renderMine;
PAGES.wear = renderWear;
PAGES.models = renderModels;
PAGES.history = renderHistory;
PAGES.compare = renderCompare;
PAGES.report = renderReport;

window.addEventListener("hashchange", onHash);
if (role()) onHash();
else renderLogin();

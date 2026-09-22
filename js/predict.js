const NUM_FIELDS = [
  { index: 0, label: "抗压强度" },
  { index: 1, label: "磨蚀性" },
  { index: 2, label: "易磨性" }
];

function gradeTable(sorted, current, maxP, maxE) {
  const rows = sorted.map((item) => {
    const mark = item.grade === current.grade ? " class=\"mark\"" : "";
    return `<tr${mark}><td>${esc(item.grade)}</td><td>${num(item.prediction, 2)}</td><td>${num(item.efficiency, 2)}</td><td>${num(item.cost, 2)}</td><td>${num(scoreOf(item, maxP, maxE) * 100, 1)}</td></tr>`;
  }).join("");
  return `<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>牌号</th><th>产量</th><th>效益</th><th>成本</th><th>综合</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderHammer() {
  const preset = takePreset();
  frame("hammer", pageHead("预测中心", "锤头智能产量预测", "基于矿石特性、设备型号和耐磨材料牌号的机器学习预测。综合分按产量 60% 与效益 40%，相对同一工况下 12 个牌号的最大值。", "hammer.json") + stepsHtml() + `<div class="work"><form class="panel" id="form"><h2>01 参数输入</h2><fieldset><legend>矿石特性</legend>${numField("strength", "抗压强度（MPa）", "250")}${numField("abrasion", "磨蚀性（g）", "15.5")}${numField("grind", "易磨性（KWh/t）", "12.8")}</fieldset><fieldset><legend>设备参数</legend>${selectField("model", "型号", MODELS)}</fieldset><fieldset><legend>材料方案</legend>${selectField("supplier", "供货单位", SUPPLIERS)}${selectField("grade", "牌号", GRADES)}<p class="muted" id="cost-now"></p></fieldset><button class="primary" id="go" type="submit">开始智能预测</button><p class="muted" style="margin-top:12px">建议范围：抗压强度 0-1000 MPa，磨蚀性 0-100 g，易磨性 0-50 KWh/t。超出仍会计算。</p></form><div>${resultShell(metric("k-prod", "预计产量（万吨）") + metric("k-eff", "成本效益（吨/元）") + metric("k-cost", "材料成本（元）") + metric("k-score", "相对综合分"))}</div></div>`);
  const grade = document.querySelector("#grade");
  const showCost = () => {
    const cost = GRADE_COSTS[grade.value];
    document.querySelector("#cost-now").textContent = cost == null ? "" : "当前牌号成本: " + cost.toFixed(2) + " 元";
  };
  grade.onchange = showCost;
  applyPreset(preset);
  showCost();
  document.querySelector("#form").onsubmit = async (event) => {
    event.preventDefault();
    const button = document.querySelector("#go");
    button.disabled = true;
    const job = (async () => {
      const strength = readNumber("#strength", 250);
      const abrasion = readNumber("#abrasion", 15.5);
      const grind = readNumber("#grind", 12.8);
      const notes = [];
      if (strength <= 0 || strength > 1000) notes.push("抗压强度建议范围：0-1000 MPa");
      if (abrasion < 0 || abrasion > 100) notes.push("磨蚀性建议范围：0-100 g");
      if (grind < 0 || grind > 50) notes.push("易磨性建议范围：0-50 KWh/t");
      showRange(notes);
      const model = await loadModel("hammer");
      const selected = {
        model: document.querySelector("#model").value,
        supplier: document.querySelector("#supplier").value,
        grade: grade.value
      };
      const row = encode([strength, abrasion, grind], [
        { options: MODELS, selected: selected.model },
        { options: SUPPLIERS, selected: selected.supplier },
        { options: GRADES, selected: selected.grade }
      ]);
      const all = GRADES.map((item) => {
        const itemRow = encode([strength, abrasion, grind], [
          { options: MODELS, selected: selected.model },
          { options: SUPPLIERS, selected: selected.supplier },
          { options: GRADES, selected: item }
        ]);
        const prediction = predictXgb(model, itemRow);
        const cost = GRADE_COSTS[item] || 1;
        return { grade: item, prediction, cost, efficiency: prediction * 10000 / cost };
      });
      return {
        model, row,
        current: all.find((item) => item.grade === selected.grade),
        all,
        meta: {
          spec: selected.model + " · " + selected.grade,
          inputs: { strength: String(strength), abrasion: String(abrasion), grind: String(grind), model: selected.model, supplier: selected.supplier, grade: selected.grade }
        }
      };
    })();
    try {
      await Promise.all([runStages(), job]);
      const data = await job;
      showHammer(data.current, data.all, data.meta);
      const explain = document.querySelector("#explain");
      if (explain) explain.innerHTML = sensitivityHtml([data.model], data.row, NUM_FIELDS, [data.current.prediction], ["产量"]);
    } catch (error) {
      const wait = document.querySelector("#wait");
      if (wait) {
        wait.hidden = false;
        wait.textContent = "预测失败：" + error.message;
      }
    } finally {
      if (button) button.disabled = false;
    }
  };
}

function showHammer(current, all, meta) {
  const byProd = all.slice().sort((a, b) => b.prediction - a.prediction);
  const byEff = all.slice().sort((a, b) => b.efficiency - a.efficiency);
  const prodRank = byProd.findIndex((item) => item.grade === current.grade) + 1;
  const effRank = byEff.findIndex((item) => item.grade === current.grade) + 1;
  const total = all.length;
  const maxP = Math.max.apply(null, all.map((item) => item.prediction));
  const maxE = Math.max.apply(null, all.map((item) => item.efficiency));
  const composite = (maxP > 0 ? current.prediction / maxP : 0) * 0.6 + (maxE > 0 ? current.efficiency / maxE : 0) * 0.4;
  let level = "一般";
  if (composite >= 0.85) level = "卓越";
  else if (composite >= 0.7) level = "优秀";
  else if (composite >= 0.55) level = "良好";
  let effLabel = "一般";
  if (effRank <= 3) effLabel = "优秀";
  else if (effRank <= HALF(total)) effLabel = "良好";
  const advice = hammerAdvice(current, all, prodRank, effRank);
  document.querySelector("#k-prod").textContent = num(current.prediction, 2);
  document.querySelector("#k-prod-note").textContent = "产量排名：第 " + prodRank + " 名";
  const effNode = document.querySelector("#k-eff");
  effNode.textContent = num(current.efficiency, 4);
  effNode.className = tone(effLabel);
  document.querySelector("#k-eff-note").textContent = "效益评级: " + effLabel + " (第" + effRank + "名)";
  document.querySelector("#k-cost").textContent = num(current.cost, 2);
  document.querySelector("#k-cost-note").textContent = "元";
  const scoreNode = document.querySelector("#k-score");
  scoreNode.textContent = num(composite * 100, 1);
  scoreNode.className = tone(level);
  document.querySelector("#k-score-note").textContent = level + " · 相对 12 个牌号";
  document.querySelector("#bars").innerHTML = bars([
    { label: "当前产量", value: current.prediction, text: num(current.prediction, 2) },
    { label: "牌号中位", value: median(all.map((item) => item.prediction)), text: num(median(all.map((item) => item.prediction)), 2) },
    { label: "最高产量", value: maxP, text: num(maxP, 2) }
  ]);
  const costs = all.map((item) => item.cost);
  const minC = Math.min.apply(null, costs);
  const maxC = Math.max.apply(null, costs);
  const costScore = maxC === minC ? 100 : (maxC - current.cost) / (maxC - minC) * 100;
  document.querySelector("#radar").innerHTML = radar([
    { label: "产量", value: maxP > 0 ? current.prediction / maxP * 100 : 0 },
    { label: "效益", value: maxE > 0 ? current.efficiency / maxE * 100 : 0 },
    { label: "成本优势", value: costScore }
  ]);
  const sorted = all.slice().sort((a, b) => scoreOf(b, maxP, maxE) - scoreOf(a, maxP, maxE));
  document.querySelector("#extra").innerHTML = `<h2>成本-产量</h2><div class="scatter-wrap">${scatter(all.map((item) => ({ x: item.cost, y: item.prediction, current: item.grade === current.grade, name: item.grade })))}</div><p class="muted">横轴是材料成本（元），纵轴是预测产量（万吨）。蓝点是当前牌号。</p>${gradeTable(sorted, current, maxP, maxE)}`;
  document.querySelector("#advice").innerHTML = `<h2>AI 决策建议</h2>${adviceCards(advice)}`;
  const changeTo = pickLine(advice, "建议更换为：");
  document.querySelector("#gain").innerHTML = changeTo
    ? `<span>替换建议</span><strong>${esc(changeTo)}</strong><span>产量 ${esc(pickLine(advice, "预计产量变化："))}</span><span>效益 ${esc(pickLine(advice, "预计效益变化："))}</span>`
    : `<span>替换建议</span><strong>当前牌号无需更换</strong>`;
  remember({
    id: Date.now(),
    at: new Date().toISOString(),
    module: "hammer",
    moduleName: "锤头",
    spec: meta.spec,
    summary: "产量 " + num(current.prediction, 2) + " 万吨",
    inputs: meta.inputs,
    metrics: [
      { label: "预计产量", value: num(current.prediction, 2), unit: "万吨" },
      { label: "成本效益", value: num(current.efficiency, 4), unit: "吨/元" },
      { label: "材料成本", value: num(current.cost, 2), unit: "元" },
      { label: "相对综合分", value: num(composite * 100, 1), unit: level }
    ],
    advice, model: "hammer.json"
  });
  finishRun();
}

function renderParts(kind) {
  const preset = takePreset();
  const isDisc = kind === "disc";
  const title = isDisc ? "磨盘智能寿命预测" : "辊套智能性能预测";
  const types = isDisc ? DISC_TYPES : ROLLER_TYPES;
  const file = isDisc ? "disc_consumption / production / wear" : "roller_consumption / production / wear";
  frame(kind, pageHead("预测中心", title, "预测磨耗、更换产量和磨损量。综合评分沿用原规则：更换产量 0.5、磨耗 0.3、磨损量 0.2。", file) + stepsHtml() + `<div class="work"><form class="panel" id="form"><h2>01 参数输入</h2><fieldset><legend>矿石特性</legend>${numField("strength", "抗压强度（MPa）", "120")}${numField("abrasion", "磨蚀性（g）", "0.05")}${numField("grind", "易磨性（KWh/t）", "11.8")}</fieldset><fieldset><legend>设备参数</legend>${selectField("type", "规格型号", types)}</fieldset><button class="primary" id="go" type="submit">开始智能预测</button><p class="muted" style="margin-top:12px">建议范围：抗压强度 0-1000 MPa，磨蚀性 0-100 g，易磨性 0-50 KWh/t。</p></form><div>${resultShell(metric("k1", "磨耗（kg/万吨）") + metric("k2", "更换产量（万吨）") + metric("k3", "磨损量（kg）") + metric("k4", "综合评分"))}</div></div>`);
  applyPreset(preset);
  document.querySelector("#form").onsubmit = async (event) => {
    event.preventDefault();
    const button = document.querySelector("#go");
    button.disabled = true;
    const job = (async () => {
      const strength = readNumber("#strength", 120);
      const abrasion = readNumber("#abrasion", 0.05);
      const grind = readNumber("#grind", 11.8);
      const notes = [];
      if (strength <= 0 || strength > 1000) notes.push("抗压强度建议范围：0-1000 MPa");
      if (abrasion < 0 || abrasion > 100) notes.push("磨蚀性建议范围：0-100 g");
      if (grind < 0 || grind > 50) notes.push("易磨性建议范围：0-50 KWh/t");
      showRange(notes);
      const names = isDisc ? ["disc_consumption", "disc_production", "disc_wear"] : ["roller_consumption", "roller_production", "roller_wear"];
      const models = await Promise.all(names.map(loadModel));
      const type = document.querySelector("#type").value;
      const row = encode([strength, abrasion, grind], [{ options: types, selected: type }]);
      return {
        models, row,
        values: models.map((model) => predictXgb(model, row)),
        meta: {
          spec: type,
          inputs: { strength: String(strength), abrasion: String(abrasion), grind: String(grind), type }
        }
      };
    })();
    try {
      await Promise.all([runStages(), job]);
      const data = await job;
      paintParts(isDisc ? "磨盘" : "辊套", data.values, data.meta, isDisc);
      const explain = document.querySelector("#explain");
      if (explain) explain.innerHTML = sensitivityHtml(data.models, data.row, NUM_FIELDS, data.values, ["磨耗", "产量", "磨损"]);
    } catch (error) {
      const wait = document.querySelector("#wait");
      if (wait) {
        wait.hidden = false;
        wait.textContent = "预测失败：" + error.message;
      }
    } finally {
      if (button) button.disabled = false;
    }
  };
}

function paintParts(name, values, meta, isDisc) {
  const ratings = [consumptionRating(values[0]), productionRating(values[1]), wearAmountRating(values[2])];
  const digits = [3, 2, 1];
  [0, 1, 2].forEach((index) => {
    const node = document.querySelector("#k" + (index + 1));
    node.textContent = num(values[index], digits[index]);
    node.className = tone(ratings[index][0]);
    document.querySelector("#k" + (index + 1) + "-note").textContent = "评级: " + ratings[index][0];
  });
  const advice = partsAdvice(name, values, ratings.map((item) => item[0]));
  const overallLine = pickLine(advice, "综合表现：");
  document.querySelector("#k4").textContent = overallLine.replace(/^[^\d]*/, "").split("/")[0] || "—";
  document.querySelector("#k4-note").textContent = overallLine.split("(")[0].trim();
  const prodScore = values[1] > 0 ? Math.min(100, values[1]) : 0;
  const consScore = values[0] > 0 ? Math.max(0, Math.min(100, 0.2 / values[0] * 100)) : 0;
  const wearScore = values[2] > 0 ? Math.max(0, Math.min(100, 600 / values[2] * 100)) : 0;
  document.querySelector("#bars").innerHTML = bars([
    { label: "更换产量", value: prodScore, text: num(values[1], 2) },
    { label: "磨耗控制", value: consScore, text: num(values[0], 3) },
    { label: "磨损控制", value: wearScore, text: num(values[2], 1) }
  ]);
  document.querySelector("#radar").innerHTML = radar([
    { label: "产量", value: prodScore },
    { label: "磨耗", value: consScore },
    { label: "磨损", value: wearScore }
  ]);
  document.querySelector("#extra").innerHTML = `<h2>分项评级</h2><div class="status-list"><div><span>磨耗</span><b>${esc(ratings[0][0])}</b></div><div><span>更换产量</span><b>${esc(ratings[1][0])}</b></div><div><span>磨损量</span><b>${esc(ratings[2][0])}</b></div></div>`;
  document.querySelector("#advice").innerHTML = `<h2>AI 决策建议</h2>${adviceCards(advice)}`;
  document.querySelector("#gain").innerHTML = `<span>综合评价</span><strong>${esc(overallLine || name)}</strong>`;
  remember({
    id: Date.now(),
    at: new Date().toISOString(),
    module: isDisc ? "disc" : "roller",
    moduleName: name,
    spec: meta.spec,
    summary: "磨耗 " + num(values[0], 3) + " kg/万吨",
    inputs: meta.inputs,
    metrics: [
      { label: "磨耗", value: num(values[0], 3), unit: "kg/万吨" },
      { label: "更换产量", value: num(values[1], 2), unit: "万吨" },
      { label: "磨损量", value: num(values[2], 1), unit: "kg" }
    ],
    advice, model: (isDisc ? "disc" : "roller") + "_*.json"
  });
  finishRun();
}

function renderGrid() {
  const preset = takePreset();
  frame("grid", pageHead("预测中心", "篦板智能周期预测", "预测高、低温端的更换周期和更换产量。综合评分沿用原规则，四项权重各 0.25。", "grid_cycle1 / prod1 / cycle2 / prod2") + stepsHtml() + `<div class="work"><form class="panel" id="form"><h2>01 参数输入</h2><fieldset><legend>工况参数</legend>${numField("abrasion", "磨蚀性（g）", "0.109")}${numField("time", "小磨实验时间（分钟）", "31")}${numField("hard", "硬度（HB）", "525")}${numField("area", "篦冷机面积（m²）", "286")}</fieldset><fieldset><legend>设备与材料</legend>${selectField("type", "规格型号", GRID_TYPES)}${selectField("brand", "牌号", GRID_BRANDS)}</fieldset><button class="primary" id="go" type="submit">开始智能预测</button><p class="muted" style="margin-top:12px">建议范围：磨蚀性 0-10 g，小磨时间 0-100 分钟，硬度 0-1000 HB，面积 0-1000 m²。</p></form><div>${resultShell(metric("k1", "高温端周期（天）") + metric("k2", "高温端产量（万吨）") + metric("k3", "低温端周期（天）") + metric("k4", "低温端产量（万吨）"))}</div></div>`);
  applyPreset(preset);
  document.querySelector("#form").onsubmit = async (event) => {
    event.preventDefault();
    const button = document.querySelector("#go");
    button.disabled = true;
    const job = (async () => {
      const abrasion = readNumber("#abrasion", 0.109);
      const time = readNumber("#time", 31);
      const hard = readNumber("#hard", 525);
      const area = readNumber("#area", 286);
      const notes = [];
      if (abrasion <= 0 || abrasion > 10) notes.push("磨蚀性建议范围：0-10 g");
      if (time <= 0 || time > 100) notes.push("小磨实验时间建议范围：0-100 分钟");
      if (hard <= 0 || hard > 1000) notes.push("硬度建议范围：0-1000 HB");
      if (area <= 0 || area > 1000) notes.push("篦冷机面积建议范围：0-1000 m²");
      showRange(notes);
      if (!gridThresholds) gridThresholds = await loadJson("data/grid_thresholds.json");
      const names = ["grid_cycle1", "grid_prod1", "grid_cycle2", "grid_prod2"];
      const models = await Promise.all(names.map(loadModel));
      const type = document.querySelector("#type").value;
      const brand = document.querySelector("#brand").value;
      const row = encode([abrasion, time, hard, area], [
        { options: GRID_TYPES, selected: type },
        { options: GRID_BRANDS, selected: brand }
      ]);
      return {
        models, row,
        values: models.map((model) => predictXgb(model, row)),
        meta: { spec: type + " · " + brand, inputs: { abrasion: String(abrasion), time: String(time), hard: String(hard), area: String(area), type, brand } }
      };
    })();
    try {
      await Promise.all([runStages(), job]);
      const data = await job;
      paintGrid(data.values, data.meta);
      const explain = document.querySelector("#explain");
      if (explain) explain.innerHTML = sensitivityHtml(data.models, data.row, [
        { index: 0, label: "磨蚀性" },
        { index: 1, label: "小磨时间" },
        { index: 2, label: "硬度" },
        { index: 3, label: "面积" }
      ], data.values, ["高温周期", "高温产量", "低温周期", "低温产量"]);
    } catch (error) {
      const wait = document.querySelector("#wait");
      if (wait) {
        wait.hidden = false;
        wait.textContent = "预测失败：" + error.message;
      }
    } finally {
      if (button) button.disabled = false;
    }
  };
}

function paintGrid(values, meta) {
  const ratings = [
    percentileRating(values[0], gridThresholds.cycle1),
    percentileRating(values[1], gridThresholds.prod1),
    percentileRating(values[2], gridThresholds.cycle2),
    percentileRating(values[3], gridThresholds.prod2)
  ];
  values.forEach((value, index) => {
    const node = document.querySelector("#k" + (index + 1));
    node.textContent = num(value, 1);
    node.className = tone(ratings[index][0]);
    document.querySelector("#k" + (index + 1) + "-note").textContent = "评级: " + ratings[index][0];
  });
  const advice = gridAdvice(values, ratings.map((item) => item[0]));
  const scores = [
    values[0] > 0 ? Math.min(100, values[0] / 1000 * 100) : 0,
    values[1] > 0 ? Math.min(100, values[1] / 800 * 100) : 0,
    values[2] > 0 ? Math.min(100, values[2] / 1000 * 100) : 0,
    values[3] > 0 ? Math.min(100, values[3] / 800 * 100) : 0
  ];
  document.querySelector("#bars").innerHTML = bars([
    { label: "高温周期", value: scores[0], text: num(values[0], 1) },
    { label: "高温产量", value: scores[1], text: num(values[1], 1) },
    { label: "低温周期", value: scores[2], text: num(values[2], 1) },
    { label: "低温产量", value: scores[3], text: num(values[3], 1) }
  ]);
  document.querySelector("#radar").innerHTML = radar([
    { label: "高温周期", value: scores[0] },
    { label: "高温产量", value: scores[1] },
    { label: "低温周期", value: scores[2] },
    { label: "低温产量", value: scores[3] }
  ]);
  document.querySelector("#extra").innerHTML = `<h2>分项评级</h2><div class="status-list">${["高温周期", "高温产量", "低温周期", "低温产量"].map((label, index) => `<div><span>${label}</span><b>${esc(ratings[index][0])}</b></div>`).join("")}</div><p class="muted" style="margin-top:8px">低温端模型文件与高温端不是同一文件。若低温周期和产量数字接近，以模型输出为准。</p>`;
  document.querySelector("#advice").innerHTML = `<h2>AI 决策建议</h2>${adviceCards(advice)}`;
  document.querySelector("#gain").innerHTML = `<span>综合评价</span><strong>${esc(pickLine(advice, "综合表现：") || "篦板")}</strong>`;
  remember({
    id: Date.now(),
    at: new Date().toISOString(),
    module: "grid",
    moduleName: "篦板",
    spec: meta.spec,
    summary: "高温周期 " + num(values[0], 1) + " 天",
    inputs: meta.inputs,
    metrics: [
      { label: "高温周期", value: num(values[0], 1), unit: "天" },
      { label: "高温产量", value: num(values[1], 1), unit: "万吨" },
      { label: "低温周期", value: num(values[2], 1), unit: "天" },
      { label: "低温产量", value: num(values[3], 1), unit: "万吨" }
    ],
    advice, model: "grid_*.json"
  });
  finishRun();
}

PAGES.hammer = renderHammer;
PAGES.roller = () => renderParts("roller");
PAGES.disc = () => renderParts("disc");
PAGES.grid = renderGrid;

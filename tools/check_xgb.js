const fs = require("fs");
const path = require("path");
const { predictXgb } = require("../js/xgb.js");

const dataDir = path.join(__dirname, "..", "data");
const cases = JSON.parse(fs.readFileSync(path.join(dataDir, "fixtures.json"), "utf8"));
let failed = 0;
for (const item of cases) {
  const model = JSON.parse(fs.readFileSync(path.join(dataDir, item.model + ".json"), "utf8"));
  const got = predictXgb(model, item.row);
  const delta = Math.abs(got - item.y);
  const ok = delta < 1e-3;
  console.log(item.model, "expected", item.y, "got", got, "delta", delta, ok ? "OK" : "FAIL");
  if (!ok) failed += 1;
}
if (failed) process.exit(1);

function f32(value) {
  return Math.fround(value);
}

function predictXgb(model, row) {
  const values = row.map(f32);
  let total = f32(model.base);
  for (let t = 0; t < model.trees.length; t += 1) {
    const tree = model.trees[t];
    let node = 0;
    while (tree[node][0] !== -1) {
      const left = tree[node][0];
      const right = tree[node][1];
      const feat = tree[node][2];
      const dleft = tree[node][3];
      const threshold = f32(tree[node][4]);
      const value = values[feat];
      if (Number.isNaN(value)) node = dleft ? left : right;
      else if (value < threshold) node = left;
      else node = right;
    }
    total = f32(total + f32(tree[node][4]));
  }
  return total;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { predictXgb };
}

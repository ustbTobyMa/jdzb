# -*- coding: utf-8 -*-
"""Extract models and lookup tables from the packaged desktop app."""
import datetime
import json
import math
import os
import struct
import zlib

import joblib
import numpy as np
import pandas as pd

EXE_DIR = r"d:\WeChat Files\xwechat_files\wxid_h8lcktia2t2l22_e140\msg\file\2026-09"
OUT = r"E:\Desktop\jidong-predict\data"
MAGIC = b"MEI\014\013\012\013\016"
WANTED = {
    "xgb_model.pkl",
    "xgb_model.pkl1",
    "xgb_model.pkl2",
    "xgb_model.pkl3",
    "xgb_model.pkl4",
    "xgb_model.pkl5",
    "xgb_model.pkl6",
    "xgb_model1.pkl",
    "xgb_model2.pkl",
    "xgb_model3.pkl",
    "xgb_model4.pkl",
}


def find_exe():
    for name in os.listdir(EXE_DIR):
        full = os.path.join(EXE_DIR, name)
        if name.endswith(".exe") and os.path.getsize(full) > 100_000_000:
            return full
    raise SystemExit("exe not found")


def toc_entries(fp):
    size = os.path.getsize(fp)
    with open(fp, "rb") as f:
        f.seek(size - 8_000_000)
        tail = f.read()
    off = size - 8_000_000 + tail.rfind(MAGIC)
    with open(fp, "rb") as f:
        f.seek(off)
        _magic, pkg_len, toc, toc_len, _pyver = struct.unpack("!8sIIII", f.read(24))
    overlay = size - pkg_len
    with open(fp, "rb") as f:
        f.seek(overlay + toc)
        toc_data = f.read(toc_len)
    entries = []
    p = 0
    while p < len(toc_data):
        (entry_len,) = struct.unpack("!I", toc_data[p : p + 4])
        if entry_len < 18 or p + entry_len > len(toc_data):
            break
        entry = toc_data[p : p + entry_len]
        entry_pos, cmprsd, _unc, cmprs_flag, _typ = struct.unpack("!IIIBc", entry[4:18])
        name = entry[18:].split(b"\x00")[0].decode("utf-8", "replace")
        entries.append((name, entry_pos, cmprsd, cmprs_flag, overlay))
        p += entry_len
    return entries


def read_entry(fp, entry):
    name, entry_pos, cmprsd, cmprs_flag, overlay = entry
    with open(fp, "rb") as f:
        f.seek(overlay + entry_pos)
        data = f.read(cmprsd)
    if cmprs_flag == 1:
        data = zlib.decompress(data)
    return data


def tree_to_nodes(tree):
    left = tree["left_children"]
    right = tree["right_children"]
    feat = tree["split_indices"]
    cond = tree["split_conditions"]
    default_left = tree["default_left"]
    nodes = []
    for i in range(len(left)):
        nodes.append(
            [
                int(left[i]),
                int(right[i]),
                int(feat[i]),
                1 if int(default_left[i]) else 0,
                float(np.float32(cond[i])),
            ]
        )
    return nodes


def predict_compact(model, row):
    values = np.array(row, dtype=np.float32)
    total = np.float32(model["base"])
    for tree in model["trees"]:
        node = 0
        while tree[node][0] != -1:
            left, right, feat, dleft, cond = tree[node]
            value = values[feat]
            threshold = np.float32(cond)
            if np.isnan(value):
                node = left if dleft else right
            elif value < threshold:
                node = left
            else:
                node = right
        total = np.float32(total + np.float32(tree[node][4]))
    return float(total)


def booster_of(model):
    if hasattr(model, "get_booster"):
        return model.get_booster()
    return model


def export_booster(model):
    booster = booster_of(model)
    raw = booster.save_raw("json")
    if isinstance(raw, bytes):
        payload = json.loads(raw.decode("utf-8"))
    else:
        payload = json.loads(raw)
    learner = payload["learner"]
    trees = learner["gradient_booster"]["model"]["trees"]
    base = float(np.float32(float(learner["learner_model_param"]["base_score"])))
    limit = 0
    if hasattr(model, "best_ntree_limit"):
        limit = int(getattr(model, "best_ntree_limit") or 0)
    if limit <= 0 and hasattr(booster, "best_ntree_limit"):
        limit = int(getattr(booster, "best_ntree_limit") or 0)
    chosen = trees if limit <= 0 else trees[:limit]
    return {"base": base, "trees": [tree_to_nodes(tree) for tree in chosen]}


def clean_value(value):
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, (np.floating,)):
        value = float(value)
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (pd.Timestamp, datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, str):
        text = value.strip()
        return text if text else None
    if isinstance(value, (int, float, bool)):
        return value
    return str(value)


def frame_records(df):
    df = df.dropna(how="all")
    df.columns = [str(c).strip() for c in df.columns]
    records = []
    for row in df.to_dict(orient="records"):
        records.append({key: clean_value(val) for key, val in row.items()})
    return records


def main():
    os.makedirs(OUT, exist_ok=True)
    fp = find_exe()
    extracted = {}
    for entry in toc_entries(fp):
        name = entry[0]
        is_root_xlsx = name.endswith(".xlsx") and "\\" not in name and "/" not in name
        if name in WANTED or is_root_xlsx:
            extracted[name] = read_entry(fp, entry)
    missing = WANTED - set(extracted)
    if missing:
        raise SystemExit("missing " + ", ".join(sorted(missing)))

    raw_dir = os.path.join(OUT, "_raw")
    os.makedirs(raw_dir, exist_ok=True)
    for name, data in extracted.items():
        with open(os.path.join(raw_dir, name), "wb") as handle:
            handle.write(data)

    model_names = [
        "hammer",
        "roller_consumption",
        "roller_production",
        "roller_wear",
        "disc_consumption",
        "disc_production",
        "disc_wear",
        "grid_cycle1",
        "grid_prod1",
        "grid_cycle2",
        "grid_prod2",
    ]
    files = [
        "xgb_model.pkl",
        "xgb_model.pkl1",
        "xgb_model.pkl2",
        "xgb_model.pkl3",
        "xgb_model.pkl4",
        "xgb_model.pkl5",
        "xgb_model.pkl6",
        "xgb_model1.pkl",
        "xgb_model2.pkl",
        "xgb_model3.pkl",
        "xgb_model4.pkl",
    ]
    checks = []
    for key, filename in zip(model_names, files):
        loaded = joblib.load(os.path.join(raw_dir, filename))
        compact = export_booster(loaded)
        n_features = int(booster_of(loaded).num_features())
        row = np.linspace(0.2, 1.7, n_features)
        row[0] = 120.0
        expected = float(loaded.predict(row.reshape(1, -1))[0])
        got = predict_compact(compact, row.tolist())
        # If base_score is already inside the trees, try without it.
        if abs(got - expected) > 1e-3:
            compact_no_base = dict(compact)
            compact_no_base["base"] = 0.0
            got_no_base = predict_compact(compact_no_base, row.tolist())
            if abs(got_no_base - expected) < abs(got - expected):
                compact = compact_no_base
                got = got_no_base
        delta = abs(got - expected)
        checks.append((key, n_features, len(compact["trees"]), expected, got, delta))
        if delta > 1e-4:
            raise SystemExit("predict mismatch %s expected %s got %s" % (key, expected, got))
        with open(os.path.join(OUT, key + ".json"), "w", encoding="utf-8") as handle:
            json.dump(compact, handle, separators=(",", ":"))
        print("%s features=%d trees=%d delta=%.3g bytes=%d" % (
            key, n_features, len(compact["trees"]), delta, os.path.getsize(os.path.join(OUT, key + ".json"))
        ))

    xlsx_names = [name for name in extracted if name.endswith(".xlsx")]
    dataset_name = None
    mine_name = None
    wear_name = None
    for name in xlsx_names:
        book = pd.ExcelFile(os.path.join(raw_dir, name), engine="openpyxl")
        sheets = book.sheet_names
        probe = pd.read_excel(book, sheet_name=sheets[0])
        columns = [str(c).strip() for c in probe.columns]
        if "\u77ff\u5c71" in sheets:
            mine_name = name
        elif "\u6750\u6599\u724c\u53f7" in columns:
            wear_name = name
        else:
            dataset_name = name
    if not (dataset_name and mine_name and wear_name):
        raise SystemExit("could not classify workbooks: " + repr(xlsx_names))
    dataset = pd.read_excel(os.path.join(raw_dir, dataset_name), engine="openpyxl")
    percentiles = [5, 10, 20, 40, 60, 80]
    thresholds = {}
    for index, name in enumerate(["cycle1", "prod1", "cycle2", "prod2"]):
        thresholds[name] = [float(v) for v in np.percentile(dataset.iloc[:, index], percentiles)]
    with open(os.path.join(OUT, "grid_thresholds.json"), "w", encoding="utf-8") as handle:
        json.dump(thresholds, handle, ensure_ascii=False, indent=2)
    print("thresholds", thresholds)

    mine = pd.read_excel(os.path.join(raw_dir, mine_name), sheet_name="\u77ff\u5c71", engine="openpyxl")
    wear = pd.read_excel(os.path.join(raw_dir, wear_name), sheet_name="Sheet1", engine="openpyxl")
    with open(os.path.join(OUT, "mine.json"), "w", encoding="utf-8") as handle:
        json.dump(frame_records(mine), handle, ensure_ascii=False)
    with open(os.path.join(OUT, "wear.json"), "w", encoding="utf-8") as handle:
        json.dump(frame_records(wear), handle, ensure_ascii=False)
    print("mine", len(mine), "wear", len(wear))


if __name__ == "__main__":
    main()

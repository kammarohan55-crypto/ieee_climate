"""Reproduce TerraTrace's chronological public-building water-demand benchmark.

python -m pip install -r scripts/campus-demand-requirements.txt
python scripts/train-campus-demand.py
Only three original, anonymized BDG2 water-meter columns are redistributed.
The clipped data and derived artifacts retain the upstream CC BY-SA license.
No measured London campus demand or achieved intervention benefit is implied.
"""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
LOCAL_DEPS = ROOT / "outputs" / "campus-python"
if LOCAL_DEPS.exists():
    sys.path.insert(0, str(LOCAL_DEPS))
import numpy as np
import sklearn
from sklearn.ensemble import GradientBoostingRegressor

OUT = ROOT / "public" / "campus-demand"
CACHE = ROOT / "outputs" / "campus-demand-source"
COMMIT = "9b97ccbe90096aff42ed4fd6493bf7ae692d7118"
BASE = f"https://raw.githubusercontent.com/buds-lab/building-data-genome-project-2/{COMMIT}"
RAW_URL = f"https://media.githubusercontent.com/media/buds-lab/building-data-genome-project-2/{COMMIT}/data/meters/raw/water.csv"
META_URL = f"https://media.githubusercontent.com/media/buds-lab/building-data-genome-project-2/{COMMIT}/data/metadata/metadata.csv"
LICENSE_URL = BASE + "/LICENSE"
BUILDINGS = ["Panther_education_Teofila", "Panther_education_Quintin", "Panther_education_Mohammad"]
FEATURES = ["lag1M3", "lag2M3", "lag7M3", "previous7MeanM3", "previous7MinM3", "previous7MaxM3", "previous7StdM3", "weekdaySin", "weekdayCos", "yearSin", "yearCos"]


def fetch(url: str, filename: str) -> bytes:
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / filename
    if target.exists():
        return target.read_bytes()
    request = urllib.request.Request(url, headers={"User-Agent": "TerraTrace-public-data-benchmark/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
    except (OSError, urllib.error.URLError):
        if filename != "metadata-content.csv":
            raise
        # Some networks reset the media CDN for this LFS object. GitHub's official
        # LFS batch endpoint yields its signed download URL; do not use a mirror.
        body = json.dumps({"operation": "download", "transfers": ["basic"], "objects": [{"oid": "992d0b29f24f96ad4332bc4dbb534b7bdd7dd2689aad093f94e93068ecddca02", "size": 272024}]}).encode()
        endpoint = "https://github.com/buds-lab/building-data-genome-project-2.git/info/lfs/objects/batch"
        batch = urllib.request.Request(endpoint, data=body, headers={"Content-Type": "application/vnd.git-lfs+json", "Accept": "application/vnd.git-lfs+json"})
        action = json.load(urllib.request.urlopen(batch, timeout=60))["objects"][0]["actions"]["download"]
        data = urllib.request.urlopen(urllib.request.Request(action["href"], headers=action.get("header", {})), timeout=60).read()
    if filename == "metadata-content.csv" and hashlib.sha256(data).hexdigest() != "992d0b29f24f96ad4332bc4dbb534b7bdd7dd2689aad093f94e93068ecddca02":
        raise ValueError("Metadata does not match the pinned Git LFS object")
    target.write_bytes(data)
    return data


def sha(data: bytes) -> str:
    return "0x" + hashlib.sha256(data).hexdigest()


def dump(name: str, value: object) -> None:
    (OUT / name).write_text(json.dumps(value, separators=(",", ":"), allow_nan=False), encoding="utf-8")


def feature_for(date: dt.date, lookup: dict[str, float | None]) -> list[float] | None:
    previous = [lookup.get((date - dt.timedelta(days=i)).isoformat()) for i in range(1, 8)]
    if any(value is None for value in previous):
        return None
    values = np.array(previous, dtype=float)
    weekday = date.weekday()
    doy = date.timetuple().tm_yday - 1
    year_days = 366 if date.year % 4 == 0 else 365
    return [float(values[0]), float(values[1]), float(values[6]), float(values.mean()), float(values.min()), float(values.max()), float(values.std()), math.sin(2 * math.pi * weekday / 7), math.cos(2 * math.pi * weekday / 7), math.sin(2 * math.pi * doy / year_days), math.cos(2 * math.pi * doy / year_days)]


def tree_json(estimator) -> dict:
    tree = estimator.tree_
    return {"left": tree.children_left.tolist(), "right": tree.children_right.tolist(), "feature": tree.feature.tolist(), "threshold": tree.threshold.tolist(), "value": tree.value[:, 0, 0].tolist()}


def export_model(model) -> dict:
    return {"initial": float(model.init_.constant_[0, 0]), "learningRate": model.learning_rate, "trees": [tree_json(tree[0]) for tree in model.estimators_]}


def metrics(rows: list[dict]) -> dict:
    actual = np.array([row["actualM3"] for row in rows])
    total = float(actual.sum())
    result = {"count": len(rows), "actualTotalM3": total}
    for name, field in [("model", "medianM3"), ("previousWeek", "previousWeekM3"), ("historicalWeekday", "historicalWeekdayM3")]:
        prediction = np.array([row[field] for row in rows])
        errors = np.abs(actual - prediction)
        result[name] = {"maeM3": float(errors.mean()), "wapePercent": float(errors.sum() / total * 100) if total else None, "biasM3": float((prediction - actual).mean())}
    covered = [row["lowerM3"] <= row["actualM3"] <= row["upperM3"] for row in rows]
    result["intervalCoveragePercent"] = float(np.mean(covered) * 100)
    result["nominalIntervalPercent"] = 80
    result["beatsBestBaseline"] = result["model"]["maeM3"] < min(result["previousWeek"]["maeM3"], result["historicalWeekday"]["maeM3"])
    return result


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    raw = fetch(RAW_URL, "water.csv")
    metadata_bytes = fetch(META_URL, "metadata-content.csv")
    license_bytes = fetch(LICENSE_URL, "LICENSE")
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    missing = [name for name in BUILDINGS if name not in (reader.fieldnames or [])]
    if missing:
        raise ValueError(f"Upstream columns missing: {missing}")
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(["timestamp"] + BUILDINGS)
    grouped: dict[str, dict[str, list[tuple[str, float | None]]]] = {name: {} for name in BUILDINGS}
    for row in reader:
        timestamp = row["timestamp"]
        writer.writerow([timestamp] + [row[name] for name in BUILDINGS])
        for name in BUILDINGS:
            try:
                value = float(row[name])
                if not math.isfinite(value) or value < 0:
                    value = None
            except ValueError:
                value = None
            grouped[name].setdefault(timestamp[:10], []).append((timestamp, value))
    clipped = stream.getvalue().encode("utf-8")
    (OUT / "water-three-buildings.csv").write_bytes(clipped)
    (OUT / "LICENSE-BDG2.txt").write_bytes(license_bytes)
    metadata = list(csv.DictReader(io.StringIO(metadata_bytes.decode("utf-8-sig"))))
    meta = [row for row in metadata if row.get("building_id") in BUILDINGS]
    if len(meta) != 3:
        raise ValueError("Exactly three matching original metadata records are required")
    dump("metadata-three-buildings.json", meta)
    source = {
        "title": "Building Data Genome 2 — raw hourly water meters",
        "url": RAW_URL, "metadataUrl": META_URL, "commit": COMMIT,
        "paper": "https://www.nature.com/articles/s41597-020-00712-x",
        "unitReference": "https://github.com/buds-lab/building-data-genome-project-2/wiki/Meters-data-features",
        "license": "CC BY-SA 4.0 (upstream LICENSE retained)",
        "attribution": "Miller et al. and Building Data Genome 2 contributors (2020)",
        "rawSourceSha256": sha(raw), "clippedSourceSha256": sha(clipped), "metadataSourceSha256": sha(metadata_bytes),
        "retrievedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "rawUnit": "litres per hourly interval", "displayUnit": "m³/day",
        "locationNote": "Anonymized Panther education buildings at a US reference site. These are not London campus measurements.",
        "notes": ["Original local timestamps contain no UTC offset; daily totals follow the dataset's 24-row local-day convention.", "Raw readings are retained, without interpolation, winsorization, or hidden zero removal.", "Whole-building water is not automatically eligible non-potable demand.", "Clipped data and derived benchmark artifacts retain upstream Attribution-ShareAlike terms separately from application code."]
    }
    artifact = {"schema": "terratrace-demand-benchmark-v1", "modelVersion": "bdg2-gradient-boosting-quantiles-v1", "source": source, "featureNames": FEATURES, "split": {"trainStart": "2016-01-01", "trainEnd": "2016-09-30", "validationStart": "2016-10-01", "validationEnd": "2016-12-31", "testStart": "2017-01-01", "testEnd": "2017-12-31", "policy": "Fixed chronological train / validation / test. Parameters frozen before test; no test refitting."}, "parameters": {"nEstimators": 150, "maxDepth": 3, "minSamplesLeaf": 10, "learningRate": .05, "randomSeed": 42, "quantiles": [.1, .5, .9]}, "runtime": {"python": sys.version.split()[0], "numpy": np.__version__, "scikitLearn": sklearn.__version__}, "buildings": []}
    for name in BUILDINGS:
        daily = []
        lookup = {}
        cursor = dt.date(2016, 1, 1)
        while cursor <= dt.date(2017, 12, 31):
            date = cursor.isoformat()
            rows = grouped[name].get(date, [])
            good = len(rows) == 24 and len({time for time, _ in rows}) == 24 and all(value is not None for _, value in rows)
            total = sum(value for _, value in rows) / 1000 if good else None
            lookup[date] = total
            daily.append({"date": date, "valueM3": total, "validHours": sum(value is not None for _, value in rows), "expectedHours": 24, "status": "complete" if good else "incomplete"})
            cursor += dt.timedelta(days=1)
        records = []
        for day in daily:
            date = dt.date.fromisoformat(day["date"])
            features = feature_for(date, lookup)
            if day["valueM3"] is not None and features is not None:
                records.append({"date": day["date"], "features": features, "actualM3": day["valueM3"], "weekday": date.weekday()})
        train = [row for row in records if row["date"] <= "2016-09-30"]
        validation = [row for row in records if "2016-10-01" <= row["date"] <= "2016-12-31"]
        test = [row for row in records if row["date"] >= "2017-01-01"]
        X = np.array([row["features"] for row in train])
        y = np.array([row["actualM3"] for row in train])
        models = {key: GradientBoostingRegressor(loss="quantile", alpha=alpha, n_estimators=150, max_depth=3, min_samples_leaf=10, learning_rate=.05, random_state=42).fit(X, y) for key, alpha in [("lower", .1), ("median", .5), ("upper", .9)]}
        weekday_means = [float(np.mean([row["actualM3"] for row in train if row["weekday"] == weekday])) for weekday in range(7)]
        def evaluated(rows):
            matrix = np.array([row["features"] for row in rows])
            predictions = {key: model.predict(matrix) for key, model in models.items()}
            result = []
            for i, row in enumerate(rows):
                median = max(0, float(predictions["median"][i]))
                low = max(0, min(float(predictions["lower"][i]), median, float(predictions["upper"][i])))
                high = max(median, float(predictions["upper"][i]), float(predictions["lower"][i]))
                result.append({"date": row["date"], "actualM3": row["actualM3"], "medianM3": median, "lowerM3": low, "upperM3": high, "previousWeekM3": lookup[(dt.date.fromisoformat(row["date"]) - dt.timedelta(days=7)).isoformat()], "historicalWeekdayM3": weekday_means[row["weekday"]]})
            return result
        validation_rows = evaluated(validation)
        test_rows = evaluated(test)
        building = {"id": name, "alias": name.split("_")[-1], "metadata": next(row for row in meta if row["building_id"] == name), "daily": daily, "dataQuality": {"completeDays2016": sum(day["status"] == "complete" for day in daily if day["date"].startswith("2016")), "completeDays2017": sum(day["status"] == "complete" for day in daily if day["date"].startswith("2017")), "excludedTestDays": 365 - len(test), "exclusionPolicy": "A target needs all 24 valid nonnegative raw hourly readings and seven complete preceding days."}, "trainCount": len(train), "weekdayMeansM3": weekday_means, "models": {key: export_model(model) for key, model in models.items()}, "validation": {"metrics": metrics(validation_rows), "rows": validation_rows}, "test": {"metrics": metrics(test_rows), "rows": test_rows}, "parityFixtures": [{"date": row["date"], "features": next(item["features"] for item in test if item["date"] == row["date"]), "expected": {"medianM3": row["medianM3"], "lowerM3": row["lowerM3"], "upperM3": row["upperM3"]}} for row in test_rows[::31]]}
        artifact["buildings"].append(building)
        print(name, "coverage", building["dataQuality"], "test", building["test"]["metrics"], flush=True)
    dump("benchmark.json", artifact)
    dump("source-manifest.json", source)
    (OUT / "README.md").write_text("# BDG2 reference demand benchmark\n\nOriginal anonymized US education buildings; not London campus measurements.\n\nSource: " + RAW_URL + "\n\nPaper: " + source["paper"] + "\n\nAttribution: " + source["attribution"] + "\n\nData license: upstream Attribution-ShareAlike license retained in LICENSE-BDG2.txt. Clipped data, metadata and derived benchmark artifacts retain these terms; application code has its own license.\n\nReproduce with scripts/train-campus-demand.py and its pinned requirements. The entire unmodified source is fetched into ignored outputs only; the public file retains three original columns.\n\nThe frozen 2017 test follows the declared 2016 training and validation split. Missing days and their dependent lag windows are excluded equally from all evaluated methods. Quantile outputs use a nonnegative, enclosing interval correction, whose empirical coverage is reported. No intervention date or achieved savings is invented.\n", encoding="utf-8")
    print("Saved", OUT / "benchmark.json", (OUT / "benchmark.json").stat().st_size, "bytes")


if __name__ == "__main__":
    main()

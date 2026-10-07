#!/usr/bin/env python3
"""Build the browser vehicle catalogue from the ODbL engine CSV.

Usage:
  python3 tools/generate_vehicle_catalog.py /path/to/engines.csv vehicle-catalog.js

The output deliberately keeps only makes currently represented by REMUS/DBA in
the shop. It is a vehicle selector, not a parts-fitment authority.
"""

import csv
import json
import re
import sys
from collections import defaultdict


MAKE_MAP = {
    "Alfa Romeo": "ALFA ROMEO",
    "Audi": "AUDI",
    "BMW": "BMW",
    "Cupra": "CUPRA",
    "Fiat": "FIAT",
    "Ford": "FORD",
    "Honda": "HONDA",
    "Hyundai": "HYUNDAI",
    "Kia": "KIA",
    "Mazda": "MAZDA",
    "Mercedes-Benz": "MERCEDES BENZ",
    "MINI": "MINI",
    "Peugeot": "PEUGEOT",
    "Porsche": "PORSCHE",
    "Renault": "RENAULT",
    "SEAT": "SEAT",
    "Skoda": "SKODA",
    "Škoda": "SKODA",
    "Subaru": "SUBARU",
    "Suzuki": "SUZUKI",
    "Toyota": "TOYOTA",
    "Volkswagen": "VW",
}


def number(value):
    if not value:
        return None
    try:
        parsed = float(value)
        return int(parsed) if parsed.is_integer() else parsed
    except ValueError:
        return None


def without_make_prefix(value, *makes):
    cleaned = value.strip()
    for make in makes:
        if not make:
            continue
        pattern = re.escape(make).replace(r"\ ", r"[\s-]+")
        cleaned = re.sub(r"^" + pattern + r"\s+", "", cleaned, flags=re.I)
    return cleaned


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Expected input CSV and output JS path")
    source, target = sys.argv[1:]
    grouped = defaultdict(
        lambda: defaultdict(
            lambda: defaultdict(lambda: {"engines": {}})
        )
    )

    with open(source, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            make = MAKE_MAP.get(row["make"])
            if not make:
                continue
            raw_make = row["make"].strip()
            model = without_make_prefix(row["model"], raw_make, make)
            generation = without_make_prefix(row["generation"], raw_make, make) or model
            engine_label = row["engine_label"].strip()
            if not model or not engine_label:
                continue
            generation_data = grouped[make][model][generation]
            generation_data["s"] = number(row["gen_year_start"])
            generation_data["e"] = number(row["gen_year_end"])
            generation_data["b"] = row["body_type"].strip() or None
            generation_data["engines"][engine_label] = {
                "l": engine_label,
                "f": row["fuel_type"].strip() or None,
                "d": number(row["displacement_cc"]),
                "h": number(row["power_hp"]),
            }

    catalogue = {}
    for make, models in sorted(grouped.items()):
        catalogue[make] = []
        for model, generations in sorted(models.items()):
            item = {"n": model, "g": []}
            for generation, data in sorted(
                generations.items(),
                key=lambda pair: (pair[1].get("s") or 0, pair[0]),
                reverse=True,
            ):
                engines = sorted(
                    data.pop("engines").values(),
                    key=lambda engine: (engine.get("h") or 0, engine["l"]),
                )
                item["g"].append({
                    "n": generation,
                    "s": data.get("s"),
                    "e": data.get("e"),
                    "b": data.get("b"),
                    "x": engines,
                })
            catalogue[make].append(item)

    with open(target, "w", encoding="utf-8") as handle:
        handle.write("/* Generated from vehicle-makes-models (ODbL 1.0). See VEHICLE-DATA-LICENSE.md. */\n")
        handle.write("window.VEHICLE_CATALOG=")
        json.dump(catalogue, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write(";\n")


if __name__ == "__main__":
    main()

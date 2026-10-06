#!/usr/bin/env python3
"""Fast, dependency-free checks for SEO, language pages and shop data."""

from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
ERRORS = []


def fail(message: str) -> None:
    ERRORS.append(message)


def check_languages() -> None:
    for language in ("lb", "de", "fr", "en"):
        for page in ("index.html", "service.html"):
            path = ROOT / language / page
            if not path.exists():
                fail(f"missing language page: {path.relative_to(ROOT)}")
                continue
            html = path.read_text(encoding="utf-8")
            if f'<html lang="{language}">' not in html:
                fail(f"wrong html language: {path.relative_to(ROOT)}")
            if f"https://autoservicebettenduerf.lu/{language}/" not in html:
                fail(f"missing clean canonical: {path.relative_to(ROOT)}")


def check_sitemap() -> None:
    try:
        tree = ET.parse(ROOT / "sitemap.xml")
    except (ET.ParseError, OSError) as error:
        fail(f"invalid sitemap: {error}")
        return
    locations = [el.text or "" for el in tree.iter() if el.tag.endswith("loc")]
    for language in ("lb", "de", "fr", "en"):
        expected = f"https://autoservicebettenduerf.lu/{language}/"
        if expected not in locations:
            fail(f"sitemap misses {expected}")


def decode_array(source: str, marker: str):
    start = source.find(marker)
    if start < 0:
        return []
    value, _ = json.JSONDecoder().raw_decode(source[start + len(marker):])
    return value


def check_products() -> None:
    source = (ROOT / "shop-data.js").read_text(encoding="utf-8")
    products = decode_array(source, "window.SHOP_PRODUCTS=")
    if not products:
        fail("REMUS product catalog is empty")
        return
    ids = [product.get("i") for product in products]
    if len(ids) != len(set(ids)):
        fail("duplicate REMUS product IDs")
    bad = [product.get("i") for product in products if not product.get("p") or product.get("p") < 0]
    if bad:
        fail("invalid REMUS prices: " + ", ".join(map(str, bad[:10])))
    for data_file in ("shop-data.js", "shop-data-dba.js"):
        text = (ROOT / data_file).read_text(encoding="utf-8")
        if re.search(r'"p":0(?:\D|$)', text):
            fail(f"zero-price product found in {data_file}")


def check_admin_integrity() -> None:
    index = (ROOT / "intern/index.html").read_text(encoding="utf-8")
    service_worker = (ROOT / "intern/sw.js").read_text(encoding="utf-8")
    admin_js = (ROOT / "intern/intern.js").read_text(encoding="utf-8")
    worker = (ROOT / "worker/admin-api.js").read_text(encoding="utf-8")
    version = re.search(r'intern\.js\?v=(\d+)', index)
    if not version or f'intern.js?v={version.group(1)}' not in service_worker:
        fail("admin script version differs between index.html and service worker")
    if "pickupDone&&returnDone&&pickupDone.customerSignature&&returnDone.customerSignature" not in admin_js:
        fail("combined protocol is not available after both signed stages")
    if 'return /^assets\\//.test(value)?"/"+value:value;' not in admin_js:
        fail("relative fleet image paths are not normalized for the admin PWA")
    for required in (
        'DELETE FROM rental_inspections WHERE booking_id=?1',
        "DELETE FROM request_consents WHERE request_type='booking'",
        "deleteProtocolMedia(env, mediaKeys)",
        "validDateOnly(preferredDate)",
    ):
        if required not in worker:
            fail(f"booking deletion misses related data cleanup: {required}")


def main() -> int:
    check_languages()
    check_sitemap()
    check_products()
    check_admin_integrity()
    if ERRORS:
        print("Site checks failed:")
        for error in ERRORS:
            print(f"- {error}")
        return 1
    print("Site checks passed: languages, sitemap and product catalog are consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

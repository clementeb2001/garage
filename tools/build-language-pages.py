#!/usr/bin/env python3
"""Generate the clean language entry points used by GitHub Pages."""

from pathlib import Path
import re
from datetime import date


ROOT = Path(__file__).resolve().parent.parent
LANGUAGES = ("lb", "de", "fr", "en")
PAGES = ("index.html", "service.html")
SITE = "https://autoservicebettenduerf.lu"
SERVICE_IDS = (
    "wartung", "reifen", "bremsen", "diagnose", "klima", "controle",
    "tuning", "karosserie", "tip-winter", "tip-fruehjahr", "tip-summer",
    "tip-herbst",
)


def language_path(language: str, page: str) -> str:
    return f"/{language}/" if page == "index.html" else f"/{language}/service.html"


def build_page(language: str, page: str) -> str:
    html = (ROOT / page).read_text(encoding="utf-8")
    html = re.sub(r'<html lang="[^"]+">', f'<html lang="{language}">', html, count=1)
    html = html.replace("<head>", '<head>\n    <base href="../" />', 1)
    clean = SITE + language_path(language, page)
    html = re.sub(
        r'<link\s+rel="canonical"\s+href="[^"]+"\s*/>',
        f'<link rel="canonical" href="{clean}" />',
        html,
        count=1,
        flags=re.S,
    )
    return html


def sitemap() -> str:
    rows = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
            '        xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    today = date.today().isoformat()
    for page, service_id in [("index.html", None)] + [("service.html", sid) for sid in SERVICE_IDS]:
        for language in LANGUAGES:
            suffix = f"?s={service_id}" if service_id else ""
            url = SITE + language_path(language, page) + suffix
            rows.extend(["  <url>", f"    <loc>{url}</loc>", f"    <lastmod>{today}</lastmod>",
                         "    <changefreq>monthly</changefreq>",
                         f"    <priority>{'1.0' if not service_id else '0.7'}</priority>"])
            for alt in LANGUAGES:
                alt_url = SITE + language_path(alt, page) + suffix.replace("&", "&amp;")
                rows.append(f'    <xhtml:link rel="alternate" hreflang="{alt}" href="{alt_url}" />')
            default_url = SITE + language_path("lb", page) + suffix.replace("&", "&amp;")
            rows.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{default_url}" />')
            rows.append("  </url>")
    rows.append("</urlset>")
    return "\n".join(rows) + "\n"


def main() -> None:
    for language in LANGUAGES:
        directory = ROOT / language
        directory.mkdir(exist_ok=True)
        for page in PAGES:
            (directory / page).write_text(build_page(language, page), encoding="utf-8")
    (ROOT / "sitemap.xml").write_text(sitemap(), encoding="utf-8")


if __name__ == "__main__":
    main()

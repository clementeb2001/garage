#!/usr/bin/env python3
"""Generate the clean language entry points used by GitHub Pages."""

from pathlib import Path
import json
import re
from datetime import date


ROOT = Path(__file__).resolve().parent.parent
LANGUAGES = ("lb", "de", "fr", "en")
PAGES = ("index.html", "service.html", "location.html")
SITE = "https://autoservicebettenduerf.lu"
SERVICE_IDS = (
    "wartung", "reifen", "bremsen", "diagnose", "klima", "controle",
    "tuning", "karosserie", "tip-winter", "tip-fruehjahr", "tip-summer",
    "tip-herbst",
)

SEO = {
    "lb": {
        "title": "Autoservice Bettenduerf – Autosgarage zu Bettendorf",
        "description": "Autosgarage zu Bettendorf an offiziell 1·2·3 AutoService Partnergarage. Entretien, Reparatur, Pneueservice, Contrôle technique an Tuning.",
        "locale": "lb_LU",
    },
    "de": {
        "title": "Autoservice Bettenduerf – Autowerkstatt in Bettendorf",
        "description": "Autowerkstatt in Bettendorf und offizieller 1·2·3 AutoService Partner. Wartung, Reparatur, Reifenservice, technische Kontrolle und Tuning.",
        "locale": "de_LU",
    },
    "fr": {
        "title": "Autoservice Bettenduerf – Garage automobile à Bettendorf",
        "description": "Garage automobile à Bettendorf et partenaire officiel 1·2·3 AutoService. Entretien, réparation, pneus, contrôle technique et tuning.",
        "locale": "fr_LU",
    },
    "en": {
        "title": "Autoservice Bettenduerf – Car garage in Bettendorf",
        "description": "Car garage in Bettendorf and official 1·2·3 AutoService partner. Maintenance, repairs, tyres, technical inspection and tuning.",
        "locale": "en_LU",
    },
}

LOCATION_SEO = {
    "lb": {"title": "Gefierer an Unhänger lounen – Autoservice Bettenduerf", "heading": "Material a Gefierer lounen", "description": "Gefierer an Unhänger zu Bettendorf lounen. Disponibilitéit online kucken an direkt eng Reservatiounsufro schécken."},
    "de": {"title": "Fahrzeuge und Anhänger mieten – Autoservice Bettenduerf", "heading": "Fahrzeuge &amp; Anhänger mieten", "description": "Fahrzeuge und Anhänger in Bettendorf mieten. Verfügbarkeit online prüfen und direkt eine Reservierungsanfrage senden."},
    "fr": {"title": "Location de véhicules et remorques – Autoservice Bettenduerf", "heading": "Louer des véhicules et remorques", "description": "Louez des véhicules et remorques à Bettendorf. Consultez les disponibilités et envoyez directement votre demande de réservation."},
    "en": {"title": "Vehicle and trailer rental – Autoservice Bettenduerf", "heading": "Rent vehicles &amp; trailers", "description": "Rent vehicles and trailers in Bettendorf. Check availability online and send your reservation request directly."},
}


def translations() -> dict[str, dict[str, str]]:
    """Read the simple string entries from script.js without duplicating them here."""
    source = (ROOT / "script.js").read_text(encoding="utf-8")
    start = source.index("var I18N = {")
    end = source.index("\n  };", start)
    block = source[start:end]
    result: dict[str, dict[str, str]] = {}
    starts = [(lang, block.index(f"    {lang}: {{")) for lang in LANGUAGES]
    for index, (lang, pos) in enumerate(starts):
        limit = starts[index + 1][1] if index + 1 < len(starts) else len(block)
        section = block[pos:limit]
        values = {}
        for match in re.finditer(r"^\s{6}([A-Za-z0-9_]+):\s*(\"(?:\\.|[^\"\\])*\")", section, re.M | re.S):
            values[match.group(1)] = json.loads(match.group(2))
        result[lang] = values
    return result


def replace_tag_contents(html: str, attribute: str, values: dict[str, str]) -> str:
    pattern = re.compile(
        rf'<(?P<tag>[a-zA-Z][\w-]*)(?P<attrs>[^>]*\s{attribute}="(?P<key>[^"]+)"[^>]*)>'
        rf'(?P<body>.*?)</(?P=tag)\s*>',
        re.S,
    )
    return pattern.sub(
        lambda m: f'<{m.group("tag")}{m.group("attrs")}>{values.get(m.group("key"), m.group("body"))}</{m.group("tag")}>',
        html,
    )


def replace_attribute_values(html: str, marker: str, target: str, values: dict[str, str]) -> str:
    pattern = re.compile(rf'(<[^>]*\s{marker}="(?P<key>[^"]+)"[^>]*)(?P<end>>)', re.S)
    def repl(match: re.Match[str]) -> str:
        prefix = match.group(1)
        value = values.get(match.group("key"))
        if value is None:
            return match.group(0)
        escaped = value.replace("&", "&amp;").replace('"', "&quot;")
        if re.search(rf'\s{target}="[^"]*"', prefix):
            prefix = re.sub(rf'(\s{target}=")[^"]*(")', rf'\g<1>{escaped}\2', prefix, count=1)
        else:
            prefix += f' {target}="{escaped}"'
        return prefix + match.group("end")
    return pattern.sub(repl, html)


def language_path(language: str, page: str) -> str:
    if page == "index.html":
        return f"/{language}/"
    return f"/{language}/{page}"


def build_page(language: str, page: str, dictionary: dict[str, str]) -> str:
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
    seo = SEO[language]
    page_description = seo["description"]
    if page == "index.html":
        html = re.sub(r"<title>.*?</title>", f'<title>{seo["title"]}</title>', html, count=1, flags=re.S)
        html = re.sub(r'(<meta\s+name="description"\s+content=")[^"]*(")', rf'\g<1>{seo["description"]}\2', html, count=1)
        html = re.sub(r'(<meta\s+property="og:title"\s+content=")[^"]*(")', rf'\g<1>{seo["title"]}\2', html, count=1)
    elif page == "service.html":
        service_titles = {
            "lb": "Service am Detail – Autoservice Bettenduerf",
            "de": "Leistung im Detail – Autoservice Bettenduerf",
            "fr": "Prestation en détail – Autoservice Bettenduerf",
            "en": "Service details – Autoservice Bettenduerf",
        }
        html = re.sub(r"<title>.*?</title>", f"<title>{service_titles[language]}</title>", html, count=1, flags=re.S)
        html = re.sub(r'(<meta\s+property="og:title"\s+content=")[^"]*(")', rf'\g<1>{service_titles[language]}\2', html, count=1)
    else:
        rental = LOCATION_SEO[language]
        page_description = rental["description"]
        html = re.sub(r"<title>.*?</title>", f'<title>{rental["title"]}</title>', html, count=1, flags=re.S)
        html = re.sub(r'(<meta\s+name="description"\s+content=")[^"]*(")', rf'\g<1>{rental["description"]}\2', html, count=1)
        html = re.sub(r'(<meta\s+property="og:title"\s+content=")[^"]*(")', rf'\g<1>{rental["title"]}\2', html, count=1)
        html = re.sub(r'(<meta\s+property="og:description"\s+content=")[^"]*(")', rf'\g<1>{rental["description"]}\2', html, count=1)
        html = re.sub(r'<h1 id="rental-title">.*?</h1>', f'<h1 id="rental-title">{rental["heading"]}</h1>', html, count=1, flags=re.S)
        html = re.sub(r'\s*<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href="[^"]+"\s*/>', "", html)
        alternates = "\n".join(
            f'    <link rel="alternate" hreflang="{alt}" href="{SITE + language_path(alt, page)}" />'
            for alt in LANGUAGES
        ) + f'\n    <link rel="alternate" hreflang="x-default" href="{SITE + language_path("lb", page)}" />'
        html = html.replace(f'<link rel="canonical" href="{clean}" />', f'<link rel="canonical" href="{clean}" />\n{alternates}', 1)
    html = re.sub(r'(<meta\s+property="og:description"\s+content=")[^"]*(")', rf'\g<1>{page_description}\2', html, count=1)
    html = re.sub(r'(<meta\s+property="og:locale"\s+content=")[^"]*(")', rf'\g<1>{seo["locale"]}\2', html, count=1)
    html = re.sub(r'(<meta\s+property="og:url"\s+content=")[^"]*(")', rf'\g<1>{clean}\2', html, count=1)
    html = replace_tag_contents(html, "data-i18n", dictionary)
    html = replace_attribute_values(html, "data-i18n-ph", "placeholder", dictionary)
    html = replace_attribute_values(html, "data-i18n-alt", "alt", dictionary)
    html = replace_attribute_values(html, "data-i18n-aria", "aria-label", dictionary)
    html = html.replace('href="location.html"', f'href="/{language}/location.html"')
    return html


def sitemap() -> str:
    rows = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
            '        xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    today = date.today().isoformat()
    for page, service_id in [("index.html", None), ("location.html", None)] + [("service.html", sid) for sid in SERVICE_IDS]:
        for language in LANGUAGES:
            suffix = f"?s={service_id}" if service_id else ""
            url = SITE + language_path(language, page) + suffix
            rows.extend(["  <url>", f"    <loc>{url}</loc>", f"    <lastmod>{today}</lastmod>",
                         "    <changefreq>monthly</changefreq>",
                         f"    <priority>{'1.0' if page == 'index.html' else ('0.8' if page == 'location.html' else '0.7')}</priority>"])
            for alt in LANGUAGES:
                alt_url = SITE + language_path(alt, page) + suffix.replace("&", "&amp;")
                rows.append(f'    <xhtml:link rel="alternate" hreflang="{alt}" href="{alt_url}" />')
            default_url = SITE + language_path("lb", page) + suffix.replace("&", "&amp;")
            rows.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{default_url}" />')
            rows.append("  </url>")
    rows.append("</urlset>")
    return "\n".join(rows) + "\n"


def main() -> None:
    dictionaries = translations()
    for language in LANGUAGES:
        directory = ROOT / language
        directory.mkdir(exist_ok=True)
        for page in PAGES:
            (directory / page).write_text(build_page(language, page, dictionaries[language]), encoding="utf-8")
    (ROOT / "sitemap.xml").write_text(sitemap(), encoding="utf-8")


if __name__ == "__main__":
    main()

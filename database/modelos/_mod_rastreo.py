"""Recorre una web como hace Google y apunta lo que ve de cada página, para
la auditoría SEO (_mod_seo.py). Solo lee, respeta robots.txt, no sale del
dominio de la web, va de pocas en pocas páginas y se para en un máximo.

Sin dependencias nuevas: el HTML se lee con html.parser de la biblioteca
estándar, que basta para títulos, metas, encabezados, enlaces e imágenes."""

import asyncio
import json
import re
import time
from html.parser import HTMLParser
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from ._mod_wordpress import _comprobar_destino_publico

AGENTE = "Mozilla/5.0 (compatible; MultiplikaSEO/1.0; +https://multiplika.net)"
TIMEOUT = 20
EN_PARALELO = 4
_NO_HTML = re.compile(r"\.(jpe?g|png|gif|webp|svg|pdf|zip|docx?|xlsx?|pptx?|mp4|mp3|css|js|ico|xml|txt)$", re.I)


class _Lector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.titulo, self._en_titulo = "", False
        self.metas, self.enlaces, self.imagenes, self.h1 = {}, [], [], []
        self._en_h1, self._texto_h1 = False, ""
        self.canonical, self.lang, self.shortlink = None, None, None
        self.ld_json, self._en_ld, self._ld = [], False, ""
        self.clases_body = ""
        self.palabras = 0
        self._ignorar = 0

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "body":
            self.clases_body = a.get("class", "")
        elif tag == "title":
            self._en_titulo = True
        elif tag == "meta":
            clave = (a.get("name") or a.get("property") or "").lower()
            if clave:
                self.metas[clave] = a.get("content", "")
        elif tag == "link":
            rel = a.get("rel", "").lower()
            if rel == "canonical":
                self.canonical = a.get("href")
            elif rel == "shortlink":
                self.shortlink = a.get("href")
        elif tag == "a" and a.get("href"):
            self.enlaces.append({"href": a["href"], "nofollow": "nofollow" in a.get("rel", "")})
        elif tag == "img":
            self.imagenes.append({"src": a.get("src") or a.get("data-src") or "", "alt": a.get("alt") if "alt" in a else None})
        elif tag == "h1":
            self._en_h1, self._texto_h1 = True, ""
        elif tag == "script" and a.get("type") == "application/ld+json":
            self._en_ld, self._ld = True, ""
        elif tag in ("script", "style", "noscript"):
            self._ignorar += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self._en_titulo = False
        elif tag == "h1" and self._en_h1:
            self._en_h1 = False
            self.h1.append(self._texto_h1.strip())
        elif tag == "script" and self._en_ld:
            self._en_ld = False
            try:
                datos = json.loads(self._ld)
                for d in (datos if isinstance(datos, list) else datos.get("@graph", [datos])):
                    if isinstance(d, dict) and d.get("@type"):
                        self.ld_json.append(d["@type"] if isinstance(d["@type"], str) else ",".join(d["@type"]))
            except (ValueError, AttributeError):
                self.ld_json.append("(JSON-LD con errores)")
        elif tag in ("script", "style", "noscript") and self._ignorar:
            self._ignorar -= 1

    def handle_data(self, data):
        if self._en_titulo:
            self.titulo += data
        elif self._en_ld:
            self._ld += data
        elif not self._ignorar:
            if self._en_h1:
                self._texto_h1 += data
            self.palabras += len(data.split())


def _id_wordpress(lector: _Lector) -> tuple[str, int] | None:
    """Qué entrada o página de WordPress es, para poder proponer el arreglo."""
    m = re.search(r"\b(postid|page-id)-(\d+)\b", lector.clases_body)
    if m:
        return ("entradas" if m.group(1) == "postid" else "paginas", int(m.group(2)))
    if lector.shortlink:
        m = re.search(r"[?&](p|page_id)=(\d+)", lector.shortlink)
        if m:
            return ("entradas" if m.group(1) == "p" else "paginas", int(m.group(2)))
    return None


def _normalizar(url: str) -> str:
    url = urldefrag(url)[0]
    p = urlparse(url)
    return p._replace(path=p.path or "/").geturl()


async def rastrear(url_inicio: str, maximo: int = 200) -> dict:
    """Recorre la web desde la portada (y su sitemap) y devuelve lo visto."""
    _comprobar_destino_publico(url_inicio)
    base = urlparse(url_inicio)
    hosts = {base.hostname, (base.hostname or "").removeprefix("www."), "www." + (base.hostname or "").removeprefix("www.")}
    raiz = f"{base.scheme}://{base.netloc}"
    inicio = time.monotonic()
    sitio = {"robots_txt": None, "sitemap": None, "sitemaps": [], "https_obligado": None}

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False, headers={"User-Agent": AGENTE}) as c:
        robots = RobotFileParser()
        try:
            r = await c.get(f"{raiz}/robots.txt")
            sitio["robots_txt"] = r.status_code == 200
            robots.parse(r.text.splitlines() if r.status_code == 200 else [])
            sitio["sitemaps"] = robots.site_maps() or []
        except httpx.HTTPError:
            robots.parse([])
        semillas = [_normalizar(url_inicio + "/")]
        for mapa in (sitio["sitemaps"] or [f"{raiz}/sitemap.xml", f"{raiz}/wp-sitemap.xml"])[:3]:
            try:
                urls = await _leer_sitemap(c, mapa, hosts, 0)
            except httpx.HTTPError:
                urls = []
            if urls:
                sitio["sitemap"] = mapa
                semillas += urls
                break
        if base.scheme == "https":
            try:
                r = await c.get(f"http://{base.netloc}/")
                sitio["https_obligado"] = r.status_code in (301, 302, 307, 308) and r.headers.get("location", "").startswith("https://")
            except httpx.HTTPError:
                sitio["https_obligado"] = None

        en_sitemap = set(semillas[1:])
        pendientes, vistos, paginas = list(dict.fromkeys(semillas)), set(), {}
        destinos_enlazados: dict[str, set] = {}

        async def visitar(url: str) -> None:
            if not robots.can_fetch(AGENTE, url):
                paginas[url] = {"url": url, "bloqueada_robots": True}
                return
            pagina = {"url": url, "redirecciones": []}
            actual = url
            t0 = time.monotonic()
            try:
                for _ in range(5):
                    r = await c.get(actual)
                    if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("location"):
                        pagina["redirecciones"].append(r.status_code)
                        actual = urljoin(actual, r.headers["location"])
                        if urlparse(actual).hostname not in hosts:  # sale de la web: no se sigue
                            pagina.update(codigo=r.status_code, url_final=actual, sale_de_la_web=True)
                            paginas[url] = pagina
                            return
                        continue
                    break
            except httpx.HTTPError as e:
                pagina.update(codigo=None, error=str(e) or e.__class__.__name__)
                paginas[url] = pagina
                return
            pagina.update(codigo=r.status_code, url_final=actual, ms=int((time.monotonic() - t0) * 1000),
                          bytes=len(r.content), en_sitemap=url in en_sitemap)
            if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
                paginas[url] = pagina
                return
            lector = _Lector()
            lector.feed(r.text)
            internos = []
            for e in lector.enlaces:
                destino = _normalizar(urljoin(actual, e["href"]))
                p = urlparse(destino)
                if p.scheme in ("http", "https") and p.hostname in hosts:
                    internos.append(destino)
                    destinos_enlazados.setdefault(destino, set()).add(url)
                    if destino not in vistos and not _NO_HTML.search(p.path) and len(vistos) < maximo:
                        vistos.add(destino)
                        pendientes.append(destino)
            pagina.update(
                titulo=lector.titulo.strip(), descripcion=lector.metas.get("description"),
                robots=lector.metas.get("robots", ""), canonical=lector.canonical, lang=lector.lang,
                h1=lector.h1, palabras=lector.palabras, datos_estructurados=lector.ld_json,
                imagenes=len(lector.imagenes),
                imagenes_sin_alt=[i["src"] for i in lector.imagenes if i["alt"] is None or not i["alt"].strip()][:20],
                enlaces_internos=len(set(internos)), og_titulo=lector.metas.get("og:title"),
                id_wordpress=_id_wordpress(lector),
            )
            paginas[url] = pagina

        vistos.update(pendientes)
        while pendientes and len(paginas) < maximo:
            lote, pendientes = pendientes[:EN_PARALELO], pendientes[EN_PARALELO:]
            await asyncio.gather(*(visitar(u) for u in lote if u not in paginas))
            await asyncio.sleep(0.2)  # sin agobiar al servidor del cliente

    # Enlaces internos rotos: destinos que se visitaron y no dieron 200
    for destino, origenes in destinos_enlazados.items():
        p = paginas.get(destino)
        if p and p.get("codigo") and p["codigo"] >= 400:
            p["enlazada_desde"] = sorted(origenes)[:10]
    return {"sitio": sitio, "paginas": list(paginas.values()), "segundos": int(time.monotonic() - inicio),
            "limite_alcanzado": len(paginas) >= maximo}


async def _leer_sitemap(c: httpx.AsyncClient, url: str, hosts: set, nivel: int) -> list[str]:
    r = await c.get(url, follow_redirects=True)
    if r.status_code != 200 or "<" not in r.text[:200]:
        return []
    locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", r.text)
    if "<sitemapindex" in r.text and nivel < 2:
        urls = []
        for sub in locs[:20]:
            urls += await _leer_sitemap(c, sub, hosts, nivel + 1)
        return urls
    return [_normalizar(u) for u in locs if urlparse(u).hostname in hosts and not _NO_HTML.search(urlparse(u).path)]


"""Gera recortes da captura de tela das unidades de decisoes_manuais.csv e das que ainda estão em
resultados/revisao_manual.csv. Saída: resultados/recortes/.

Uso: python recortes.py   (depois de analise.py)
"""
import csv, json, os, sys
import pymupdf

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "resultados", "recortes")
os.makedirs(OUT, exist_ok=True)
linhas = list(csv.DictReader(open(os.path.join(HERE, "resultados", "revisao_manual.csv"), encoding="utf-8-sig"), delimiter=";"))
vistos = {(l["pagina"], l["tipo"], l["elemento"]) for l in linhas}
for d in csv.DictReader(open(os.path.join(HERE, "decisoes_manuais.csv"), encoding="utf-8-sig"), delimiter=";"):
    pag, tipo, el = d["chave"].split("|", 2)
    if (pag, tipo, el) not in vistos:
        g = "bad" if pag.startswith("bad-") else "sites"
        linhas.append({"grupo": g, "pagina": pag, "tipo": tipo, "elemento": el, "evidencia": d["justificativa"]})
        vistos.add((pag, tipo, el))
cache = {}
for i, l in enumerate(linhas, 1):
    g, pag, p = l["grupo"], l["pagina"], l["elemento"]
    if pag not in cache:
        cache[pag] = json.load(open(os.path.join(HERE, "dados", g, pag + ".json"), encoding="utf8"))
    reg = cache[pag]
    info = (reg.get("infoElementos") or {}).get(p) or ((reg.get("contraste") or {}).get(p) or {}).get("info")
    png = os.path.join(HERE, "dados", g, pag + ".png")
    if not info or "pageRect" not in info or not os.path.exists(png):
        print(i, pag, l["tipo"], "sem retângulo ou sem captura")
        continue
    x, y, w, h = info["pageRect"]
    pg = pymupdf.open(png)[0]
    m = 40
    clip = pymupdf.Rect(max(0, x - m), max(0, y - m), min(pg.rect.width, x + w + m), min(pg.rect.height, y + h + m))
    if clip.is_empty:
        print(i, pag, l["tipo"], "fora da captura")
        continue
    nome = f"{i:03d}-{pag}-{l['tipo']}.png"
    pg.get_pixmap(clip=clip, dpi=144).save(os.path.join(OUT, nome))
    print(i, nome, l["evidencia"][:90])

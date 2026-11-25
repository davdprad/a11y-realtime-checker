"""Análise do estudo comparativo (Seção 5 da monografia).

Lê dados/<grupo>/*.json (gerados por coleta.mjs) e produz, em resultados/:
  act_casos.csv          um caso ACT por linha: esperado x detecção de cada ferramenta
  act_metricas.csv       VP/FP/FN/VN, precisão e revocação por ferramenta e por tipo de problema
  ocorrencias.csv        planilha do Apêndice A (páginas BAD e sites): unidade = elemento x critério
  metricas_paginas.csv   VP/FP/FN, precisão e revocação por ferramenta (páginas BAD e sites)
  cobertura.csv          critérios WCAG (A/AA) com ao menos uma ocorrência, por ferramenta
  revisao_manual.csv     unidades que a referência automática não decide (decididas em decisoes_manuais.csv)
  resumo.json            números usados no texto

Unidade de contagem: par (tipo de problema, elemento). Cada tipo pertence a um critério do
Quadro 3. O gabarito das páginas BAD e dos sites vem de uma referência independente das três
ferramentas: a árvore de acessibilidade do Chromium (nomes acessíveis), as cores de fundo
calculadas pelo Chromium (contraste), a geometria dos alvos (2.5.8) e os atributos do documento
(título, idioma, viewport). Casos que a referência não decide vão para decisão manual.
Uso: python analise.py
"""
import csv, json, glob, os, re, sys
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "resultados")
os.makedirs(OUT, exist_ok=True)
FERRAMENTAS = ["extensao", "axe", "wave"]

TIPO_CRITERIO = {
    "imagem-sem-nome": "1.1.1", "campo-sem-nome": "1.3.1", "contraste": "1.4.3",
    "zoom-bloqueado": "1.4.4", "titulo": "2.4.2", "link-sem-nome": "2.4.4",
    "tamanho-alvo": "2.5.8", "idioma": "3.1.1", "botao-sem-nome": "4.1.2",
    "aria-papel-invalido": "4.1.2", "aria-atributo-inexistente": "4.1.2",
    "aria-valor-invalido": "4.1.2", "aria-atributo-obrigatorio": "4.1.2",
}
ACT_TIPO = {
    "23a2a8": "imagem-sem-nome", "59796f": "imagem-sem-nome", "7d6734": "imagem-sem-nome",
    "e086e5": "campo-sem-nome", "afw4f7": "contraste", "b4f0c3": "zoom-bloqueado",
    "2779a5": "titulo", "c487ae": "link-sem-nome", "b5c3f8": "idioma", "bf051a": "idioma",
    "97a4e1": "botao-sem-nome", "674b10": "aria-papel-invalido", "5f99a7": "aria-atributo-inexistente",
    "6a7281": "aria-valor-invalido", "4e8ab6": "aria-atributo-obrigatorio",
}
EXT_TIPO = {
    "text-contrast": "contraste", "image-name": "imagem-sem-nome", "image-button-name": "imagem-sem-nome",
    "svg-img-name": "imagem-sem-nome", "button-name": "botao-sem-nome", "aria-role-valid": "aria-papel-invalido",
    "aria-attr-defined": "aria-atributo-inexistente", "aria-attr-valid-value": "aria-valor-invalido",
    "aria-required-attr": "aria-atributo-obrigatorio", "link-name": "link-sem-nome", "form-label": "campo-sem-nome",
    "html-lang": "idioma", "html-lang-valid": "idioma", "document-title": "titulo",
    "viewport-zoom": "zoom-bloqueado", "target-size": "tamanho-alvo",
}
AXE_TIPO = {
    "image-alt": "imagem-sem-nome", "input-image-alt": "imagem-sem-nome", "svg-img-alt": "imagem-sem-nome",
    "role-img-alt": "imagem-sem-nome", "label": "campo-sem-nome", "select-name": "campo-sem-nome",
    "aria-input-field-name": "campo-sem-nome", "aria-toggle-field-name": "campo-sem-nome",
    "color-contrast": "contraste", "meta-viewport": "zoom-bloqueado", "document-title": "titulo",
    "link-name": "link-sem-nome", "target-size": "tamanho-alvo", "html-has-lang": "idioma",
    "html-lang-valid": "idioma", "button-name": "botao-sem-nome", "input-button-name": "botao-sem-nome",
    "aria-roles": "aria-papel-invalido", "aria-valid-attr": "aria-atributo-inexistente",
    "aria-valid-attr-value": "aria-valor-invalido", "aria-required-attr": "aria-atributo-obrigatorio",
}
WAVE_TIPO = {
    "alt_missing": ["imagem-sem-nome"], "alt_spacer_missing": ["imagem-sem-nome"],
    "alt_input_missing": ["imagem-sem-nome"], "alt_link_missing": ["imagem-sem-nome", "link-sem-nome"],
    "label_missing": ["campo-sem-nome"], "label_empty": ["campo-sem-nome"], "contrast": ["contraste"],
    "title_invalid": ["titulo"], "language_missing": ["idioma"], "button_empty": ["botao-sem-nome"],
    "link_empty": ["link-sem-nome"],
}
# Tipos que cada ferramenta verifica (os demais não entram na revocação daquela ferramenta).
IMPLEMENTA = {
    "extensao": set(TIPO_CRITERIO),
    "axe": set(AXE_TIPO.values()),
    "wave": {t for v in WAVE_TIPO.values() for t in v},
}
WAVE_ITENS = json.load(open(os.path.join(HERE, "wave_itens.json"), encoding="utf8"))
IANA = set(json.load(open(os.path.join(HERE, "iana_primary_subtags.json"), encoding="utf8"))["subtags"])
PAGINA_TIPOS = {"titulo", "idioma", "zoom-bloqueado"}


def ler(grupo):
    regs = []
    for f in sorted(glob.glob(os.path.join(HERE, "dados", grupo, "*.json"))):
        if os.path.basename(f).startswith("_"):
            continue
        regs.append(json.load(open(f, encoding="utf8")))
    return regs


def achados(reg):
    """Lista de (ferramenta, tipo, path) com resultado de violação/erro de cada ferramenta."""
    out = []
    for o in reg.get("extensao", {}).get("ocorrencias", []):
        if o["outcome"] != "violation":
            continue
        for r in o["regras"]:
            rid, res = r.rsplit(":", 1)
            if res == "violation" and rid in EXT_TIPO:
                out.append(("extensao", EXT_TIPO[rid], o["path"], o.get("seletor")))
    for v in reg.get("axe", {}).get("violacoes", []):
        if v["id"] in AXE_TIPO:
            t = AXE_TIPO[v["id"]]
            for n in v["nos"]:
                p = "document" if t in PAGINA_TIPOS else n["path"]
                out.append(("axe", t, p, " ".join(map(str, n["alvo"]))))
    infos = reg.get("infoElementos") or {}
    for ic in reg.get("wave", {}).get("icons", []):
        tipos = WAVE_TIPO.get(ic["type"], [])
        if ic["type"] == "alt_link_missing":
            # O problema apontado é o link sem nome; a imagem só falha 1.1.1 se não tiver o atributo alt.
            snip = (infos.get(ic["path"]) or {}).get("snippet", "")
            tipos = ["link-sem-nome"] + (["imagem-sem-nome"] if snip and not re.search(r"\salt=", snip.split(">")[0]) else [])
        for t in tipos:
            p = "document" if (t in PAGINA_TIPOS or ic["pageWide"]) else ic["path"]
            if t == "link-sem-nome" and ic["type"] == "alt_link_missing" and p:
                p = link_ancestral(p) or p
            out.append(("wave", t, p, ic["type"]))
    return out


def link_ancestral(p):
    partes = p.split(">")
    for i in range(len(partes) - 1, -1, -1):
        if partes[i].startswith("a:"):
            return ">".join(partes[: i + 1])
    return None


# ------------------------------------------------------------------------------------------ ACT
def analisar_act():
    regs = ler("act")
    linhas, cont = [], defaultdict(Counter)
    for r in regs:
        tipo = ACT_TIPO[r["meta"]["regra"]]
        esperado = r["meta"]["esperado"]
        det = {f: False for f in FERRAMENTAS}
        for f, t, p, _ in achados(r):
            if t == tipo:
                det[f] = True
        linha = {"caso": r["id"], "regra_act": r["meta"]["regra"], "nome_regra": r["meta"]["nomeRegra"],
                 "exemplo": r["meta"]["caso"], "tipo": tipo, "criterio": TIPO_CRITERIO[tipo], "esperado": esperado,
                 "url_w3c": r["meta"]["urlW3C"], "erro_coleta": r.get("erro", "")}
        for f in FERRAMENTAS:
            linha[f] = "sim" if det[f] else "não"
            if f == "wave" and r.get("wave", {}).get("erro"):
                linha[f] = "falha"
                linha[f + "_classe"] = "falha de execução"
                cont[f]["falha"] += 1
                continue
            if tipo not in IMPLEMENTA[f]:
                linha[f + "_classe"] = "não verifica"
                cont[f]["nao_verifica_" + esperado] += 1
                continue
            if esperado == "failed":
                c = "VP" if det[f] else "FN"
            else:
                c = "FP" if det[f] else "VN"
            linha[f + "_classe"] = c
            cont[f][c] += 1
            cont[(f, tipo)][c] += 1
        linhas.append(linha)
    escrever("act_casos.csv", linhas)
    met = []
    for f in FERRAMENTAS:
        for chave in [f] + [(f, t) for t in sorted(set(ACT_TIPO.values()))]:
            c = cont[chave]
            if not sum(c[k] for k in ("VP", "FP", "FN", "VN")):
                continue
            met.append(metrica(f, chave[1] if isinstance(chave, tuple) else "todos", c))
    escrever("act_metricas.csv", met)
    return linhas, met, cont


def metrica(ferr, tipo, c):
    vp, fp, fn, vn = c["VP"], c["FP"], c["FN"], c["VN"]
    return {"ferramenta": ferr, "tipo": tipo, "criterio": TIPO_CRITERIO.get(tipo, "todos"), "VP": vp, "FP": fp, "FN": fn, "VN": vn,
            "precisao": round(vp / (vp + fp), 4) if vp + fp else "", "revocacao": round(vp / (vp + fn), 4) if vp + fn else ""}


# ------------------------------------------------------------------------------- páginas reais
def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def parse_cor(s):
    m = re.match(r"rgba?\(([^)]+)\)", s or "")
    if not m:
        return None
    p = [float(x) for x in re.split(r"[ ,/]+", m.group(1).strip()) if x]
    return (p[0], p[1], p[2], p[3] if len(p) > 3 else 1.0)


def compor(fg, bg):
    a = fg[3]
    return (fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1.0)


def razao(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def oraculo_contraste(c):
    """Devolve (True|False|None, evidência). True = violação."""
    if not c or c.get("status") or not c.get("info"):
        return None, f"sem dados ({c.get('status') if c else 'ausente'})"
    info = c["info"]
    if not info["visible"]:
        return False, "elemento não visível"
    if not info["ownText"] and not info["text"]:
        return False, "sem texto"
    fs = float(info["fontSize"].replace("px", "") or 0)
    fw = int(re.sub(r"\D", "", str(info["fontWeight"])) or 400)
    grande = fs >= 24 or (fs >= 18.66 and fw >= 700)
    minimo = 3.0 if grande else 4.5
    fg = parse_cor(info["color"])
    if fg is None:
        return None, "cor do texto não interpretável"
    fundos = []
    if c.get("backgroundColors"):
        for b in c["backgroundColors"]:
            pb = parse_cor(b)
            if pb:
                fundos.append(compor(pb, (255, 255, 255, 1)))
    else:
        cadeia = info.get("bgChain", [])
        if any(x["img"] or x["filter"] or x["blend"] for x in cadeia):
            return None, "fundo com imagem, gradiente, filtro ou mesclagem"
        base = (255, 255, 255, 1.0)
        for x in reversed(cadeia):
            pb = parse_cor(x["bg"])
            if pb and pb[3] > 0:
                base = compor(pb, base)
        fundos.append(base)
    if any(float(x.get("opacity", 1)) < 1 for x in info.get("bgChain", [])):
        return None, "opacidade < 1 em ancestral"
    rs = [razao(compor(fg, b), b) for b in fundos]
    ev = f"razão {min(rs):.2f}:1" + (f" a {max(rs):.2f}:1" if len(rs) > 1 else "") + f"; mínimo {minimo}:1; fonte {fs:.1f}px/{fw}"
    if all(r < minimo for r in rs):
        if info.get("textShadow") not in (None, "none"):
            return None, ev + "; sombra no texto"
        return True, ev
    if all(r >= minimo for r in rs):
        return False, ev
    return None, ev + "; fundo variável"


def no_ax(reg, p):
    return reg.get("arvoreAcessibilidade", {}).get(p) or reg.get("arvoreComplementar", {}).get(p)


def oraculo(reg, tipo, p, manual):
    """Gabarito de uma unidade: (True=violação|False|None=indefinido, fonte, evidência)."""
    pag = reg.get("pagina", {})
    chave = f"{reg['id']}|{tipo}|{p}"
    if chave in manual:
        d = manual[chave]
        if d["violacao"] == "excluir":
            return None, "decisão manual (excluída)", d["justificativa"]
        return d["violacao"] == "sim", "decisão manual", d["justificativa"]
    if tipo == "titulo":
        return (not (pag.get("title") or "").strip()), "documento", f"title = {pag.get('title')!r}"
    if tipo == "idioma":
        lang = (pag.get("lang") or "").strip()
        if not lang:
            return True, "documento", "html sem lang"
        prim = lang.split("-")[0].lower()
        return (prim not in IANA), "documento", f"lang = {lang!r}"
    if tipo == "zoom-bloqueado":
        vs = pag.get("viewport") or []
        bloq = False
        for v in vs:
            d = {k.strip().lower(): val.strip().lower() for k, _, val in (x.partition("=") for x in (v or "").split(","))}
            if d.get("user-scalable") in ("no", "0"):
                bloq = True
            try:
                if "maximum-scale" in d and float(d["maximum-scale"]) < 2:
                    bloq = True
            except ValueError:
                pass
        return bloq, "documento", f"viewport = {vs}"
    if tipo == "contraste":
        v, ev = oraculo_contraste(reg.get("contraste", {}).get(p))
        return v, "cores calculadas pelo Chromium", ev
    if tipo == "tamanho-alvo":
        g = reg.get("alvos258", {}).get(p)
        if not g:
            return None, "geometria", "sem dados"
        st = g["status"]
        ev = f"{st}; {g.get('w', 0):.1f}x{g.get('h', 0):.1f}px" + (f"; conflito com {g['conflict']}" if g.get("conflict") else "")
        return (st == "fail"), "geometria do alvo", ev
    if tipo in ("imagem-sem-nome", "link-sem-nome", "botao-sem-nome", "campo-sem-nome"):
        n = no_ax(reg, p)
        info = reg.get("infoElementos", {}).get(p)
        if n is None:
            if info and not info["visible"]:
                return False, "árvore de acessibilidade", "elemento não renderizado"
            snip = (info or {}).get("snippet", "")
            if tipo == "imagem-sem-nome" and re.match(r'<img[^>]*\salt=""', snip) and "role=" not in snip:
                return False, "atributos do elemento", "img com alt vazio (decorativa)"
            if 'aria-hidden="true"' in snip:
                return False, "atributos do elemento", "oculto da tecnologia assistiva (aria-hidden)"
            return None, "árvore de acessibilidade", "nó ausente da árvore"
        if n["ignored"]:
            return False, "árvore de acessibilidade", f"ignorado ({', '.join(n['ignoredReasons'])})"
        papel_ok = {
            "imagem-sem-nome": {"image", "img", "button"},
            "link-sem-nome": {"link"},
            "botao-sem-nome": {"button"},
            "campo-sem-nome": {"textbox", "searchbox", "combobox", "checkbox", "radio", "listbox", "spinbutton", "slider", "switch", "menuitemcheckbox", "menuitemradio"},
        }[tipo]
        if n["role"] not in papel_ok:
            return False, "árvore de acessibilidade", f"papel {n['role']} (não se aplica)"
        if tipo == "imagem-sem-nome" and n.get("tag") == "img" and n.get("alt") == "" and not n.get("roleAttr"):
            return False, "árvore de acessibilidade", "img com alt vazio (decorativa)"
        nome = nome_util(n["name"])
        ev = f"papel {n['role']}, nome {n['name'][:60]!r}" + (" (só caracteres de fonte de ícone)" if n["name"].strip() and not nome else "")
        return (not nome), "árvore de acessibilidade", ev
    return None, "", "verificação manual (ARIA)"


def nome_util(s):
    """Nome acessível sem espaços e sem caracteres de uso privado (glifos de fontes de ícone)."""
    return re.sub(r"[\s-]", "", s or "")


def decorativa_ou_fora(n):
    if n.get("tag") == "img" and n.get("alt") == "" and not n.get("roleAttr"):
        return True
    if n.get("tag") == "svg" and (n.get("roleAttr") or "") not in ("img", "graphics-document", "graphics-symbol"):
        return True
    return False


def agrupar_contraste(units, reg):
    """Une ocorrências de contraste do mesmo texto marcadas em níveis diferentes da árvore."""
    info = reg.get("infoElementos", {})
    ps = sorted({p for (t, p) in units if t == "contraste" and p}, key=len)
    canon = {}
    for p in ps:
        alvo = p
        for q in ps:
            if q == p or not p.startswith(q + ">"):
                continue
            a, b = info.get(p), info.get(q)
            if a and b and a["text"] and a["text"] == b["text"]:
                alvo = canon.get(q, q)
                break
        canon[p] = alvo
    return canon


def analisar_paginas(grupos, manual):
    linhas, revisar = [], []
    cont = defaultdict(Counter)
    cobertura = defaultdict(set)
    por_pagina = []
    for g in grupos:
        for reg in ler(g):
            if reg.get("erro"):
                print("coleta com erro:", reg["id"], reg["erro"][:120])
                continue
            ach = achados(reg)
            units = defaultdict(lambda: {"ferramentas": set(), "ref": []})
            for f, t, p, ref in ach:
                if p is None:
                    continue
                units[(t, p)]["ferramentas"].add(f)
                units[(t, p)]["ref"].append(f"{f}:{ref}")
            canon = agrupar_contraste(units, reg)
            fund = defaultdict(lambda: {"ferramentas": set(), "ref": []})
            for (t, p), u in units.items():
                k = (t, canon.get(p, p)) if t == "contraste" else (t, p)
                fund[k]["ferramentas"] |= u["ferramentas"]
                fund[k]["ref"] += u["ref"]
            # violações que a referência encontra e nenhuma ferramenta apontou
            papeis = {"image": "imagem-sem-nome", "img": "imagem-sem-nome", "link": "link-sem-nome", "button": "botao-sem-nome"}
            for p, n in reg.get("arvoreAcessibilidade", {}).items():
                t = papeis.get(n["role"]) or ("campo-sem-nome" if n["role"] in ("textbox", "searchbox", "combobox", "checkbox", "radio", "listbox", "spinbutton", "slider", "switch") else None)
                if t and not n["ignored"] and not nome_util(n["name"]) and (t, p) not in fund and not decorativa_ou_fora(n):
                    # imagem dentro de link: a falha de nome também é do link, já contada se houver
                    fund[(t, p)]["ref"].append("referência:nome vazio")
            for t in PAGINA_TIPOS:
                if (t, "document") not in fund:
                    v, _, _ = oraculo(reg, t, "document", manual)
                    if v:
                        fund[(t, "document")]["ref"].append("referência:documento")
            stats = Counter()
            for (t, p), u in sorted(fund.items(), key=lambda x: (TIPO_CRITERIO[x[0][0]], x[0][0], x[0][1])):
                v, fonte, ev = oraculo(reg, t, p, manual)
                info = reg.get("infoElementos", {}).get(p) or {}
                linha = {"grupo": g, "pagina": reg["id"], "criterio": TIPO_CRITERIO[t], "tipo": t, "elemento": p,
                         "trecho": (info.get("snippet") or "")[:160].replace("\n", " "),
                         "gabarito": {True: "violação", False: "não é violação", None: "indefinido"}[v],
                         "fonte_gabarito": fonte, "evidencia": ev, "referencias": "; ".join(sorted(set(u["ref"])))[:300]}
                for f in FERRAMENTAS:
                    linha[f] = "sim" if f in u["ferramentas"] else "não"
                linhas.append(linha)
                if v is None:
                    revisar.append({"chave": f"{reg['id']}|{t}|{p}", **linha})
                    stats["indefinido"] += 1
                    continue
                for f in FERRAMENTAS:
                    if t not in IMPLEMENTA[f]:
                        continue
                    rep = f in u["ferramentas"]
                    c = "VP" if (rep and v) else "FP" if rep else "FN" if v else None
                    if c:
                        cont[f][c] += 1
                        cont[(f, t)][c] += 1
                        cont[(f, g)][c] += 1
                        stats[f + "_" + c] += 1
                stats["violacoes_reais"] += int(bool(v))
                stats["unidades"] += 1
            por_pagina.append({"grupo": g, "pagina": reg["id"], "url": reg["url"], "nos": reg.get("pagina", {}).get("nos"),
                               "varredura_ms": round(reg["extensao"]["varreduraInicial"]["wallMs"], 1) if reg["extensao"].get("varreduraInicial") else "",
                               "maior_fatia_ms": round(reg["extensao"]["varreduraInicial"]["maxSliceMs"], 1) if reg["extensao"].get("varreduraInicial") else "",
                               **stats})
            # cobertura (critérios A/AA com ao menos uma ocorrência, em qualquer critério)
            for o in reg["extensao"]["ocorrencias"]:
                if o["outcome"] == "violation":
                    cobertura["extensao"].add(o["wcag"])
            for v_ in reg["axe"]["violacoes"]:
                for tg in v_["tags"]:
                    d = tg[4:]
                    cobertura["axe"].add(f"{d[0]}.{d[1]}.{d[2:]}")
            for ic in reg["wave"]["icons"]:
                it = WAVE_ITENS.get(ic["type"])
                if it and it["cat"] in ("error", "contrast"):
                    for w in it["wcag"]:
                        cobertura["wave"].add(w)
    escrever("ocorrencias.csv", linhas)
    escrever("revisao_manual.csv", revisar)
    escrever("paginas.csv", por_pagina)
    met = []
    for f in FERRAMENTAS:
        met.append(metrica(f, "todos", cont[f]))
    for g in grupos:
        for f in FERRAMENTAS:
            m = metrica(f, "todos", cont[(f, g)])
            m["tipo"] = f"todos ({g})"
            met.append(m)
    for t in TIPO_CRITERIO:
        for f in FERRAMENTAS:
            if sum(cont[(f, t)].values()):
                met.append(metrica(f, t, cont[(f, t)]))
    escrever("metricas_paginas.csv", met)
    cob = [{"ferramenta": f, "n_criterios": len(cobertura[f]), "criterios": " ".join(sorted(cobertura[f], key=lambda x: [int(y) for y in x.split(".")]))} for f in FERRAMENTAS]
    escrever("cobertura.csv", cob)
    return linhas, revisar, met, cob, por_pagina


def escrever(nome, linhas):
    with open(os.path.join(OUT, nome), "w", newline="", encoding="utf-8-sig") as fh:
        if not linhas:
            fh.write("")
            return
        campos = list(dict.fromkeys(k for l in linhas for k in l))
        w = csv.DictWriter(fh, fieldnames=campos, delimiter=";")
        w.writeheader()
        w.writerows(linhas)


if __name__ == "__main__":
    manual = {}
    mf = os.path.join(HERE, "decisoes_manuais.csv")
    if os.path.exists(mf):
        for row in csv.DictReader(open(mf, encoding="utf-8-sig"), delimiter=";"):
            manual[row["chave"]] = row
    resumo = {}
    if glob.glob(os.path.join(HERE, "dados", "act", "*.json")):
        l, m, c = analisar_act()
        resumo["act"] = {"casos": len(l), "erros_coleta": sum(1 for x in l if x["erro_coleta"]), "metricas": [x for x in m if x["tipo"] == "todos"]}
    grupos = [g for g in ("bad", "sites") if glob.glob(os.path.join(HERE, "dados", g, "*.json"))]
    if grupos:
        l, r, m, cob, pp = analisar_paginas(grupos, manual)
        resumo["paginas"] = {"unidades": len(l), "indefinidas": len(r), "metricas": [x for x in m if x["tipo"].startswith("todos")], "cobertura": cob}
    json.dump(resumo, open(os.path.join(OUT, "resumo.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(json.dumps(resumo, ensure_ascii=False, indent=1))

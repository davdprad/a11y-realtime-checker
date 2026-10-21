/* eslint-disable */
// ARQUIVO GERADO por scripts/gen-aria-data.ts — não editar à mão.
// Fonte: aria-query@5.3.2 (WAI-ARIA 1.2 + DPUB-ARIA 1.0 + Graphics-ARIA 1.0).

export const ARIA_QUERY_VERSION = "5.3.2";

export interface AriaRoleDef {
  readonly abstract: boolean;
  readonly superClass: readonly string[];
  readonly requiredProps: Readonly<Record<string, string | null>>;
  readonly nameFrom: readonly string[];
  readonly childrenPresentational: boolean;
}

export interface AriaPropDef {
  readonly type: string;
  readonly values?: readonly string[];
  readonly allowUndefined?: boolean;
}

export const ARIA_ROLES: Readonly<Record<string, AriaRoleDef>> = {
  "alert": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "alertdialog": {
    "abstract": false,
    "superClass": [
      "alert",
      "dialog",
      "roletype",
      "section",
      "structure",
      "window"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "application": {
    "abstract": false,
    "superClass": [
      "roletype",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "article": {
    "abstract": false,
    "superClass": [
      "document",
      "roletype",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "banner": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "blockquote": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "button": {
    "abstract": false,
    "superClass": [
      "command",
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": true
  },
  "caption": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "cell": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "checkbox": {
    "abstract": false,
    "superClass": [
      "input",
      "roletype",
      "widget"
    ],
    "requiredProps": {
      "aria-checked": null
    },
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": true
  },
  "code": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "columnheader": {
    "abstract": false,
    "superClass": [
      "cell",
      "gridcell",
      "roletype",
      "section",
      "sectionhead",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "combobox": {
    "abstract": false,
    "superClass": [
      "input",
      "roletype",
      "widget"
    ],
    "requiredProps": {
      "aria-controls": null,
      "aria-expanded": "false"
    },
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "command": {
    "abstract": true,
    "superClass": [
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "complementary": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "composite": {
    "abstract": true,
    "superClass": [
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "contentinfo": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "definition": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "deletion": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "dialog": {
    "abstract": false,
    "superClass": [
      "roletype",
      "window"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "directory": {
    "abstract": false,
    "superClass": [
      "list",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-abstract": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-acknowledgments": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-afterword": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-appendix": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-backlink": {
    "abstract": false,
    "superClass": [
      "command",
      "link",
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "doc-biblioentry": {
    "abstract": false,
    "superClass": [
      "listitem",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-bibliography": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-biblioref": {
    "abstract": false,
    "superClass": [
      "command",
      "link",
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "doc-chapter": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-colophon": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-conclusion": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-cover": {
    "abstract": false,
    "superClass": [
      "img",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-credit": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-credits": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-dedication": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-endnote": {
    "abstract": false,
    "superClass": [
      "listitem",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-endnotes": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-epigraph": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-epilogue": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-errata": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-example": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-footnote": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-foreword": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-glossary": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-glossref": {
    "abstract": false,
    "superClass": [
      "command",
      "link",
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "doc-index": {
    "abstract": false,
    "superClass": [
      "landmark",
      "navigation",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-introduction": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-noteref": {
    "abstract": false,
    "superClass": [
      "command",
      "link",
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "doc-notice": {
    "abstract": false,
    "superClass": [
      "note",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-pagebreak": {
    "abstract": false,
    "superClass": [
      "roletype",
      "separator",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": true
  },
  "doc-pagefooter": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "doc-pageheader": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "doc-pagelist": {
    "abstract": false,
    "superClass": [
      "landmark",
      "navigation",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-part": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-preface": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-prologue": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-pullquote": {
    "abstract": false,
    "superClass": [
      "none"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-qna": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-subtitle": {
    "abstract": false,
    "superClass": [
      "roletype",
      "sectionhead",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-tip": {
    "abstract": false,
    "superClass": [
      "note",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "doc-toc": {
    "abstract": false,
    "superClass": [
      "landmark",
      "navigation",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "document": {
    "abstract": false,
    "superClass": [
      "roletype",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "emphasis": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "feed": {
    "abstract": false,
    "superClass": [
      "list",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "figure": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "form": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "generic": {
    "abstract": false,
    "superClass": [
      "roletype",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "graphics-document": {
    "abstract": false,
    "superClass": [
      "document",
      "roletype",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "graphics-object": {
    "abstract": false,
    "superClass": [
      "group",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "graphics-symbol": {
    "abstract": false,
    "superClass": [
      "img",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": true
  },
  "grid": {
    "abstract": false,
    "superClass": [
      "composite",
      "roletype",
      "section",
      "structure",
      "table",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "gridcell": {
    "abstract": false,
    "superClass": [
      "cell",
      "roletype",
      "section",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "group": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "heading": {
    "abstract": false,
    "superClass": [
      "roletype",
      "sectionhead",
      "structure"
    ],
    "requiredProps": {
      "aria-level": "2"
    },
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "img": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": true
  },
  "input": {
    "abstract": true,
    "superClass": [
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "insertion": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "landmark": {
    "abstract": true,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "link": {
    "abstract": false,
    "superClass": [
      "command",
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "list": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "listbox": {
    "abstract": false,
    "superClass": [
      "composite",
      "group",
      "roletype",
      "section",
      "select",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "listitem": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "log": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "main": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "mark": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "marquee": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "math": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "menu": {
    "abstract": false,
    "superClass": [
      "composite",
      "group",
      "roletype",
      "section",
      "select",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "menubar": {
    "abstract": false,
    "superClass": [
      "composite",
      "group",
      "menu",
      "roletype",
      "section",
      "select",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "menuitem": {
    "abstract": false,
    "superClass": [
      "command",
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "menuitemcheckbox": {
    "abstract": false,
    "superClass": [
      "checkbox",
      "command",
      "input",
      "menuitem",
      "roletype",
      "widget"
    ],
    "requiredProps": {
      "aria-checked": null
    },
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": true
  },
  "menuitemradio": {
    "abstract": false,
    "superClass": [
      "checkbox",
      "command",
      "input",
      "menuitem",
      "menuitemcheckbox",
      "radio",
      "roletype",
      "widget"
    ],
    "requiredProps": {
      "aria-checked": null
    },
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": true
  },
  "meter": {
    "abstract": false,
    "superClass": [
      "range",
      "roletype",
      "structure"
    ],
    "requiredProps": {
      "aria-valuenow": null
    },
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": true
  },
  "navigation": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "none": {
    "abstract": false,
    "superClass": [],
    "requiredProps": {},
    "nameFrom": [],
    "childrenPresentational": false
  },
  "note": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "option": {
    "abstract": false,
    "superClass": [
      "input",
      "roletype",
      "widget"
    ],
    "requiredProps": {
      "aria-selected": "false"
    },
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": true
  },
  "paragraph": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "presentation": {
    "abstract": false,
    "superClass": [
      "roletype",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "progressbar": {
    "abstract": false,
    "superClass": [
      "range",
      "roletype",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": true
  },
  "radio": {
    "abstract": false,
    "superClass": [
      "input",
      "roletype",
      "widget"
    ],
    "requiredProps": {
      "aria-checked": null
    },
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": true
  },
  "radiogroup": {
    "abstract": false,
    "superClass": [
      "composite",
      "group",
      "roletype",
      "section",
      "select",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "range": {
    "abstract": true,
    "superClass": [
      "roletype",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "region": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "roletype": {
    "abstract": true,
    "superClass": [],
    "requiredProps": {},
    "nameFrom": [],
    "childrenPresentational": false
  },
  "row": {
    "abstract": false,
    "superClass": [
      "group",
      "roletype",
      "section",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "rowgroup": {
    "abstract": false,
    "superClass": [
      "roletype",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "rowheader": {
    "abstract": false,
    "superClass": [
      "cell",
      "gridcell",
      "roletype",
      "section",
      "sectionhead",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "scrollbar": {
    "abstract": false,
    "superClass": [
      "range",
      "roletype",
      "structure",
      "widget"
    ],
    "requiredProps": {
      "aria-controls": null,
      "aria-valuenow": null
    },
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": true
  },
  "search": {
    "abstract": false,
    "superClass": [
      "landmark",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "searchbox": {
    "abstract": false,
    "superClass": [
      "input",
      "roletype",
      "textbox",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "section": {
    "abstract": true,
    "superClass": [
      "roletype",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [],
    "childrenPresentational": false
  },
  "sectionhead": {
    "abstract": true,
    "superClass": [
      "roletype",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "select": {
    "abstract": true,
    "superClass": [
      "composite",
      "group",
      "roletype",
      "section",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "separator": {
    "abstract": false,
    "superClass": [
      "roletype",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": true
  },
  "slider": {
    "abstract": false,
    "superClass": [
      "input",
      "range",
      "roletype",
      "structure",
      "widget"
    ],
    "requiredProps": {
      "aria-valuenow": null
    },
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": true
  },
  "spinbutton": {
    "abstract": false,
    "superClass": [
      "composite",
      "input",
      "range",
      "roletype",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "status": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "strong": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "structure": {
    "abstract": true,
    "superClass": [
      "roletype"
    ],
    "requiredProps": {},
    "nameFrom": [],
    "childrenPresentational": false
  },
  "subscript": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "superscript": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "prohibited"
    ],
    "childrenPresentational": false
  },
  "switch": {
    "abstract": false,
    "superClass": [
      "checkbox",
      "input",
      "roletype",
      "widget"
    ],
    "requiredProps": {
      "aria-checked": null
    },
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": true
  },
  "tab": {
    "abstract": false,
    "superClass": [
      "roletype",
      "sectionhead",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": true
  },
  "table": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "tablist": {
    "abstract": false,
    "superClass": [
      "composite",
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "tabpanel": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "term": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "textbox": {
    "abstract": false,
    "superClass": [
      "input",
      "roletype",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "time": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "timer": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "status",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "toolbar": {
    "abstract": false,
    "superClass": [
      "group",
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "tooltip": {
    "abstract": false,
    "superClass": [
      "roletype",
      "section",
      "structure"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "tree": {
    "abstract": false,
    "superClass": [
      "composite",
      "group",
      "roletype",
      "section",
      "select",
      "structure",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "treegrid": {
    "abstract": false,
    "superClass": [
      "composite",
      "grid",
      "group",
      "roletype",
      "section",
      "select",
      "structure",
      "table",
      "tree",
      "widget"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  },
  "treeitem": {
    "abstract": false,
    "superClass": [
      "input",
      "listitem",
      "option",
      "roletype",
      "section",
      "structure",
      "widget"
    ],
    "requiredProps": {
      "aria-selected": null
    },
    "nameFrom": [
      "author",
      "contents"
    ],
    "childrenPresentational": false
  },
  "widget": {
    "abstract": true,
    "superClass": [
      "roletype"
    ],
    "requiredProps": {},
    "nameFrom": [],
    "childrenPresentational": false
  },
  "window": {
    "abstract": true,
    "superClass": [
      "roletype"
    ],
    "requiredProps": {},
    "nameFrom": [
      "author"
    ],
    "childrenPresentational": false
  }
};

/** Estados e propriedades globais (suportados pelo papel abstrato roletype). */
export const ARIA_GLOBAL_PROPS: readonly string[] = ["aria-atomic","aria-busy","aria-controls","aria-current","aria-describedby","aria-details","aria-dropeffect","aria-flowto","aria-grabbed","aria-hidden","aria-keyshortcuts","aria-label","aria-labelledby","aria-live","aria-owns","aria-relevant","aria-roledescription"];

export const ARIA_PROPS: Readonly<Record<string, AriaPropDef>> = {
  "aria-activedescendant": {
    "type": "id"
  },
  "aria-atomic": {
    "type": "boolean"
  },
  "aria-autocomplete": {
    "type": "token",
    "values": [
      "inline",
      "list",
      "both",
      "none"
    ]
  },
  "aria-braillelabel": {
    "type": "string"
  },
  "aria-brailleroledescription": {
    "type": "string"
  },
  "aria-busy": {
    "type": "boolean"
  },
  "aria-checked": {
    "type": "tristate"
  },
  "aria-colcount": {
    "type": "integer"
  },
  "aria-colindex": {
    "type": "integer"
  },
  "aria-colspan": {
    "type": "integer"
  },
  "aria-controls": {
    "type": "idlist"
  },
  "aria-current": {
    "type": "token",
    "values": [
      "page",
      "step",
      "location",
      "date",
      "time",
      "true",
      "false"
    ]
  },
  "aria-describedby": {
    "type": "idlist"
  },
  "aria-description": {
    "type": "string"
  },
  "aria-details": {
    "type": "id"
  },
  "aria-disabled": {
    "type": "boolean"
  },
  "aria-dropeffect": {
    "type": "tokenlist",
    "values": [
      "copy",
      "execute",
      "link",
      "move",
      "none",
      "popup"
    ]
  },
  "aria-errormessage": {
    "type": "id"
  },
  "aria-expanded": {
    "type": "boolean",
    "allowUndefined": true
  },
  "aria-flowto": {
    "type": "idlist"
  },
  "aria-grabbed": {
    "type": "boolean",
    "allowUndefined": true
  },
  "aria-haspopup": {
    "type": "token",
    "values": [
      "false",
      "true",
      "menu",
      "listbox",
      "tree",
      "grid",
      "dialog"
    ]
  },
  "aria-hidden": {
    "type": "boolean",
    "allowUndefined": true
  },
  "aria-invalid": {
    "type": "token",
    "values": [
      "grammar",
      "false",
      "spelling",
      "true"
    ]
  },
  "aria-keyshortcuts": {
    "type": "string"
  },
  "aria-label": {
    "type": "string"
  },
  "aria-labelledby": {
    "type": "idlist"
  },
  "aria-level": {
    "type": "integer"
  },
  "aria-live": {
    "type": "token",
    "values": [
      "assertive",
      "off",
      "polite"
    ]
  },
  "aria-modal": {
    "type": "boolean"
  },
  "aria-multiline": {
    "type": "boolean"
  },
  "aria-multiselectable": {
    "type": "boolean"
  },
  "aria-orientation": {
    "type": "token",
    "values": [
      "vertical",
      "undefined",
      "horizontal"
    ]
  },
  "aria-owns": {
    "type": "idlist"
  },
  "aria-placeholder": {
    "type": "string"
  },
  "aria-posinset": {
    "type": "integer"
  },
  "aria-pressed": {
    "type": "tristate"
  },
  "aria-readonly": {
    "type": "boolean"
  },
  "aria-relevant": {
    "type": "tokenlist",
    "values": [
      "additions",
      "all",
      "removals",
      "text"
    ]
  },
  "aria-required": {
    "type": "boolean"
  },
  "aria-roledescription": {
    "type": "string"
  },
  "aria-rowcount": {
    "type": "integer"
  },
  "aria-rowindex": {
    "type": "integer"
  },
  "aria-rowspan": {
    "type": "integer"
  },
  "aria-selected": {
    "type": "boolean",
    "allowUndefined": true
  },
  "aria-setsize": {
    "type": "integer"
  },
  "aria-sort": {
    "type": "token",
    "values": [
      "ascending",
      "descending",
      "none",
      "other"
    ]
  },
  "aria-valuemax": {
    "type": "number"
  },
  "aria-valuemin": {
    "type": "number"
  },
  "aria-valuenow": {
    "type": "number"
  },
  "aria-valuetext": {
    "type": "string"
  }
};

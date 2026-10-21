/** CSS do overlay (vive dentro do Shadow DOM, isolado da página). */
export const OVERLAY_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.layer {
  position: fixed; inset: 0; width: 0; height: 0; overflow: visible;
  pointer-events: none;
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: #1b1b1b;
}
.outline {
  position: fixed; left: 0; top: 0; pointer-events: none;
  border: 3px solid #b00020;
  box-shadow: 0 0 0 1px #fff, inset 0 0 0 1px #fff;
  border-radius: 2px;
}
.outline.recommendation { border: 2px dashed #0b57d0; }
.outline.highlight { box-shadow: 0 0 0 4px #ffdd00, inset 0 0 0 1px #fff; }
.badge {
  position: fixed; left: 0; top: 0; pointer-events: auto;
  display: inline-flex; gap: 4px; align-items: center;
  margin: 0; padding: 1px 6px; min-height: 20px;
  border: 1px solid #fff; border-radius: 10px;
  background: #b00020; color: #fff;
  font: 600 12px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  cursor: pointer; white-space: nowrap;
}
.badge.recommendation { background: #0b57d0; }
.badge:focus-visible, .badge:focus { outline: 3px solid #ffdd00; outline-offset: 1px; }
.badge[hidden], .outline[hidden], .card[hidden] { display: none; }
.page-badge { position: fixed; right: 8px; top: 8px; left: auto; }
.card {
  position: fixed; left: 0; top: 0; pointer-events: auto;
  width: min(380px, calc(100vw - 16px)); max-height: min(70vh, 520px); overflow: auto;
  background: #fff; color: #1b1b1b;
  border: 2px solid #1b1b1b; border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,.25);
  padding: 12px 14px;
}
.card:focus { outline: 3px solid #ffdd00; outline-offset: 2px; }
.card h2 { font-size: 15px; margin: 0 28px 8px 0; line-height: 1.3; }
.card h3 { font-size: 13px; margin: 10px 0 2px; color: #333; text-transform: uppercase; letter-spacing: .02em; }
.card p { margin: 0 0 4px; }
.card .occ + .occ { border-top: 1px solid #ccc; margin-top: 10px; padding-top: 8px; }
.card .crit { font-weight: 700; }
.card .tag { display: inline-block; font-size: 12px; padding: 0 6px; border-radius: 8px; background: #b00020; color: #fff; margin-left: 4px; }
.card .tag.recommendation { background: #0b57d0; }
.card pre {
  margin: 4px 0; padding: 8px; background: #f3f3f3; color: #1b1b1b;
  border-radius: 4px; overflow-x: auto; white-space: pre-wrap; word-break: break-word;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
}
.card a { color: #0b57d0; text-decoration: underline; }
.card a:focus-visible, .card button:focus-visible { outline: 3px solid #ffdd00; outline-offset: 1px; }
.card .close {
  position: absolute; right: 8px; top: 8px; width: 28px; height: 28px;
  border: 1px solid #1b1b1b; border-radius: 4px; background: #fff; color: #1b1b1b;
  font: 700 16px/1 system-ui, sans-serif; cursor: pointer;
}
.card .note { font-size: 12px; color: #444; margin-top: 6px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

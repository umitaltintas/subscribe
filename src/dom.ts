import { esc } from "./utils";
import { icons } from "./icons";
import { sanitize } from "./trusted-types";

export const $ = (sel: string): Element | null => document.querySelector(sel);
export const $$ = (sel: string): NodeListOf<Element> =>
  document.querySelectorAll(sel);

export const setHTML = (el: Element, html: string): void => {
  el.innerHTML = sanitize(html);
};

export const showToast = (
  msg: string,
  type: "success" | "error" | "info" = "success",
  duration = 2500,
): void => {
  $(".ytc-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `ytc-toast ${type}`;
  const icon =
    type === "success"
      ? icons.circleCheck
      : type === "error"
        ? icons.circleX
        : icons.info;
  setHTML(toast, `<span>${icon}</span><span>${esc(msg)}</span>`);
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, duration);
};

let styleInjected = false;

export const injectStyles = (): void => {
  if (styleInjected) return;
  styleInjected = true;

  const css = `
    :root{--ytc-primary:#3ea6ff;--ytc-bg:#0f0f0f;--ytc-card:#181818;--ytc-border:rgba(255,255,255,.1);--ytc-text:#fff;--ytc-muted:rgba(255,255,255,.6);--ytc-danger:#ff4444;--ytc-success:#44ff88}

    .ytc-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
    .ytc-icon svg{width:16px;height:16px}
    .ytc-icon-sm svg{width:14px;height:14px}
    .ytc-icon-lg svg{width:20px;height:20px}

    .ytc-btn{background:rgba(62,166,255,.15);color:var(--ytc-primary);border:0;padding:8px 14px;border-radius:18px;font:500 14px Roboto,sans-serif;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
    .ytc-btn:hover{background:rgba(62,166,255,.25);transform:translateY(-1px)}
    .ytc-btn.secondary{background:rgba(255,255,255,.1);color:#fff}
    .ytc-btn.danger{background:rgba(255,68,68,.15);color:var(--ytc-danger)}
    .ytc-btn.small{padding:6px 10px;font-size:12px;border-radius:12px}
    .ytc-btn.icon-only{padding:8px;border-radius:50%}
    .ytc-btn:disabled{opacity:.4;cursor:not-allowed}

    .ytc-navbar-btn{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:transparent;border:0;cursor:pointer;margin-right:8px;position:relative;transition:background .2s}
    .ytc-navbar-btn:hover{background:rgba(255,255,255,.1)}
    .ytc-navbar-btn svg{width:24px;height:24px;fill:#fff}
    .ytc-badge{position:absolute;top:0;right:0;background:var(--ytc-primary);color:#000;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px}

    .ytc-toast{position:fixed;right:16px;bottom:16px;z-index:999999;background:var(--ytc-card);color:#fff;border-radius:12px;padding:12px 16px;box-shadow:0 4px 24px rgba(0,0,0,.5);font:13px Roboto,sans-serif;opacity:0;transform:translateY(10px);transition:.2s;display:flex;align-items:center;gap:10px;max-width:400px}
    .ytc-toast.show{opacity:1;transform:translateY(0)}
    .ytc-toast.success{border-left:3px solid var(--ytc-success)}
    .ytc-toast.error{border-left:3px solid var(--ytc-danger)}

    .ytc-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999998;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)}
    .ytc-modal{background:var(--ytc-bg);border-radius:16px;width:min(900px,95vw);max-height:90vh;overflow:hidden;color:var(--ytc-text);font-family:Roboto,sans-serif;display:flex;flex-direction:column;border:1px solid var(--ytc-border)}

    .ytc-modal-header{padding:16px 20px;border-bottom:1px solid var(--ytc-border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;background:var(--ytc-card)}
    .ytc-modal-header h2{margin:0;font-size:18px;display:flex;align-items:center;gap:10px}
    .ytc-modal-close{background:0;border:0;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px;line-height:1}
    .ytc-modal-close:hover{background:rgba(255,255,255,.1)}

    .ytc-modal-body{padding:0;overflow-y:auto;flex:1}
    .ytc-modal-footer{padding:12px 20px;border-top:1px solid var(--ytc-border);display:flex;gap:8px;justify-content:flex-end;flex-shrink:0;background:var(--ytc-card)}

    .ytc-tabs{display:flex;border-bottom:1px solid var(--ytc-border);background:var(--ytc-card);padding:0 16px;flex-shrink:0}
    .ytc-tab{padding:12px 16px;background:0;border:0;color:var(--ytc-muted);cursor:pointer;font-size:14px;font-weight:500;border-bottom:2px solid transparent;transition:all .2s}
    .ytc-tab:hover{color:#fff}
    .ytc-tab.active{color:var(--ytc-primary);border-bottom-color:var(--ytc-primary)}

    .ytc-tab-content{display:none;padding:16px 20px}
    .ytc-tab-content.active{display:block}

    .ytc-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px}
    .ytc-stat-card{background:var(--ytc-card);border:1px solid var(--ytc-border);border-radius:12px;padding:16px;text-align:center}
    .ytc-stat-value{font-size:28px;font-weight:700;color:var(--ytc-primary);margin-bottom:4px}
    .ytc-stat-label{font-size:12px;color:var(--ytc-muted);text-transform:uppercase;letter-spacing:.5px}

    .ytc-section{margin-bottom:20px}
    .ytc-section-title{font-size:14px;font-weight:600;color:var(--ytc-muted);margin-bottom:12px;display:flex;align-items:center;gap:8px}

    .ytc-toolbar{display:flex;gap:10px;flex-wrap:wrap;padding:16px 20px;background:var(--ytc-card);border-bottom:1px solid var(--ytc-border);align-items:center}
    .ytc-search{flex:1;min-width:200px;padding:10px 14px;border:1px solid var(--ytc-border);border-radius:10px;background:rgba(255,255,255,.05);color:#fff;font-size:14px;outline:none}
    .ytc-search:focus{border-color:var(--ytc-primary);background:rgba(255,255,255,.08)}
    .ytc-search::placeholder{color:var(--ytc-muted)}

    .ytc-filter{padding:8px 12px;border:1px solid var(--ytc-border);border-radius:10px;background:rgba(255,255,255,.05);color:#fff;font-size:13px;cursor:pointer}
    .ytc-filter:hover{background:rgba(255,255,255,.1)}
    .ytc-filter.active{background:var(--ytc-primary);color:#000;border-color:var(--ytc-primary)}

    .ytc-search-hint{font-size:11px;color:var(--ytc-muted);padding:4px 0}
    .ytc-search-stats{font-size:11px;color:var(--ytc-muted);margin-left:auto;white-space:nowrap}

    .ytc-list{padding:16px 20px}
    .ytc-item{display:flex;gap:14px;padding:14px;border:1px solid var(--ytc-border);border-radius:14px;margin-bottom:10px;background:var(--ytc-card);transition:all .15s}
    .ytc-item:hover{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.15)}
    .ytc-item.favorite{border-color:rgba(255,204,0,.3);background:rgba(255,204,0,.05)}

    .ytc-thumb{width:140px;height:79px;border-radius:10px;object-fit:cover;background:#222;flex-shrink:0}
    .ytc-info{flex:1;min-width:0;display:flex;flex-direction:column}
    .ytc-title{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px}
    .ytc-title a{color:#fff;text-decoration:none}
    .ytc-title a:hover{color:var(--ytc-primary)}
    .ytc-meta{font-size:12px;color:var(--ytc-muted);display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:8px}
    .ytc-tags{display:flex;flex-wrap:wrap;gap:6px}
    .ytc-tag{background:rgba(62,166,255,.15);color:var(--ytc-primary);padding:3px 8px;border-radius:6px;font-size:11px;font-weight:500}
    .ytc-tag.removable{cursor:pointer}
    .ytc-tag.removable:hover{background:rgba(255,68,68,.2);color:var(--ytc-danger)}

    .ytc-match-preview{font-size:11px;color:var(--ytc-muted);margin-top:6px;padding:6px 8px;background:rgba(0,0,0,.3);border-radius:6px;max-height:40px;overflow:hidden}
    .ytc-match-preview mark{background:rgba(62,166,255,.4);color:#fff;padding:0 2px;border-radius:2px}

    .ytc-score{font-size:10px;color:var(--ytc-muted);background:rgba(255,255,255,.1);padding:2px 6px;border-radius:4px}

    .ytc-actions{display:flex;flex-direction:column;gap:6px;flex-shrink:0}
    .ytc-action-btn{background:rgba(255,255,255,.08);border:0;color:#fff;padding:8px;border-radius:8px;cursor:pointer;font-size:14px;transition:all .15s}
    .ytc-action-btn:hover{background:rgba(255,255,255,.15)}
    .ytc-action-btn.fav{color:#888}
    .ytc-action-btn.fav.active{color:#ffcc00}
    .ytc-action-btn.delete:hover{background:rgba(255,68,68,.2);color:var(--ytc-danger)}

    .ytc-empty{text-align:center;padding:60px 20px;color:var(--ytc-muted)}
    .ytc-empty-icon{font-size:56px;margin-bottom:16px;opacity:.5}
    .ytc-empty-text{font-size:15px;margin-bottom:8px}
    .ytc-empty-hint{font-size:13px;opacity:.7}

    .ytc-options{display:flex;flex-direction:column;gap:10px;margin-bottom:20px}
    .ytc-option{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--ytc-border);border-radius:12px;cursor:pointer;transition:all .15s}
    .ytc-option:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.2)}
    .ytc-option.selected{background:rgba(62,166,255,.1);border-color:var(--ytc-primary)}
    .ytc-option input{accent-color:var(--ytc-primary);width:18px;height:18px}
    .ytc-option-text{flex:1}
    .ytc-option-title{font-size:14px;font-weight:500}
    .ytc-option-desc{font-size:12px;color:var(--ytc-muted);margin-top:2px}

    .ytc-tags-input{display:flex;flex-wrap:wrap;gap:8px;padding:10px;border:1px solid var(--ytc-border);border-radius:10px;background:rgba(255,255,255,.03);min-height:44px;align-items:center}
    .ytc-tags-input input{flex:1;min-width:100px;background:0;border:0;color:#fff;outline:0;font-size:13px}
    .ytc-tags-input input::placeholder{color:var(--ytc-muted)}

    .ytc-preview{background:rgba(0,0,0,.3);border:1px solid var(--ytc-border);border-radius:10px;padding:14px;max-height:300px;overflow-y:auto;font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;color:var(--ytc-muted);white-space:pre-wrap}
    .ytc-preview mark{background:rgba(62,166,255,.3);color:#fff;padding:1px 3px;border-radius:3px}

    .ytc-loading{display:flex;align-items:center;justify-content:center;padding:40px;color:var(--ytc-muted)}
    .ytc-spinner{width:24px;height:24px;border:3px solid var(--ytc-border);border-top-color:var(--ytc-primary);border-radius:50%;animation:ytc-spin .8s linear infinite;margin-right:12px}
    @keyframes ytc-spin{to{transform:rotate(360deg)}}

    @media(max-width:600px){
      .ytc-item{flex-direction:column}
      .ytc-thumb{width:100%;height:auto;aspect-ratio:16/9}
      .ytc-actions{flex-direction:row}
      .ytc-stats-grid{grid-template-columns:repeat(2,1fr)}
    }
  `;

  document.head.appendChild(
    Object.assign(document.createElement("style"), { textContent: css }),
  );
};

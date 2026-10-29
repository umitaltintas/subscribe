import { esc } from "./utils";
import { icons } from "./icons";
import { sanitize } from "./trusted-types";

export const $ = (sel: string): Element | null => document.querySelector(sel);
export const $$ = (sel: string): NodeListOf<Element> => document.querySelectorAll(sel);

export const setHTML = (el: Element, html: string): void => {
  el.innerHTML = sanitize(html);
};

export interface ToastAction {
  label: string;
  onClick: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const showToast = (
  msg: string,
  type: "success" | "error" | "info" = "success",
  duration?: number,
  action?: ToastAction,
): void => {
  injectStyles();
  $(".ytc-toast")?.remove();
  clearTimeout(toastTimer);
  const toast = document.createElement("div");
  toast.className = `ytc-toast ${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  const icon = type === "success" ? icons.circleCheck : type === "error" ? icons.circleX : icons.info;
  setHTML(
    toast,
    `<span class="ytc-toast-icon">${icon}</span><span class="ytc-toast-msg">${esc(msg)}</span>${
      action ? `<button class="ytc-toast-action">${esc(action.label)}</button>` : ""
    }<button class="ytc-toast-close" aria-label="Kapat">${icons.x}</button>`,
  );
  const dismiss = () => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  };
  toast.querySelector(".ytc-toast-action")?.addEventListener("click", () => {
    dismiss();
    action?.onClick();
  });
  toast.querySelector(".ytc-toast-close")?.addEventListener("click", dismiss);
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  // Errors stay longer; they usually need to be read.
  const ms = duration ?? (type === "error" ? 7000 : action ? 6000 : 2800);
  toastTimer = setTimeout(dismiss, ms);
};

let styleInjected = false;

export const injectStyles = (): void => {
  if (styleInjected) return;
  styleInjected = true;

  const css = `
    html[dark]{--ytc-bg:#0f0f11;--ytc-card:#17171a;--ytc-elev:#1e1e22;--ytc-border:rgba(255,255,255,.1);--ytc-border-strong:rgba(255,255,255,.18);--ytc-text:#f4f4f5;--ytc-muted:rgba(255,255,255,.62);--ytc-faint:rgba(255,255,255,.4);--ytc-hover:rgba(255,255,255,.07);--ytc-pill:rgba(255,255,255,.1);--ytc-pill-hover:rgba(255,255,255,.2);--ytc-input:rgba(255,255,255,.05);--ytc-primary:#ff2d55;--ytc-primary-text:#ff7090;--ytc-primary-soft:rgba(255,45,85,.14);--ytc-primary-soft-2:rgba(255,45,85,.24);--ytc-accent:#bf6bf0;--ytc-success:#32d74b;--ytc-success-soft:rgba(50,215,75,.14);--ytc-danger:#ff453a;--ytc-danger-soft:rgba(255,69,58,.16);--ytc-warn:#ffd60a;--ytc-shadow:0 12px 48px rgba(0,0,0,.6);--ytc-overlay:rgba(0,0,0,.66)}
    html:not([dark]){--ytc-bg:#ffffff;--ytc-card:#f6f6f7;--ytc-elev:#ffffff;--ytc-border:rgba(0,0,0,.1);--ytc-border-strong:rgba(0,0,0,.2);--ytc-text:#0f0f0f;--ytc-muted:rgba(0,0,0,.6);--ytc-faint:rgba(0,0,0,.4);--ytc-hover:rgba(0,0,0,.05);--ytc-pill:rgba(0,0,0,.05);--ytc-pill-hover:rgba(0,0,0,.1);--ytc-input:rgba(0,0,0,.03);--ytc-primary:#e5173f;--ytc-primary-text:#cc1038;--ytc-primary-soft:rgba(229,23,63,.09);--ytc-primary-soft-2:rgba(229,23,63,.18);--ytc-accent:#9b3fd0;--ytc-success:#1f9d3a;--ytc-success-soft:rgba(31,157,58,.12);--ytc-danger:#d70015;--ytc-danger-soft:rgba(215,0,21,.1);--ytc-warn:#a07800;--ytc-shadow:0 12px 48px rgba(0,0,0,.18);--ytc-overlay:rgba(0,0,0,.45)}
    :root{--ytc-gradient:linear-gradient(135deg,#ff3b30 0%,#ff2d55 50%,#af52de 100%)}

    .ytc-modal-bg,.ytc-toast,.ytc-menu,.ytc-video-actions{font-family:Roboto,Arial,sans-serif;color:var(--ytc-text);-webkit-font-smoothing:antialiased}
    .ytc-modal-bg *,.ytc-menu *,.ytc-video-actions *{box-sizing:border-box}
    .ytc-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
    .ytc-modal-bg [hidden],.ytc-menu [hidden],.ytc-video-actions [hidden]{display:none!important}
    .ytc-sr-only{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

    /* Buttons */
    .ytc-btn{background:var(--ytc-primary-soft);color:var(--ytc-primary-text);border:0;padding:8px 14px;border-radius:18px;font:500 14px Roboto,Arial,sans-serif;cursor:pointer;transition:background .15s,transform .15s,opacity .15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;text-decoration:none;line-height:1.2}
    .ytc-btn:hover{background:var(--ytc-primary-soft-2)}
    .ytc-btn:active{transform:scale(.97)}
    .ytc-btn.primary{background:var(--ytc-gradient);color:#fff;box-shadow:0 2px 12px rgba(255,45,85,.3)}
    .ytc-btn.primary:hover{filter:brightness(1.08)}
    .ytc-btn.secondary{background:var(--ytc-pill);color:var(--ytc-text)}
    .ytc-btn.secondary:hover{background:var(--ytc-pill-hover)}
    .ytc-btn.ghost{background:transparent;color:var(--ytc-muted)}
    .ytc-btn.ghost:hover{background:var(--ytc-hover);color:var(--ytc-text)}
    .ytc-btn.danger{background:var(--ytc-danger-soft);color:var(--ytc-danger)}
    .ytc-btn.small{padding:6px 11px;font-size:12.5px;border-radius:14px}
    .ytc-btn.icon-only{padding:8px;border-radius:50%}
    .ytc-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
    .ytc-btn svg{width:16px;height:16px}
    .ytc-btn.small svg{width:14px;height:14px}
    .ytc-btn:focus-visible,.ytc-pill:focus-visible,.ytc-tab:focus-visible,.ytc-action-btn:focus-visible,.ytc-menu-item:focus-visible,.ytc-opt-chip:focus-visible,.ytc-ts:focus-visible,.ytc-modal-close:focus-visible,.ytc-navbar-btn:focus-visible,.ytc-tag:focus-visible{outline:2px solid var(--ytc-primary);outline-offset:2px}

    /* Masthead */
    .ytc-navbar-btn{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:transparent;border:0;cursor:pointer;margin-right:8px;position:relative;transition:background .2s;color:var(--ytc-text)}
    .ytc-navbar-btn:hover{background:var(--ytc-hover)}
    .ytc-navbar-btn svg{width:24px;height:24px}
    .ytc-badge{position:absolute;top:0;right:0;background:var(--ytc-gradient);color:#fff;font:700 10px Roboto,Arial,sans-serif;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px}

    /* Video page actions */
    .ytc-video-actions{display:inline-flex;align-items:center;gap:8px;margin-left:12px;flex-wrap:wrap}
    .ytc-pill{height:36px;padding:0 14px;border-radius:18px;border:0;background:var(--ytc-pill);color:var(--ytc-text);font:500 14px Roboto,Arial,sans-serif;display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;transition:background .15s;background-repeat:no-repeat}
    .ytc-pill:hover{background-color:var(--ytc-pill-hover)}
    .ytc-pill svg{width:18px;height:18px;color:var(--ytc-primary)}
    .ytc-pill.active{background-color:var(--ytc-primary-soft-2);color:var(--ytc-primary-text)}
    .ytc-pill.running{background-image:linear-gradient(90deg,var(--ytc-primary-soft-2) var(--p,0%),transparent var(--p,0%))}
    .ytc-pill .ytc-pill-sub{font-size:12px;color:var(--ytc-muted);font-weight:400}
    .ytc-split{display:inline-flex;border-radius:18px;overflow:hidden}
    .ytc-split .ytc-pill{border-radius:0}
    .ytc-split .ytc-pill:first-child{border-radius:18px 0 0 18px;padding-right:10px}
    .ytc-split .ytc-pill.caret{border-radius:0 18px 18px 0;padding:0 10px 0 8px;border-left:1px solid var(--ytc-border);gap:2px;font-size:12px;color:var(--ytc-muted)}
    .ytc-split .ytc-pill.caret svg{width:14px;height:14px;color:var(--ytc-muted)}

    /* Dropdown menu */
    .ytc-menu{position:fixed;z-index:1000000;min-width:220px;max-height:min(420px,70vh);overflow-y:auto;background:var(--ytc-elev);border:1px solid var(--ytc-border);border-radius:12px;box-shadow:var(--ytc-shadow);padding:6px;animation:ytc-pop .12s ease-out}
    .ytc-menu-item{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;background:transparent;color:var(--ytc-text);font:14px Roboto,Arial,sans-serif;text-align:left;border-radius:8px;cursor:pointer}
    .ytc-menu-item:hover,.ytc-menu-item:focus{background:var(--ytc-hover);outline:none}
    .ytc-menu-item:disabled{opacity:.45;cursor:default}
    .ytc-menu-check{width:16px;display:inline-flex;color:var(--ytc-primary)}
    .ytc-menu-check svg{width:16px;height:16px}
    .ytc-menu-label{flex:1}
    .ytc-menu-hint{font-size:11.5px;color:var(--ytc-muted)}
    .ytc-menu-sep{height:1px;background:var(--ytc-border);margin:6px 4px}
    .ytc-menu-heading{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--ytc-faint);padding:8px 10px 4px}

    /* Toast */
    .ytc-toast{position:fixed;right:20px;bottom:20px;z-index:1000001;background:var(--ytc-elev);border:1px solid var(--ytc-border);border-radius:12px;padding:10px 10px 10px 14px;box-shadow:var(--ytc-shadow);font-size:13.5px;opacity:0;transform:translateY(10px);transition:opacity .2s,transform .2s;display:flex;align-items:center;gap:10px;max-width:min(440px,calc(100vw - 40px))}
    .ytc-toast.show{opacity:1;transform:translateY(0)}
    .ytc-toast-icon{display:inline-flex}
    .ytc-toast.success .ytc-toast-icon{color:var(--ytc-success)}
    .ytc-toast.error .ytc-toast-icon{color:var(--ytc-danger)}
    .ytc-toast.info .ytc-toast-icon{color:var(--ytc-primary)}
    .ytc-toast-msg{flex:1;line-height:1.4}
    .ytc-toast-action{background:var(--ytc-primary-soft);color:var(--ytc-primary-text);border:0;border-radius:12px;padding:6px 10px;font:500 12.5px Roboto,Arial,sans-serif;cursor:pointer;white-space:nowrap}
    .ytc-toast-close{background:none;border:0;color:var(--ytc-faint);cursor:pointer;padding:4px;border-radius:6px;display:inline-flex}
    .ytc-toast-close:hover{color:var(--ytc-text);background:var(--ytc-hover)}
    .ytc-toast-close svg{width:14px;height:14px}

    /* Modal */
    .ytc-modal-bg{position:fixed;inset:0;background:var(--ytc-overlay);z-index:999998;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px);animation:ytc-fade .15s ease-out}
    .ytc-modal{background:var(--ytc-bg);border-radius:18px;width:min(900px,95vw);max-height:90vh;overflow:hidden;color:var(--ytc-text);display:flex;flex-direction:column;border:1px solid var(--ytc-border);box-shadow:var(--ytc-shadow);animation:ytc-pop .18s ease-out}
    .ytc-modal-header{padding:14px 16px 14px 20px;border-bottom:1px solid var(--ytc-border);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-shrink:0}
    .ytc-modal-header h2{margin:0;font-size:17px;font-weight:600;display:flex;align-items:center;gap:10px;min-width:0}
    .ytc-modal-header h2 svg{color:var(--ytc-primary);flex-shrink:0}
    .ytc-modal-title-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ytc-modal-close{background:0;border:0;color:var(--ytc-muted);cursor:pointer;padding:6px;border-radius:50%;display:inline-flex;flex-shrink:0}
    .ytc-modal-close:hover{background:var(--ytc-hover);color:var(--ytc-text)}
    .ytc-modal-body{padding:0;overflow-y:auto;flex:1;min-height:0}
    .ytc-modal-body.padded,.ytc-pad{padding:20px}
    .ytc-modal-footer{padding:12px 20px;border-top:1px solid var(--ytc-border);display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-shrink:0;flex-wrap:wrap}
    .ytc-footer-spacer{flex:1}
    .ytc-confirm-text{margin:0;padding:20px;font-size:14px;line-height:1.6;color:var(--ytc-muted)}

    /* Tabs */
    .ytc-tabs{display:flex;border-bottom:1px solid var(--ytc-border);padding:0 12px;flex-shrink:0;overflow-x:auto;scrollbar-width:none}
    .ytc-tab{padding:12px 14px;background:0;border:0;color:var(--ytc-muted);cursor:pointer;font:500 14px Roboto,Arial,sans-serif;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
    .ytc-tab svg{width:16px;height:16px}
    .ytc-tab:hover{color:var(--ytc-text)}
    .ytc-tab.active{color:var(--ytc-text);border-bottom-color:var(--ytc-primary)}
    .ytc-tab .ytc-count{font-size:11px;background:var(--ytc-pill);border-radius:8px;padding:1px 6px;color:var(--ytc-muted)}
    .ytc-tab-content{display:none}
    .ytc-tab-content.active{display:block}

    /* Stats */
    .ytc-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px}
    .ytc-stat-card{background:var(--ytc-card);border:1px solid var(--ytc-border);border-radius:14px;padding:16px;text-align:center}
    .ytc-stat-value{font-size:26px;font-weight:700;background:var(--ytc-gradient);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:4px}
    .ytc-stat-label{font-size:11.5px;color:var(--ytc-muted);text-transform:uppercase;letter-spacing:.5px}
    .ytc-section{margin-bottom:22px}
    .ytc-section-title{font-size:13px;font-weight:600;color:var(--ytc-muted);margin-bottom:10px;display:flex;align-items:center;gap:8px;text-transform:uppercase;letter-spacing:.4px}
    .ytc-section-title svg{width:15px;height:15px}
    .ytc-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--ytc-border)}
    .ytc-row img{width:64px;border-radius:6px}
    .ytc-row-main{flex:1;min-width:0}
    .ytc-row-title{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ytc-row-sub{font-size:11.5px;color:var(--ytc-muted)}
    .ytc-prose{font-size:13px;color:var(--ytc-muted);line-height:1.7}
    .ytc-prose p{margin:0 0 4px}

    /* Toolbar, search, filters */
    .ytc-toolbar{display:flex;gap:10px;flex-wrap:wrap;padding:14px 20px;border-bottom:1px solid var(--ytc-border);align-items:center}
    .ytc-search,.ytc-input{flex:1;min-width:200px;padding:9px 14px;border:1px solid var(--ytc-border);border-radius:10px;background:var(--ytc-input);color:var(--ytc-text);font:14px Roboto,Arial,sans-serif;outline:none;transition:border-color .15s}
    .ytc-input{width:100%;min-width:0}
    .ytc-search:focus,.ytc-input:focus{border-color:var(--ytc-primary)}
    .ytc-search::placeholder,.ytc-input::placeholder{color:var(--ytc-faint)}
    .ytc-filter{padding:8px 12px;border:1px solid var(--ytc-border);border-radius:10px;background:var(--ytc-input);color:var(--ytc-text);font:13px Roboto,Arial,sans-serif;cursor:pointer;max-width:220px}
    .ytc-filter option{background:var(--ytc-elev);color:var(--ytc-text)}
    .ytc-filter:hover{border-color:var(--ytc-border-strong)}
    .ytc-search-hint{font-size:11.5px;color:var(--ytc-muted);padding:8px 20px 0;display:flex;align-items:center;gap:6px}
    .ytc-search-hint svg{width:13px;height:13px}

    /* Lists */
    .ytc-list{padding:14px 20px}
    .ytc-item{display:flex;gap:14px;padding:12px;border:1px solid var(--ytc-border);border-radius:14px;margin-bottom:10px;background:var(--ytc-card);transition:border-color .15s,background .15s}
    .ytc-item:hover{border-color:var(--ytc-border-strong)}
    .ytc-item.favorite{border-color:rgba(255,204,0,.35)}
    .ytc-thumb{width:144px;height:81px;border-radius:10px;object-fit:cover;background:var(--ytc-pill);flex-shrink:0}
    .ytc-info{flex:1;min-width:0;display:flex;flex-direction:column}
    .ytc-title{font-size:14px;font-weight:500;margin-bottom:6px;display:flex;align-items:center;gap:8px;min-width:0}
    .ytc-title a{color:var(--ytc-text);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ytc-title a:hover{color:var(--ytc-primary-text)}
    .ytc-meta{font-size:12px;color:var(--ytc-muted);display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:8px}
    .ytc-meta span{display:inline-flex;align-items:center;gap:4px}
    .ytc-meta svg{width:13px;height:13px}
    .ytc-tags{display:flex;flex-wrap:wrap;gap:6px}
    .ytc-tag{background:var(--ytc-primary-soft);color:var(--ytc-primary-text);padding:3px 8px;border-radius:6px;font:500 11.5px Roboto,Arial,sans-serif;display:inline-flex;align-items:center;gap:4px;border:0}
    .ytc-tag svg{width:12px;height:12px}
    .ytc-tag.lang{background:var(--ytc-success-soft);color:var(--ytc-success)}
    .ytc-tag.neutral{background:var(--ytc-pill);color:var(--ytc-muted)}
    button.ytc-tag{cursor:pointer}
    button.ytc-tag:hover{filter:brightness(1.15)}
    .ytc-tag.removable{cursor:pointer}
    .ytc-tag.removable:hover{background:var(--ytc-danger-soft);color:var(--ytc-danger)}
    .ytc-match-preview{font-size:11.5px;color:var(--ytc-muted);margin-top:6px;padding:6px 8px;background:var(--ytc-input);border-radius:6px;max-height:42px;overflow:hidden;line-height:1.5}
    mark.ytc-mark,.ytc-match-preview mark{background:rgba(255,214,10,.35);color:inherit;padding:0 2px;border-radius:2px}
    .ytc-score{font-size:10.5px;color:var(--ytc-muted);background:var(--ytc-pill);padding:2px 6px;border-radius:4px;flex-shrink:0}
    .ytc-actions{display:flex;flex-direction:column;gap:6px;flex-shrink:0}
    .ytc-action-btn{background:var(--ytc-pill);border:0;color:var(--ytc-text);padding:8px;border-radius:8px;cursor:pointer;display:inline-flex;transition:background .15s,color .15s}
    .ytc-action-btn svg{width:16px;height:16px}
    .ytc-action-btn:hover{background:var(--ytc-pill-hover)}
    .ytc-action-btn.fav{color:var(--ytc-faint)}
    .ytc-action-btn.fav.active{color:#ffcc00}
    .ytc-action-btn.delete:hover{background:var(--ytc-danger-soft);color:var(--ytc-danger)}

    .ytc-empty{text-align:center;padding:56px 20px;color:var(--ytc-muted)}
    .ytc-empty-icon{margin-bottom:14px;opacity:.5}
    .ytc-empty-icon svg{width:44px;height:44px}
    .ytc-empty-text{font-size:15px;margin-bottom:6px;color:var(--ytc-text)}
    .ytc-empty-hint{font-size:13px;max-width:420px;margin:0 auto 14px;line-height:1.5}

    /* Options (copy modal) */
    .ytc-options{display:flex;flex-direction:column;gap:10px}
    .ytc-option{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--ytc-border);border-radius:12px;cursor:pointer;transition:background .15s,border-color .15s}
    .ytc-option:hover{background:var(--ytc-hover)}
    .ytc-option.selected,.ytc-option:has(input:checked){background:var(--ytc-primary-soft);border-color:var(--ytc-primary)}
    .ytc-option input{accent-color:var(--ytc-primary);width:18px;height:18px;margin:0}
    .ytc-option-text{flex:1}
    .ytc-option-title{font-size:14px;font-weight:500;display:flex;align-items:center;gap:6px}
    .ytc-option-desc{font-size:12px;color:var(--ytc-muted);margin-top:2px}
    .ytc-tags-input{display:flex;flex-wrap:wrap;gap:8px;padding:8px 10px;border:1px solid var(--ytc-border);border-radius:10px;background:var(--ytc-input);min-height:44px;align-items:center}
    .ytc-tags-input:focus-within{border-color:var(--ytc-primary)}
    .ytc-tags-input input{flex:1;min-width:120px;background:0;border:0;color:var(--ytc-text);outline:0;font:13.5px Roboto,Arial,sans-serif}
    .ytc-selected-tags{display:contents}
    .ytc-help kbd,.ytc-kbd{font:500 11px ui-monospace,monospace;background:var(--ytc-pill);border:1px solid var(--ytc-border);border-bottom-width:2px;border-radius:4px;padding:0 5px}
    .ytc-help{font-size:12px;color:var(--ytc-muted);margin-top:6px;line-height:1.5}

    .ytc-preview{background:var(--ytc-input);border:1px solid var(--ytc-border);border-radius:10px;padding:14px;max-height:300px;overflow-y:auto;font-size:13px;line-height:1.6;color:var(--ytc-muted);white-space:pre-wrap}

    .ytc-loading{display:flex;align-items:center;justify-content:center;padding:40px;color:var(--ytc-muted);font-size:13.5px}
    .ytc-spinner{width:20px;height:20px;border:2.5px solid var(--ytc-border);border-top-color:var(--ytc-primary);border-radius:50%;animation:ytc-spin .8s linear infinite;margin-right:10px;flex-shrink:0}
    .ytc-spinner.inline{width:14px;height:14px;border-width:2px;margin:0}

    /* Progress */
    .ytc-progress{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;background:var(--ytc-card);border:1px solid var(--ytc-border);font-size:13px;margin-bottom:12px}
    .ytc-progress-main{flex:1;min-width:0}
    .ytc-progress-label{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;color:var(--ytc-muted)}
    .ytc-progress-label strong{color:var(--ytc-text);font-weight:500}
    .ytc-progress-track{height:6px;border-radius:3px;background:var(--ytc-pill);overflow:hidden}
    .ytc-progress-bar{height:100%;background:var(--ytc-gradient);border-radius:3px;transition:width .3s ease;width:0}
    .ytc-progress-bar.indeterminate{width:35%!important;animation:ytc-indeterminate 1.2s ease-in-out infinite}

    /* Viewer */
    .ytc-modal-body.ytc-split-body{display:flex;flex-direction:column;overflow:hidden}
    .ytc-split-body > .ytc-scroll{flex:1;min-height:0;overflow-y:auto}
    .ytc-split-body > :not(.ytc-scroll){flex-shrink:0}
    .ytc-tabs.sticky{position:sticky;top:0;z-index:2;background:var(--ytc-bg)}
    .ytc-viewer-head{padding:14px 20px 0}
    .ytc-viewer-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--ytc-border)}
    .ytc-viewer-bar .ytc-search{min-width:140px;max-width:260px;padding:7px 12px;font-size:13px}
    .ytc-viewer-content{padding:12px 20px 20px}
    .ytc-callout{background:var(--ytc-card);border:1px solid var(--ytc-border);border-left:3px solid var(--ytc-accent);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;line-height:1.55;color:var(--ytc-muted)}
    .ytc-callout strong{color:var(--ytc-text)}
    .ytc-callout.warn{border-left-color:var(--ytc-warn)}
    .ytc-lines{display:flex;flex-direction:column}
    .ytc-line{display:flex;gap:12px;padding:5px 8px;margin:0 -8px;border-radius:8px;line-height:1.55;font-size:14px}
    .ytc-line:hover{background:var(--ytc-hover)}
    .ytc-line.current{background:var(--ytc-primary-soft)}
    .ytc-ts{flex-shrink:0;min-width:52px;text-align:left;background:none;border:0;padding:0;color:var(--ytc-primary-text);font:500 12.5px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;line-height:inherit;padding-top:2px}
    .ytc-ts:hover{text-decoration:underline}
    span.ytc-ts{cursor:default;color:var(--ytc-faint)}
    span.ytc-ts:hover{text-decoration:none}
    .ytc-md .ytc-ts{display:inline;min-width:0;padding:0 2px;font-size:12px;background:var(--ytc-primary-soft);border-radius:4px}
    .ytc-line-text{flex:1;min-width:0;white-space:pre-wrap;word-wrap:break-word}
    .ytc-line-orig{display:block;font-size:12.5px;color:var(--ytc-muted);margin-top:2px}
    .ytc-plain{white-space:pre-wrap;font-size:14px;line-height:1.65}

    /* Markdown */
    .ytc-md{font-size:14.5px;line-height:1.7}
    .ytc-md h1,.ytc-md h2,.ytc-md h3,.ytc-md h4{font-size:15.5px;margin:18px 0 6px;font-weight:600}
    .ytc-md h1:first-child,.ytc-md h2:first-child,.ytc-md h3:first-child{margin-top:0}
    .ytc-md p{margin:0 0 10px}
    .ytc-md ul,.ytc-md ol{margin:0 0 10px;padding-left:22px}
    .ytc-md li{margin:3px 0}
    .ytc-md strong{color:var(--ytc-text)}
    .ytc-md code{background:var(--ytc-pill);padding:1px 5px;border-radius:4px;font-size:.9em}

    /* Chips / segmented */
    .ytc-opt-group{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
    .ytc-opt-group:last-child{margin-bottom:0}
    .ytc-opt-label{font-size:11.5px;font-weight:600;color:var(--ytc-muted);text-transform:uppercase;letter-spacing:.5px}
    .ytc-opt-chips{display:flex;flex-wrap:wrap;gap:6px}
    .ytc-opt-chip{padding:7px 13px;border-radius:16px;border:1px solid var(--ytc-border);background:var(--ytc-input);color:var(--ytc-muted);font:13px Roboto,Arial,sans-serif;cursor:pointer;transition:all .15s;white-space:nowrap}
    .ytc-opt-chip:hover{border-color:var(--ytc-border-strong);color:var(--ytc-text)}
    .ytc-opt-chip[aria-pressed="true"]{background:var(--ytc-primary-soft);border-color:var(--ytc-primary);color:var(--ytc-primary-text)}
    .ytc-opt-desc{font-size:12px;color:var(--ytc-muted);min-height:16px}

    /* Settings */
    .ytc-field{margin-bottom:16px}
    .ytc-field > label,.ytc-field-label{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:500;color:var(--ytc-text);margin-bottom:6px}
    .ytc-field-label a{font-weight:400;font-size:12px;color:var(--ytc-primary-text);text-decoration:none}
    .ytc-input-wrap{position:relative;display:flex;align-items:center;gap:8px}
    .ytc-input-wrap .ytc-input{padding-right:40px}
    .ytc-input-icon{position:absolute;right:6px;background:none;border:0;color:var(--ytc-muted);cursor:pointer;padding:5px;border-radius:6px;display:flex}
    .ytc-input-wrap .ytc-btn{flex-shrink:0}
    .ytc-input-icon:hover{color:var(--ytc-text);background:var(--ytc-hover)}
    .ytc-status{font-size:12px;margin-top:6px;display:flex;align-items:center;gap:6px;color:var(--ytc-muted);min-height:16px}
    .ytc-status.ok{color:var(--ytc-success)}
    .ytc-status.err{color:var(--ytc-danger)}
    .ytc-status svg{width:14px;height:14px}
    .ytc-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .ytc-settings-group{border:1px solid var(--ytc-border);border-radius:14px;padding:16px;margin-bottom:16px;background:var(--ytc-card)}
    .ytc-settings-group h3{margin:0 0 14px;font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--ytc-muted);display:flex;align-items:center;gap:8px}
    .ytc-settings-group h3 svg{width:15px;height:15px;color:var(--ytc-primary)}
    .ytc-range{width:100%;accent-color:var(--ytc-primary)}
    .ytc-check{display:flex;align-items:center;gap:10px;font-size:13.5px;cursor:pointer}
    .ytc-check input{accent-color:var(--ytc-primary);width:16px;height:16px;margin:0}
    .ytc-sub-preview{position:relative;height:110px;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#2b2d42,#4a2a4f 60%,#1b1b1f);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;padding:12px;margin-top:4px}
    .ytc-sub-preview .ytc-subtitle-line{font-size:calc(17px * var(--ytc-sub-scale,1))}
    .ytc-sub-preview .ytc-subtitle-line.original{font-size:calc(12.5px * var(--ytc-sub-scale,1))}

    @keyframes ytc-spin{to{transform:rotate(360deg)}}
    @keyframes ytc-fade{from{opacity:0}}
    @keyframes ytc-pop{from{opacity:0;transform:scale(.97) translateY(4px)}}
    @keyframes ytc-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(290%)}}
    @media (prefers-reduced-motion:reduce){.ytc-modal-bg,.ytc-modal,.ytc-menu{animation:none}.ytc-btn:active{transform:none}}

    @media(max-width:600px){
      .ytc-item{flex-direction:column}
      .ytc-thumb{width:100%;height:auto;aspect-ratio:16/9}
      .ytc-actions{flex-direction:row}
      .ytc-stats-grid{grid-template-columns:repeat(2,1fr)}
      .ytc-grid-2{grid-template-columns:1fr}
      .ytc-viewer-bar .ytc-search{max-width:none}
    }
  `;

  const style = document.createElement("style");
  style.id = "ytc-styles";
  style.textContent = css;
  document.head.appendChild(style);
};

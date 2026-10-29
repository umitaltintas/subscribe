import { setHTML, injectStyles } from "../dom";
import { icons } from "../icons";

export interface ModalOptions {
  /** Extra class on the backdrop, also used to replace an existing instance. */
  id: string;
  title: string;
  body: string;
  footer?: string;
  width?: number;
  /** Extra class on the body element. */
  bodyClass?: string;
  onClose?: () => void;
}

export interface ModalHandle {
  backdrop: HTMLElement;
  dialog: HTMLElement;
  body: HTMLElement;
  close: () => void;
  isOpen: () => boolean;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: ModalHandle[] = [];
let uid = 0;

const onKeydown = (e: KeyboardEvent): void => {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === "Escape") {
    // Let open menus/popovers inside the modal close first.
    if (document.querySelector(".ytc-menu")) return;
    e.preventDefault();
    e.stopPropagation();
    top.close();
    return;
  }
  if (e.key === "Tab") {
    const items = [...top.dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null,
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
};

/**
 * Opens an accessible modal: role=dialog, focus trap, Escape closes only the
 * topmost modal, focus returns to the opener, and key presses do not leak to
 * YouTube's player shortcuts.
 */
export const openModal = (opts: ModalOptions): ModalHandle => {
  injectStyles();
  document.querySelector(`.ytc-modal-bg.${opts.id}`)?.dispatchEvent(new CustomEvent("ytc-close"));

  const titleId = `ytc-modal-title-${++uid}`;
  const backdrop = document.createElement("div");
  backdrop.className = `ytc-modal-bg ${opts.id}`;
  setHTML(
    backdrop,
    `<div class="ytc-modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}" style="width:min(${opts.width ?? 640}px,95vw)">
      <div class="ytc-modal-header">
        <h2 id="${titleId}">${opts.title}</h2>
        <button class="ytc-modal-close" aria-label="Kapat" title="Kapat (Esc)">${icons.x}</button>
      </div>
      <div class="ytc-modal-body ${opts.bodyClass ?? ""}">${opts.body}</div>
      ${opts.footer ? `<div class="ytc-modal-footer">${opts.footer}</div>` : ""}
    </div>`,
  );

  const dialog = backdrop.querySelector(".ytc-modal") as HTMLElement;
  const body = backdrop.querySelector(".ytc-modal-body") as HTMLElement;
  const opener = document.activeElement as HTMLElement | null;
  let open = true;

  const handle: ModalHandle = {
    backdrop,
    dialog,
    body,
    isOpen: () => open,
    close: () => {
      if (!open) return;
      open = false;
      backdrop.remove();
      const i = stack.indexOf(handle);
      if (i !== -1) stack.splice(i, 1);
      if (!stack.length) document.removeEventListener("keydown", onKeydown, true);
      opts.onClose?.();
      if (opener?.isConnected) opener.focus();
    },
  };

  backdrop.addEventListener("ytc-close", handle.close);
  // Close on backdrop click only if the press also started there (no
  // accidental close when selecting text and releasing outside).
  let downOnBackdrop = false;
  backdrop.addEventListener("mousedown", (e) => (downOnBackdrop = e.target === backdrop));
  backdrop.addEventListener("click", (e) => {
    if ((e.target === backdrop && downOnBackdrop) || (e.target as HTMLElement).closest(".ytc-modal-close")) {
      handle.close();
    }
  });
  // YouTube binds shortcuts (k, j, l, f, m, space…) on document.
  backdrop.addEventListener("keydown", (e) => e.stopPropagation());
  backdrop.addEventListener("keypress", (e) => e.stopPropagation());

  document.body.appendChild(backdrop);
  if (!stack.length) document.addEventListener("keydown", onKeydown, true);
  stack.push(handle);

  const firstField = dialog.querySelector<HTMLElement>("[autofocus], .ytc-modal-body " + FOCUSABLE);
  (firstField ?? dialog.querySelector<HTMLElement>(".ytc-modal-close"))?.focus({ preventScroll: true });

  return handle;
};

/** Promise-based confirm dialog that matches the UI (instead of window.confirm). */
export const confirmDialog = (message: string, confirmLabel = "Onayla", danger = false): Promise<boolean> =>
  new Promise((resolve) => {
    let result = false;
    const m = openModal({
      id: "ytc-confirm-modal",
      width: 420,
      title: `${icons.info} Emin misin?`,
      body: `<p class="ytc-confirm-text"></p>`,
      footer: `<button class="ytc-btn secondary" data-action="cancel">Vazgeç</button>
        <button class="ytc-btn ${danger ? "danger" : "primary"}" data-action="ok">${confirmLabel}</button>`,
      onClose: () => resolve(result),
    });
    (m.body.querySelector(".ytc-confirm-text") as HTMLElement).textContent = message;
    m.dialog.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-action="ok"]')) {
        result = true;
        m.close();
      } else if (t.closest('[data-action="cancel"]')) m.close();
    });
    (m.dialog.querySelector('[data-action="ok"]') as HTMLElement).focus();
  });

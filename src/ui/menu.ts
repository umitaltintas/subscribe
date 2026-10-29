import { setHTML, injectStyles } from "../dom";
import { icons } from "../icons";

export interface MenuItem {
  label: string;
  /** Muted text on the right (e.g. "kayıtlı"). */
  hint?: string;
  checked?: boolean;
  icon?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export type MenuEntry = MenuItem | "separator" | { heading: string };

let closeCurrent: (() => void) | null = null;

export const closeMenu = (): void => closeCurrent?.();

/** Small dropdown menu anchored to a button. Keyboard: ↑/↓, Enter, Esc. */
export const openMenu = (anchor: HTMLElement, entries: MenuEntry[]): void => {
  injectStyles();
  closeMenu();

  const menu = document.createElement("div");
  menu.className = "ytc-menu";
  menu.setAttribute("role", "menu");

  const actions: (() => void)[] = [];
  setHTML(
    menu,
    entries
      .map((e) => {
        if (e === "separator") return `<div class="ytc-menu-sep" role="separator"></div>`;
        if ("heading" in e) return `<div class="ytc-menu-heading">${e.heading}</div>`;
        const idx = actions.push(e.onSelect) - 1;
        return `<button class="ytc-menu-item" role="menuitemradio" aria-checked="${!!e.checked}" data-idx="${idx}" ${e.disabled ? "disabled" : ""}>
          <span class="ytc-menu-check">${e.checked ? icons.check : e.icon ?? ""}</span>
          <span class="ytc-menu-label">${e.label}</span>
          ${e.hint ? `<span class="ytc-menu-hint">${e.hint}</span>` : ""}
        </button>`;
      })
      .join(""),
  );

  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - mw - 8);
  const below = rect.bottom + 6;
  const top = below + mh > window.innerHeight - 8 ? Math.max(8, rect.top - mh - 6) : below;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  anchor.setAttribute("aria-expanded", "true");

  const items = () => [...menu.querySelectorAll<HTMLButtonElement>(".ytc-menu-item:not([disabled])")];

  const close = () => {
    menu.remove();
    anchor.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", onOutside, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", close);
    window.removeEventListener("scroll", onScroll, true);
    closeCurrent = null;
  };

  const onScroll = (e: Event) => {
    if (!menu.contains(e.target as Node)) close();
  };

  const onOutside = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) close();
  };

  const onKey = (e: KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      anchor.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const d = e.key === "ArrowDown" ? 1 : -1;
      list[(i + d + list.length) % list.length]?.focus();
    } else if (e.key === "Tab") {
      close();
    }
  };

  menu.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".ytc-menu-item");
    if (!btn || btn.disabled) return;
    const fn = actions[Number(btn.dataset.idx)];
    close();
    anchor.focus();
    fn();
  });
  menu.addEventListener("keydown", (e) => e.stopPropagation());

  document.addEventListener("mousedown", onOutside, true);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", close);
  window.addEventListener("scroll", onScroll, true);
  closeCurrent = close;

  (menu.querySelector<HTMLButtonElement>('.ytc-menu-item[aria-checked="true"]') ?? items()[0])?.focus({
    preventScroll: true,
  });
};

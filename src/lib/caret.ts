import { cssEscape } from "./dom";

export function caretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return false;
  const pre = r.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.endContainer, r.endOffset);
  return pre.toString().length === 0;
}

export function caretAtEnd(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return false;
  const post = r.cloneRange();
  post.selectNodeContents(el);
  post.setStart(r.endContainer, r.endOffset);
  return post.toString().length === 0;
}

export function focusAt(el: HTMLElement, offset: number | "end" | "start"): void {
  el.focus();
  const r = document.createRange();
  if (offset === "end") {
    r.selectNodeContents(el);
    r.collapse(false);
  } else if (offset === "start") {
    r.selectNodeContents(el);
    r.collapse(true);
  } else {
    const total = (el.textContent ?? "").length;
    const pos = Math.max(0, Math.min(offset, total));
    let remaining = pos;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let placed = false;
    let node: Node | null = walker.nextNode();
    while (node) {
      const len = (node.textContent ?? "").length;
      if (remaining <= len) {
        r.setStart(node, remaining);
        r.collapse(true);
        placed = true;
        break;
      }
      remaining -= len;
      node = walker.nextNode();
    }
    if (!placed) {
      r.selectNodeContents(el);
      r.collapse(false);
    }
  }
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(r);
}

export function getAllEditables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-task-id]"));
}

export function getEditableFor(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-task-id="${cssEscape(id)}"]`);
}

export function focusTaskById(id: string, offset: number | "end" | "start" = "end"): boolean {
  const el = getEditableFor(id);
  if (!el) return false;
  focusAt(el, offset);
  return true;
}

export function getAdjacentTaskId(currentId: string, dir: 1 | -1): string | null {
  const all = getAllEditables();
  const idx = all.findIndex((el) => el.dataset.taskId === currentId);
  if (idx < 0) return null;
  const next = all[idx + dir];
  return next?.dataset.taskId ?? null;
}

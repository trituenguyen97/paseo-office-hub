import { Platform } from "react-native";

// Only what this module touches of the browser DOM is declared, so the rest of the client stays free of
// DOM types. Every export does nothing outside the web build.
interface Node {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  parentElement: Node | null;
  contains(other: unknown): boolean;
}

interface WheelLike {
  target: unknown;
  deltaY: number;
  deltaMode: number;
  preventDefault(): void;
  stopPropagation(): void;
}

interface Listener {
  (event: WheelLike): void;
}

declare const window: { getComputedStyle(node: Node): { overflowY: string } };
declare const document: {
  addEventListener(type: "wheel", listener: Listener, options: { capture: boolean; passive: boolean }): void;
  removeEventListener(type: "wheel", listener: Listener, options: { capture: boolean }): void;
};

const LINE_PX = 16;

// The distance a wheel event asks for, in pixels, whatever unit the browser reports it in.
const pixels = (event: WheelLike, node: Node) =>
  event.deltaMode === 1 ? event.deltaY * LINE_PX : event.deltaMode === 2 ? event.deltaY * node.clientHeight : event.deltaY;

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

const scrolls = (node: Node) => {
  const overflow = window.getComputedStyle(node).overflowY;
  return (overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight;
};

// Whether a scrolling element between the pointer and `area` can still move in the wheel's direction.
// Such an element, for example a list of notes, keeps the wheel for itself until it reaches its end.
function innerListCanMove(target: unknown, area: Node, deltaY: number): boolean {
  for (let node = target as Node | null; node && node !== area; node = node.parentElement) {
    if (!scrolls(node)) continue;
    const atTop = node.scrollTop <= 0;
    const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
    if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return true;
  }
  return false;
}

// Makes the mouse wheel scroll `area` whenever the pointer is anywhere over it. Left to the browser, the
// wheel did nothing over the cards inside, so the listener sits on the document in the capture phase and
// scrolls by hand. A list inside the area scrolls first, and at the area's own top or bottom the event is
// left alone so the page around it scrolls instead. Returns the cleanup function.
export function scrollOnWheel(area: unknown): () => void {
  if (Platform.OS !== "web" || !area) return () => {};
  const target = area as Node;
  const onWheel: Listener = (event) => {
    if (!target.contains(event.target)) return;
    const max = target.scrollHeight - target.clientHeight;
    if (max <= 0 || innerListCanMove(event.target, target, event.deltaY)) return;
    const next = clamp(target.scrollTop + pixels(event, target), max);
    if (next === target.scrollTop) return;
    target.scrollTop = next;
    event.preventDefault();
    event.stopPropagation();
  };
  document.addEventListener("wheel", onWheel, { capture: true, passive: false });
  return () => document.removeEventListener("wheel", onWheel, { capture: true });
}

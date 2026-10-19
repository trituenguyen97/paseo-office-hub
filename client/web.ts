import { Platform } from "react-native";

// Only what this module touches of the browser DOM is declared, so the rest of the client stays free of
// DOM types. Every export does nothing outside the web build.
interface ScrollNode {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  parentElement: ScrollNode | null;
  scrollBy(x: number, y: number): void;
  addEventListener(type: "wheel", listener: (event: WheelLike) => void, options: { passive: boolean }): void;
  removeEventListener(type: "wheel", listener: (event: WheelLike) => void): void;
}

interface WheelLike {
  deltaY: number;
  preventDefault(): void;
}

declare const window: { getComputedStyle(node: ScrollNode): { overflowY: string } };

const scrolls = (node: ScrollNode) => {
  const overflow = window.getComputedStyle(node).overflowY;
  return (overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight;
};

// A list inside another scroll area takes the mouse wheel for itself and keeps it even when it cannot
// move any further, so the area around it appears stuck. Hand the wheel to the nearest scrolling
// ancestor once the list is at its top or bottom. Returns the cleanup function.
export function chainWheelToParent(node: unknown): () => void {
  if (Platform.OS !== "web" || !node) return () => {};
  const list = node as ScrollNode;
  const onWheel = (event: WheelLike) => {
    const atTop = list.scrollTop <= 0;
    const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
    if ((event.deltaY < 0 && !atTop) || (event.deltaY > 0 && !atBottom)) return;
    for (let parent = list.parentElement; parent; parent = parent.parentElement) {
      if (scrolls(parent)) {
        parent.scrollBy(0, event.deltaY);
        event.preventDefault();
        return;
      }
    }
  };
  list.addEventListener("wheel", onWheel, { passive: false });
  return () => list.removeEventListener("wheel", onWheel);
}

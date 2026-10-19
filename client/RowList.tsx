import { type ReactNode, useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import { chainWheelToParent } from "./web";

// A list of fixed-height rows that shows at most `visibleRows` and scrolls beyond that. A list that
// fits is a plain View: a nested ScrollView would otherwise swallow the mouse wheel and stop the
// sidebar around it from scrolling while the pointer is over the list.
export function RowList({
  count,
  rowHeight,
  gap,
  visibleRows,
  children,
}: {
  count: number;
  rowHeight: number;
  gap: number;
  visibleRows: number;
  children: ReactNode;
}) {
  const ref = useRef<ScrollView>(null);
  const scrolls = count > visibleRows;
  useEffect(() => (scrolls ? chainWheelToParent(ref.current?.getScrollableNode()) : undefined), [scrolls]);
  if (!scrolls) return <View style={{ gap }}>{children}</View>;
  return (
    <ScrollView
      ref={ref}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={{ maxHeight: visibleRows * rowHeight + (visibleRows - 1) * gap }}
      contentContainerStyle={{ gap }}
    >
      {children}
    </ScrollView>
  );
}

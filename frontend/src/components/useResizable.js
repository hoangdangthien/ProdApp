import { useState, useCallback, useRef, useEffect } from "react";

const CURSOR_MAP = {
  n: "ns-resize", s: "ns-resize",
  e: "ew-resize", w: "ew-resize",
  ne: "nesw-resize", sw: "nesw-resize",
  nw: "nwse-resize", se: "nwse-resize",
};

const DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export function ResizeHandles({ onResize, excludeDirections = [] }) {
  const dirs = excludeDirections.length > 0
    ? DIRECTIONS.filter((d) => !excludeDirections.includes(d))
    : DIRECTIONS;
  return (
    <>
      {dirs.map((dir) => (
        <div key={dir} className={`spm-resize spm-resize-${dir}`} onMouseDown={onResize(dir)} />
      ))}
    </>
  );
}

const LEFT_EDGE_MARGIN = 300;
const RIGHT_EDGE_MARGIN = 40;

export default function useResizable(defaultHeight, minWidth = 200, minHeight = 150, options = {}) {
  // When `onHorizontalResize` is supplied, horizontal drags (e/w and the
  // horizontal part of corner handles) are delegated to the parent instead of
  // applying the internal overlap margins. This lets a parent squeeze a
  // neighbouring panel (right-anchored split) rather than overlapping the
  // gutter. Vertical (n/s) resize always stays internal.
  const { onHorizontalResize } = options;
  // Single state object so width, height, and offsets always update atomically.
  const [state, setState] = useState({
    width: null,
    height: defaultHeight,
    leftShift: 0,   // px to shift left (negative = move left)
    rightShift: 0,  // px to shift right (positive = move right)
  });
  const [containerWidth, setContainerWidth] = useState(null);
  const stateRef = useRef(state);
  const containerRef = useRef(null);
  stateRef.current = state;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onResize = useCallback((direction) => (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const el = containerRef.current;
    const cur = stateRef.current;
    const currentWidth = cur.width ?? el?.offsetWidth ?? 600;
    const currentHeight = cur.height ?? el?.offsetHeight ?? defaultHeight;
    const curLeft = cur.leftShift;
    const curRight = cur.rightShift;
    const startRect = el ? el.getBoundingClientRect() : { left: 0, right: window.innerWidth };

    const hasN = direction.includes("n");
    const hasS = direction.includes("s");
    const hasE = direction.includes("e");
    const hasW = direction.includes("w");

    document.body.style.cursor = CURSOR_MAP[direction] || "default";
    document.body.style.userSelect = "none";

    const delegateHorizontal = !!onHorizontalResize && (hasE || hasW);
    if (delegateHorizontal) onHorizontalResize({ phase: "start", direction });

    const onMouseMove = (moveE) => {
      let dx = moveE.clientX - startX;
      const dy = moveE.clientY - startY;

      // Delegated mode: parent owns horizontal sizing; we only update height.
      if (delegateHorizontal) {
        let nextHeight = currentHeight;
        if (hasS) nextHeight = Math.max(minHeight, currentHeight + dy);
        if (hasN) nextHeight = Math.max(minHeight, currentHeight - dy);
        onHorizontalResize({ phase: "move", dx, direction });
        setState((prev) => ({ ...prev, height: nextHeight }));
        return;
      }

      let nextWidth = currentWidth;
      let nextHeight = currentHeight;
      let nextLeft = curLeft;
      let nextRight = curRight;

      if (hasW) {
        // The element's left edge with no shift applied. Always allow the user
        // to drag back to (and not past) this natural position, even when it is
        // left of LEFT_EDGE_MARGIN — otherwise a plot whose natural edge sits
        // left of the margin can never be dragged back, leaving a dead "space".
        const naturalLeft = startRect.left - curLeft;
        const minLeftEdge = Math.min(naturalLeft, LEFT_EDGE_MARGIN);
        const maxLeftDx = -(startRect.left - minLeftEdge);
        const clampedDx = Math.max(dx, maxLeftDx);
        nextLeft = curLeft + clampedDx;
      }
      if (hasE) {
        const naturalRight = startRect.right - curRight;
        const maxRightEdge = Math.max(naturalRight, window.innerWidth - RIGHT_EDGE_MARGIN);
        const maxRightDx = maxRightEdge - startRect.right;
        const clampedDx = Math.min(dx, maxRightDx);
        nextRight = curRight + clampedDx;
      }
      if (hasS) nextHeight = Math.max(minHeight, currentHeight + dy);
      if (hasN) nextHeight = Math.max(minHeight, currentHeight - dy);

      setState({
        width: currentWidth,
        height: nextHeight,
        leftShift: nextLeft,
        rightShift: nextRight,
      });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (delegateHorizontal) onHorizontalResize({ phase: "end", direction });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [minWidth, minHeight, defaultHeight, onHorizontalResize]);

  const leftGrow = -(state.leftShift || 0);
  const rightGrow = state.rightShift || 0;
  const totalGrow = leftGrow + rightGrow;
  const visualWidth = state.width ? state.width + totalGrow : undefined;

  const style = {
    height: state.height || defaultHeight,
    flex: '1 1 0',
    minWidth: 0,
    overflow: 'visible',
    position: 'relative',
    marginLeft: leftGrow !== 0 ? -leftGrow : undefined,
    marginRight: rightGrow !== 0 ? -rightGrow : undefined,
  };

  const size = { width: visualWidth, height: state.height };

  return { size, style, containerRef, containerWidth, onResize };
}

/*
 * useHorizontalSplit
 * ------------------
 * Manages a right-anchored split between two side-by-side panels in a flex row.
 * The LEFT panel is width-controlled; the RIGHT panel should stay `flex: 1 1 0`
 * so its right edge is pinned and it squeezes as the left panel grows.
 *
 * Wire it up by:
 *   const split = useHorizontalSplit();
 *   <div className="charts-row" ref={split.rowRef}>
 *     <div ref={split.leftRef} style={{ ...split.leftStyle }}>
 *       <LeftChart  onHorizontalResize={split.onResize} ... />  // east handle
 *     </div>
 *     <div style={{ flex: "1 1 0", minWidth: 0 }}>
 *       <RightChart onHorizontalResize={split.onResize} ... />  // west handle
 *     </div>
 *   </div>
 *
 * Both children's seam handles drive the single left width; `dx` is signed
 * pointer movement, so `startWidth + dx` works for either handle.
 */
export function useHorizontalSplit({ min = 320, gap = 16, initialFlex = 1 } = {}) {
  const rowRef = useRef(null);
  const leftRef = useRef(null);
  const [leftWidth, setLeftWidth] = useState(null);
  const startRef = useRef(0);

  const onResize = useCallback(({ phase, dx }) => {
    if (phase === "start") {
      startRef.current = leftRef.current?.offsetWidth ?? 0;
      return;
    }
    if (phase !== "move") return;
    const row = rowRef.current?.clientWidth ?? 0;
    const max = Math.max(min, row - gap - min);
    setLeftWidth(Math.min(Math.max(min, startRef.current + dx), max));
  }, [min, gap]);

  const leftStyle = {
    // Until the user drags (leftWidth === null) the left panel uses a flex-grow
    // ratio relative to the right panel's `1`, so `initialFlex` sets the initial
    // wide/narrow balance. After a drag it switches to a fixed px width.
    flex: leftWidth != null ? `0 0 ${leftWidth}px` : `${initialFlex} 1 0`,
    minWidth: 0,
  };

  return { rowRef, leftRef, leftStyle, onResize };
}

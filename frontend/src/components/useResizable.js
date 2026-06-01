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

export default function useResizable(defaultHeight, minWidth = 200, minHeight = 150) {
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

    const onMouseMove = (moveE) => {
      let dx = moveE.clientX - startX;
      const dy = moveE.clientY - startY;
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
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [minWidth, minHeight, defaultHeight]);

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

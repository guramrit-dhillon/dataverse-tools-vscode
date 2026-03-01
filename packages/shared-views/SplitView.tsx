import React, { useState, useRef, useCallback } from "react";
import "./splitview.css";

interface SplitViewProps {
  direction?: "horizontal" | "vertical";
  initialRatio?: number;
  min?: number;
  className?: string;
  children: [React.ReactNode, React.ReactNode] | [React.ReactNode];
}

export default function SplitView({
  direction = "horizontal",
  initialRatio = 0.5,
  min = 100,
  className,
  children,
}: SplitViewProps): React.ReactElement {
  const hasTwo = children.length === 2 && children[1] !== null && children[1] !== undefined;
  const [ratio, setRatio] = useState(initialRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const isVertical = direction === "vertical";

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";

      const startPos = isVertical ? e.clientY : e.clientX;
      const startRatio = ratio;
      const container = containerRef.current;
      if (!container) { return; }
      const totalSize = isVertical ? container.offsetHeight : container.offsetWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = (isVertical ? ev.clientY : ev.clientX) - startPos;
        let next = startRatio + delta / totalSize;
        const minRatio = min / totalSize;
        next = Math.max(minRatio, Math.min(1 - minRatio, next));
        setRatio(next);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [ratio, min, isVertical]
  );

  return (
    <div
      ref={containerRef}
      className={["split-view", isVertical ? "split-vertical" : "split-horizontal", className].filter(Boolean).join(" ")}
    >
      <div className="split-pane" style={{ flex: hasTwo ? ratio : 1 }}>
        {children[0]}
      </div>
      {hasTwo && (
        <>
          <div
            className={`split-handle ${isVertical ? "split-handle-v" : "split-handle-h"}`}
            onMouseDown={onMouseDown}
          />
          <div className="split-pane" style={{ flex: 1 - ratio }}>
            {children[1]}
          </div>
        </>
      )}
    </div>
  );
}

import { motion } from "framer-motion";
import { useEffect, useState, type RefObject } from "react";

type CitationThreadSvgProps = {
  workspaceRef: RefObject<HTMLDivElement | null>;
  fromElement: HTMLElement | null;
  toElement: HTMLElement | null;
  label: number;
};

type ThreadPath = {
  width: number;
  height: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  path: string;
};

function isVisibleInside(bounds: DOMRect, rect: DOMRect) {
  return (
    rect.right > bounds.left &&
    rect.left < bounds.right &&
    rect.bottom > bounds.top &&
    rect.top < bounds.bottom
  );
}

export function CitationThreadSvg({ workspaceRef, fromElement, toElement, label }: CitationThreadSvgProps) {
  const [thread, setThread] = useState<ThreadPath | null>(null);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || !fromElement || !toElement) {
      setThread(null);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      if (!fromElement.isConnected || !toElement.isConnected) {
        setThread(null);
        return;
      }

      const bounds = workspace.getBoundingClientRect();
      const from = fromElement.getBoundingClientRect();
      const to = toElement.getBoundingClientRect();
      if (!isVisibleInside(bounds, from) || !isVisibleInside(bounds, to)) {
        setThread(null);
        return;
      }

      const startX = from.right - bounds.left;
      const startY = from.top + from.height / 2 - bounds.top;
      const endX = to.left + to.width / 2 - bounds.left;
      const endY = to.top + to.height / 2 - bounds.top;
      const bend = Math.max(36, Math.abs(endX - startX) * 0.36);
      setThread({
        width: bounds.width,
        height: bounds.height,
        startX,
        startY,
        endX,
        endY,
        path: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(workspace);
    observer.observe(fromElement);
    observer.observe(toElement);
    window.addEventListener("resize", schedule);
    // Capture-phase scroll listens to both independently scrolling workspace panes.
    window.addEventListener("scroll", schedule, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [workspaceRef, fromElement, toElement]);

  if (!thread) return null;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 hidden overflow-visible lg:block"
      viewBox={`0 0 ${thread.width} ${thread.height}`}
      preserveAspectRatio="none"
    >
      <motion.path
        key={`${thread.startX}-${thread.startY}-${thread.endX}-${thread.endY}-${label}`}
        d={thread.path}
        fill="none"
        stroke="var(--purple)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeDasharray="4 6"
        initial={{ opacity: 0, pathLength: 0, strokeDashoffset: 10 }}
        animate={{ opacity: 0.86, pathLength: 1, strokeDashoffset: [10, 0] }}
        transition={{
          pathLength: { duration: 0.45, ease: "easeOut" },
          opacity: { duration: 0.16 },
          strokeDashoffset: { duration: 1.1, repeat: Infinity, ease: "linear" },
        }}
      />
      <motion.circle
        cx={thread.startX}
        cy={thread.startY}
        r="8"
        fill="var(--purple)"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, delay: 0.16 }}
      />
      <circle cx={thread.endX} cy={thread.endY} r="4" fill="var(--cream)" stroke="var(--purple)" strokeWidth="1.3" />
      <text x={thread.startX} y={thread.startY + 3} textAnchor="middle" className="fill-white text-[8px] font-semibold">
        {label}
      </text>
    </svg>
  );
}
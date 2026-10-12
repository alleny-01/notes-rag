import { useEffect, useRef } from "react";

type Particle = {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  drift: number;
};

const PRIMARY = "68, 41, 94";

type ParticleFieldProps = {
  particleCount?: number;
  interactive?: boolean;
  className?: string;
};

/**
 * An intentionally subtle, but always-visible constellation. Its resting motion
 * makes the interaction discoverable on touch screens; fine pointers additionally
 * bend the current around the cursor.
 */
export function ParticleField({
  particleCount = 180,
  interactive = true,
  className = "",
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!canvas || reduceMotion) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const hoverEnabled =
      interactive &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const pointer = { x: -1000, y: -1000, active: false };
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const count = width < 700 ? Math.min(94, particleCount) : particleCount;
      particles = Array.from({ length: count }, (_, index) => {
        const baseX = (((index * 137.5) % 991) / 991) * width;
        const baseY =
          (((index * 83.7 + 97) % 983) / 983) * Math.max(height * 0.82, 1);
        return {
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          vx: 0,
          vy: 0,
          size: index % 11 === 0 ? 2 : index % 4 === 0 ? 1.3 : 0.9,
          phase: index * 0.73,
          drift: 11 + ((index * 29) % 27),
        };
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!hoverEnabled) return;
      const bounds = canvas.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.active =
        pointer.x >= 0 &&
        pointer.y >= 0 &&
        pointer.x <= width &&
        pointer.y <= height;
    };

    const onWindowBlur = () => {
      pointer.active = false;
    };

    const render = (time: number) => {
      context.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        const currentX =
          particle.baseX +
          Math.cos(time * 0.00034 + particle.phase) * particle.drift;
        const currentY =
          particle.baseY +
          Math.sin(time * 0.00027 + particle.phase * 1.71) *
            particle.drift *
            0.72;
        const distanceX = particle.x - pointer.x;
        const distanceY = particle.y - pointer.y;
        const distance = Math.hypot(distanceX, distanceY) || 1;
        const influence =
          pointer.active && distance < 180 ? (180 - distance) / 180 : 0;
        const ambientX =
          Math.cos(time * 0.00062 + particle.phase * 1.4) * 0.055;
        const ambientY = Math.sin(time * 0.00048 + particle.phase) * 0.055;

        particle.vx +=
          (currentX - particle.x) * 0.011 +
          (distanceX / distance) * influence * 0.88 +
          ambientX;
        particle.vy +=
          (currentY - particle.y) * 0.011 +
          (distanceY / distance) * influence * 0.88 +
          ambientY;
        particle.vx *= 0.9;
        particle.vy *= 0.9;
        particle.x += particle.vx;
        particle.y += particle.vy;

        context.beginPath();
        context.fillStyle = `rgba(${PRIMARY}, ${0.58 + influence * 0.34})`;
        context.arc(
          particle.x,
          particle.y,
          particle.size + influence * 0.85,
          0,
          Math.PI * 2,
        );
        context.fill();
      });

      frame = requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(resize);
    resize();
    resizeObserver.observe(canvas);
    if (hoverEnabled)
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", onWindowBlur);
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [interactive, particleCount]);

  return (
    <canvas
      ref={canvasRef}
      className={`particle-field ${className}`}
      aria-hidden="true"
    />
  );
}

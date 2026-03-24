import { useEffect, useRef } from 'react';

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

const CELL_SIZE = 4;
const SPEED = 0.25;
const STATIC_FRAME = 5929.724999967142;
const TARGET_FPS = 24;
const TAU = Math.PI * 2;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function sampleField(nx: number, ny: number, time: number) {
  const warpA = Math.sin((nx * 1.35 - time * 0.18) * TAU + Math.cos((ny * 1.8 + time * 0.11) * TAU) * 0.85);
  const warpB = Math.cos((ny * 1.2 + time * 0.16) * TAU - Math.sin((nx * 1.55 - time * 0.09) * TAU) * 0.9);
  const x = nx + warpA * 0.075 + warpB * 0.02;
  const y = ny + warpB * 0.08 - warpA * 0.02;

  return clamp(
    0.5
      + Math.sin((x * 2.25 + time * 0.12) * TAU) * 0.34
      + Math.cos((y * 1.7 - time * 0.09) * TAU) * 0.28
      + Math.sin(((x + y) * 1.4 + time * 0.06) * TAU) * 0.18,
  );
}

export default function HeroDitheringCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const frameInterval = 1000 / TARGET_FPS;

    let width = 0;
    let height = 0;
    let columns = 0;
    let rows = 0;
    let offsetX = 0;
    let offsetY = 0;
    let frontColor = '#F3F9FF';
    let animationFrame = 0;
    let animationStart = 0;
    let lastPaint = 0;

    const syncColors = () => {
      const styles = getComputedStyle(parent);
      frontColor = styles.getPropertyValue('--landing-hero-dither-front').trim() || '#F3F9FF';
    };

    const syncSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      columns = Math.max(1, Math.floor(width / CELL_SIZE));
      rows = Math.max(1, Math.floor(height / CELL_SIZE));
      offsetX = (width - columns * CELL_SIZE) / 2;
      offsetY = (height - rows * CELL_SIZE) / 2;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      syncColors();
    };

    const draw = (frame: number) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = frontColor;

      const time = frame * 0.00045 * SPEED;

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const nx = columns > 1 ? column / (columns - 1) : 0.5;
          const ny = rows > 1 ? row / (rows - 1) : 0.5;
          const threshold = (BAYER_4X4[(row & 3) * 4 + (column & 3)] + 0.5) / 16;
          const field = sampleField(nx, ny, time);
          if (field <= threshold) continue;

          context.fillRect(
            offsetX + column * CELL_SIZE,
            offsetY + row * CELL_SIZE,
            CELL_SIZE,
            CELL_SIZE,
          );
        }
      }
    };

    const paintStatic = () => {
      syncSize();
      draw(STATIC_FRAME);
    };

    const tick = (timestamp: number) => {
      if (!animationStart) animationStart = timestamp;
      if (timestamp - lastPaint >= frameInterval) {
        lastPaint = timestamp;
        draw(STATIC_FRAME + (timestamp - animationStart));
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    const handleMotionChange = () => {
      window.cancelAnimationFrame(animationFrame);
      animationStart = 0;
      lastPaint = 0;
      paintStatic();
      if (!reducedMotionQuery.matches) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    const resizeObserver = new ResizeObserver(paintStatic);
    resizeObserver.observe(parent);

    const themeObserver = new MutationObserver(paintStatic);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });

    paintStatic();
    if (!reducedMotionQuery.matches) {
      animationFrame = window.requestAnimationFrame(tick);
    }

    reducedMotionQuery.addEventListener('change', handleMotionChange);
    window.addEventListener('resize', paintStatic);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      reducedMotionQuery.removeEventListener('change', handleMotionChange);
      window.removeEventListener('resize', paintStatic);
    };
  }, []);

  return <canvas ref={canvasRef} className="st-hero-dither-canvas" aria-hidden="true" />;
}

import { useEffect, useRef } from 'react';

const LAND_BOXES: Array<[number, number, number, number]> = [
  [-140, 60, -60, 75], [-130, 50, -60, 60], [-125, 30, -65, 50], [-120, 15, -85, 30],
  [-85, 8, -77, 15], [-90, 15, -82, 20], [-105, 20, -85, 30], [-77, 8, -75, 10],
  [-55, 60, -20, 85],
  [-80, -5, -35, 10], [-75, -20, -35, -5], [-70, -55, -35, -20], [-80, -5, -76, 5],
  [-10, 35, 40, 70], [15, 55, 30, 70], [20, 60, 30, 70], [-5, 55, 5, 60],
  [10, 55, 25, 60], [20, 43, 30, 50], [25, 40, 30, 45], [-8, 38, 0, 44],
  [-18, 5, 50, 35], [10, -35, 40, 5], [30, -35, 35, 5], [25, 0, 45, 12],
  [35, 10, 45, 15], [40, 10, 50, 15],
  [40, 35, 145, 75], [60, 20, 90, 35], [90, 20, 145, 35], [100, 0, 145, 20],
  [95, 5, 105, 20], [100, 0, 120, 10], [120, 0, 125, 5], [125, 10, 130, 18],
  [35, 12, 60, 35], [55, 12, 65, 25],
  [130, 30, 145, 45],
  [95, 0, 141, -11], [100, -10, 120, -1], [105, -8, 115, -5],
  [115, -40, 155, -10], [145, -45, 155, -38],
  [165, -47, 178, -34],
  [-8, 51, 2, 59], [-5, 55, 0, 60],
  [-24, 63, -13, 67],
  [5, 57, 32, 72], [15, 65, 30, 72], [25, 60, 32, 65],
  [140, 50, 180, 75], [160, 55, 180, 70],
  [118, 6, 127, 20],
  [80, 6, 82, 10],
  [43, -26, 51, -12],
  [-85, 10, -60, 25],
];

function isLand(nx: number, ny: number): boolean {
  const lon = nx * 360 - 180;
  const lat = 90 - ny * 180;
  for (const [x1, y1, x2, y2] of LAND_BOXES) {
    if (lon >= x1 && lon <= x2 && lat >= y1 && lat <= y2) return true;
  }
  return false;
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

export default function HeroWorldMapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const dotSize = 2;
    const dotGap = 8;
    const baseColor = 'rgba(141, 141, 134, 0.14)';
    const shineColor = [95, 220, 76] as const;
    const shineInterval = 600;
    const shineDuration = 1000;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let animationFrame = 0;
    let previousTimestamp = 0;
    let shineTimer = 0;
    let landDots: number[] = [];
    let shineStates: Array<{ active: boolean; progress: number }> = [];

    const rebuildGrid = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.max(1, Math.floor(width / dotGap));
      rows = Math.max(1, Math.floor(height / dotGap));
      landDots = [];
      shineStates = new Array(cols * rows).fill(null).map(() => ({ active: false, progress: 0 }));

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const nx = col / cols;
          const ny = row / rows;
          if (isLand(nx, ny)) {
            landDots.push(row * cols + col);
          }
        }
      }
    };

    const triggerShine = () => {
      if (!landDots.length) return;
      const randomIndex = landDots[Math.floor(Math.random() * landDots.length)];
      shineStates[randomIndex] = { active: true, progress: 0 };
    };

    const draw = (timestamp: number) => {
      if (!previousTimestamp) previousTimestamp = timestamp;
      const delta = timestamp - previousTimestamp;
      previousTimestamp = timestamp;
      shineTimer += delta;

      if (shineTimer >= shineInterval) {
        shineTimer = 0;
        triggerShine();
      }

      context.clearRect(0, 0, width, height);
      context.fillStyle = baseColor;

      for (const index of landDots) {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * dotGap + (dotGap - dotSize) / 2;
        const y = row * dotGap + (dotGap - dotSize) / 2;
        context.fillRect(x, y, dotSize, dotSize);
      }

      for (const index of landDots) {
        const state = shineStates[index];
        if (!state.active) continue;

        state.progress += delta / shineDuration;
        if (state.progress > 1) {
          state.active = false;
          state.progress = 0;
          continue;
        }

        const alpha = easeOutCubic(1 - state.progress);
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * dotGap + (dotGap - dotSize) / 2;
        const y = row * dotGap + (dotGap - dotSize) / 2;
        const size = dotSize + easeOutCubic(1 - state.progress) * 2;
        const offset = (size - dotSize) / 2;

        context.fillStyle = `rgba(${shineColor[0]}, ${shineColor[1]}, ${shineColor[2]}, ${alpha.toFixed(3)})`;
        context.fillRect(x - offset, y - offset, size, size);
      }

      animationFrame = window.requestAnimationFrame(draw);
    };

    rebuildGrid();
    animationFrame = window.requestAnimationFrame(draw);
    window.addEventListener('resize', rebuildGrid);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', rebuildGrid);
    };
  }, []);

  return <canvas ref={canvasRef} className="st-hero-map-canvas" aria-hidden="true" />;
}

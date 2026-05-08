import React, { useEffect, useRef } from 'react';

interface RealisticQRCodeProps {
  value: string;
  size?: number;
  foreground?: string;
  background?: string;
  quietZoneModules?: number;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function hashToSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

export const RealisticQRCode: React.FC<RealisticQRCodeProps> = ({
  value,
  size = 192,
  foreground = '#000000',
  background = '#FFFFFF',
  quietZoneModules = 4,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a fixed version-like matrix for realism (Version 3: 29x29)
    const modules = 29;
    const quiet = Math.max(0, quietZoneModules);
    const totalSize = size;
    const moduleSize = totalSize / (modules + quiet * 2);

    canvas.width = Math.ceil(totalSize);
    canvas.height = Math.ceil(totalSize);

    // Fill background
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Compute seeded RNG based on value
    const rng = lcg(hashToSeed(value));

    // Helper: draw module
    const drawModule = (mx: number, my: number, color = foreground) => {
      const x = (mx + quiet) * moduleSize;
      const y = (my + quiet) * moduleSize;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(moduleSize), Math.ceil(moduleSize));
    };

    // Finder pattern
    const drawFinder = (ox: number, oy: number) => {
      const s = 7;
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const isBorder = x === 0 || x === s - 1 || y === 0 || y === s - 1;
          const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          if (isBorder || isCenter) drawModule(ox + x, oy + y);
        }
      }
    };

    // Timing patterns
    const drawTiming = () => {
      for (let i = 8; i < modules - 8; i++) {
        if (i % 2 === 0) {
          drawModule(i, 6);
          drawModule(6, i);
        }
      }
    };

    // Draw finder patterns
    drawFinder(0, 0);
    drawFinder(modules - 7, 0);
    drawFinder(0, modules - 7);

    // Draw timing
    drawTiming();

    // Reserve format info areas (skip drawing random there)
    const reserved = (x: number, y: number) => {
      // Finder areas
      if (x < 7 && y < 7) return true;
      if (x >= modules - 7 && y < 7) return true;
      if (x < 7 && y >= modules - 7) return true;
      // Timing rows/cols
      if (x === 6 || y === 6) return true;
      return false;
    };

    // Fill remaining modules with seeded pattern
    for (let y = 0; y < modules; y++) {
      for (let x = 0; x < modules; x++) {
        if (reserved(x, y)) continue;
        // Use seeded randomness to simulate encoded data
        const r = rng();
        // Bias to create believable density; add slight structure
        const on = r > 0.52 ? true : r > 0.48 && ((x + y) % 3 === 0);
        if (on) drawModule(x, y);
      }
    }
  }, [value, size, foreground, background, quietZoneModules]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
};


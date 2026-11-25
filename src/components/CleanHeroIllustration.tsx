import React, { useEffect, useState } from 'react';

interface CleanHeroIllustrationProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Loads the hero WebP illustration, cleanly removes any baked-in gray/white checkerboard
 * background via edge + enclosed-checkerboard flood-fill while preserving all interior
 * cream paper/eye fills and crisp dark ink outlines, and trims excess side whitespace.
 */
export const CleanHeroIllustration: React.FC<CleanHeroIllustrationProps> = ({
  src,
  alt,
  className = '',
}) => {
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          setProcessedUrl(src);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setProcessedUrl(src);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const total = w * h;

        // Helper: checks if pixel idx is a neutral light gray/white checkerboard pixel
        const isNeutralBgCandidate = (idx: number): boolean => {
          const o = idx * 4;
          const r = data[o];
          const g = data[o + 1];
          const b = data[o + 2];
          const a = data[o + 3];
          if (a < 20) return true;
          const max = r > g ? (r > b ? r : b) : g > b ? g : b;
          const min = r < g ? (r < b ? r : b) : g < b ? g : b;
          // Neutral gray/white has very low saturation (max - min <= 13) and high lightness (min >= 180)
          return max - min <= 13 && min >= 180;
        };

        // 1. Edge-seeded BFS flood-fill (stops cleanly at the character's dark ink outline)
        const visited = new Uint8Array(total);
        const isBg = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        const enqueueIfCandidate = (idx: number) => {
          if (visited[idx]) return;
          visited[idx] = 1;
          if (isNeutralBgCandidate(idx)) {
            isBg[idx] = 1;
            queue[tail++] = idx;
          }
        };

        for (let x = 0; x < w; x++) {
          enqueueIfCandidate(x);
          enqueueIfCandidate((h - 1) * w + x);
        }
        for (let y = 0; y < h; y++) {
          enqueueIfCandidate(y * w);
          enqueueIfCandidate(y * w + (w - 1));
        }

        while (head < tail) {
          const curr = queue[head++];
          const cx = curr % w;
          const cy = (curr - cx) / w;

          if (cx > 0) enqueueIfCandidate(curr - 1);
          if (cx < w - 1) enqueueIfCandidate(curr + 1);
          if (cy > 0) enqueueIfCandidate(curr - w);
          if (cy < h - 1) enqueueIfCandidate(curr + w);
        }

        // 2. Clear enclosed checkerboard holes (e.g., trapped between chair base & legs)
        // A true checkerboard hole has BOTH neutral gray (~195..232) AND pure white (~248..255) pixels,
        // whereas eyes (pure white, tiny) and warm cream paper (warm tint R > B + 10) do not!
        const compBuffer = new Int32Array(total);
        for (let i = 0; i < total; i++) {
          if (visited[i] || !isNeutralBgCandidate(i)) continue;

          let cHead = 0;
          let cTail = 0;
          visited[i] = 1;
          compBuffer[cTail++] = i;
          let grayCount = 0;
          let whiteCount = 0;

          while (cHead < cTail) {
            const p = compBuffer[cHead++];
            const po = p * 4;
            const lum = (data[po] + data[po + 1] + data[po + 2]) / 3;
            if (lum >= 195 && lum <= 235) grayCount++;
            else if (lum >= 246) whiteCount++;

            const px = p % w;
            const py = (p - px) / w;
            const neighbors = [
              px > 0 ? p - 1 : -1,
              px < w - 1 ? p + 1 : -1,
              py > 0 ? p - w : -1,
              py < h - 1 ? p + w : -1,
            ];
            for (const nb of neighbors) {
              if (nb >= 0 && !visited[nb]) {
                visited[nb] = 1;
                if (isNeutralBgCandidate(nb)) {
                  compBuffer[cTail++] = nb;
                }
              }
            }
          }

          // Enclosed region with substantial gray + white squares is definitely trapped checkerboard
          if (cTail > 120 && grayCount > 40 && whiteCount > 40) {
            for (let k = 0; k < cTail; k++) {
              isBg[compBuffer[k]] = 1;
            }
          }
        }

        // 3. Apply transparency + 1px anti-aliased edge softening + compute tight bounding box
        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;

        for (let i = 0; i < total; i++) {
          const o = i * 4;
          if (isBg[i]) {
            data[o + 3] = 0;
          } else {
            const x = i % w;
            const y = (i - x) / w;
            // Soften 1px fringe right against removed checkerboard
            const touchesBg =
              (x > 0 && isBg[i - 1]) ||
              (x < w - 1 && isBg[i + 1]) ||
              (y > 0 && isBg[i - w]) ||
              (y < h - 1 && isBg[i + w]);
            if (touchesBg) {
              const lum = (data[o] + data[o + 1] + data[o + 2]) / 3;
              if (lum > 185) {
                data[o + 3] = 90;
              }
            }
            if (data[o + 3] > 20) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

        if (maxX <= minX || maxY <= minY) {
          setProcessedUrl(src);
          return;
        }

        const pad = 16;
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(w - cropX, maxX - minX + pad * 2);
        const cropH = Math.min(h - cropY, maxY - minY + pad * 2);

        const outCanvas = document.createElement('canvas');
        outCanvas.width = cropW;
        outCanvas.height = cropH;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          setProcessedUrl(canvas.toDataURL('image/png'));
          return;
        }
        outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        setProcessedUrl(outCanvas.toDataURL('image/png'));
      } catch {
        setProcessedUrl(src);
      }
    };
    img.onerror = () => {
      if (!cancelled) setProcessedUrl(src);
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!processedUrl) {
    return (
      <div
        className={`w-full h-64 rounded-xl bg-[#FAF9F6] animate-pulse ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={processedUrl}
      alt={alt}
      className={`select-none object-contain ${className}`}
    />
  );
};

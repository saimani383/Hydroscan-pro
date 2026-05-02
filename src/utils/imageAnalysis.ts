import { ROI } from '../types';

export interface IntensityResult {
  mean: number;
  r: number;
  g: number;
  b: number;
  stdDev: number;
  isStable: boolean;
  isWaterLike: boolean;
}

/**
 * Calculates optical properties of an ROI. 
 * Heuristics are used to differentiate water from solid surfaces.
 */
export function getIntensityInROI(ctx: CanvasRenderingContext2D, roi: ROI): IntensityResult {
  const { x, y, radius } = roi;
  const diameter = radius * 2;
  
  // Safety checks for canvas bounds
  const startX = Math.max(0, Math.floor(x - radius));
  const startY = Math.max(0, Math.floor(y - radius));
  const w = Math.min(diameter, ctx.canvas.width - startX);
  const h = Math.min(diameter, ctx.canvas.height - startY);

  if (w <= 0 || h <= 0) {
    return { mean: 0, r: 0, g: 0, b: 0, stdDev: 0, isStable: false, isWaterLike: false };
  }

  const imageData = ctx.getImageData(startX, startY, w, h);
  const data = imageData.data;

  let totalIntensity = 0;
  let rSum = 0, gSum = 0, bSum = 0;
  let count = 0;
  const pixels: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const brightness = (r + g + b) / 3;
    pixels.push(brightness);
    
    totalIntensity += brightness;
    rSum += r;
    gSum += g;
    bSum += b;
    count++;
  }

  const mean = totalIntensity / count;
  
  // Calculate Standard Deviation
  const variance = pixels.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  // Optical Heuristics
  const rAvg = rSum / count;
  const gAvg = gSum / count;
  const bAvg = bSum / count;

  // 1. Color Balance (Water is generally neutral or slightly blue-green)
  // High variance between channels suggests a colored solid (e.g. skin, wall, desk)
  const maxChannel = Math.max(rAvg, gAvg, bAvg);
  const minChannel = Math.min(rAvg, gAvg, bAvg);
  const saturationProxy = (maxChannel - minChannel) / (mean + 0.1);

  // 2. Texture check (Liquids in clear containers are very smooth)
  const isSmooth = stdDev < 25; 

  return {
    mean,
    r: rAvg,
    g: gAvg,
    b: bAvg,
    stdDev,
    isStable: isSmooth,
    isWaterLike: saturationProxy < 0.4 && mean > 5 && isSmooth,
  };
}

/**
 * Noise reduction simulation (Simple box blur or just averaging).
 * In a real mobile app, we might apply a convolution filter.
 */
export function applyNoiseReduction(data: Uint8ClampedArray, width: number, height: number) {
  // Prototype simplification: we assume the camera source is stabilized
  // or we average multiple frames in the main component.
}

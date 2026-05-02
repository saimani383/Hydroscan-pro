export enum AnalysisStatus {
  IDLE = 'IDLE',
  CALIBRATING = 'CALIBRATING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface AnalysisResult {
  intensityRatio: number; // I / I0
  absorbance: number; // A = -log10(I/I0)
  concentration: number; // c = A / (epsilon * l)
  status: 'Safe' | 'Warning' | 'Unsafe';
  timestamp: number;
}

export interface ROI {
  x: number;
  y: number;
  radius: number;
}

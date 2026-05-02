/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Droplet, 
  Camera, 
  Activity, 
  Settings, 
  ChevronRight, 
  RefreshCcw, 
  Info,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Lightbulb
} from 'lucide-react';
import { AnalysisStatus, AnalysisResult, ROI } from './types';
import { BEER_LAMBERT_CONSTANTS, THRESHOLDS, COLORS } from './constants';
import { getIntensityInROI, IntensityResult } from './utils/imageAnalysis';

// Sub-components
const Header = ({ title, status }: { title: string; status: string }) => (
  <header className="fixed top-0 left-0 right-0 p-4 z-50 flex justify-between items-center bg-[#0D0D0D]/80 backdrop-blur-md border-b border-[#00FF41]/20">
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-[#00FF41] animate-pulse" />
      <h1 className="font-mono text-xs tracking-widest text-[#00FF41] uppercase">{title}</h1>
    </div>
    <div className="font-mono text-[10px] text-[#00FF41]/60 uppercase">
      {status}
    </div>
  </header>
);

const IntensityGraph = ({ history }: { history: number[] }) => {
  const max = Math.max(...history, 255);
  return (
    <div className="h-20 flex items-end gap-[1px] border-b border-[#00FF41]/10 px-2 mt-4">
      {history.map((val, i) => (
        <div 
          key={i} 
          className="flex-1 bg-[#00FF41]/40" 
          style={{ height: `${(val / max) * 100}%` }} 
        />
      ))}
    </div>
  );
};

const FiberOpticGraphic = () => (
  <div className="relative w-48 h-32 mb-8 mx-auto">
    {/* Emitter */}
    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-white/20 border border-white/40 rounded-sm" />
    {/* Sample Cavity */}
    <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-12 bg-[#00FF41]/10 border border-[#00FF41]/30 rounded-lg backdrop-blur-sm overflow-hidden">
      <motion.div 
        animate={{ x: [-100, 200] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-[#00FF41]/40 to-transparent skew-x-12"
      />
    </div>
    {/* Receiver */}
    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-white/20 border border-white/40 rounded-sm" />
    
    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-mono text-gray-600 uppercase tracking-widest whitespace-nowrap">
      FIBER-OPTIC PATH SIMULATION
    </div>
  </div>
);

const LandingScreen = ({ onStart }: { onStart: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="flex flex-col items-center justify-center min-h-screen p-8 text-center"
  >
    <div className="relative mb-8">
      <div className="absolute inset-0 bg-[#00FF41]/20 blur-3xl rounded-full" />
      <div className="relative p-6 border border-[#00FF41]/30 rounded-full">
        <Droplet size={64} className="text-[#00FF41]" />
      </div>
    </div>
    
    <h2 className="text-3xl font-mono text-[#00FF41] mb-2 tracking-tight">AQUASCAN</h2>
    <p className="text-sm text-gray-500 font-mono mb-8 max-w-xs leading-relaxed">
      MOBILE WATER QUALITY PROTOTYPE<br/>
      <span className="opacity-60 text-[10px]">VER 0.1.0-ALPHA</span>
    </p>

    <FiberOpticGraphic />
    
    <div className="w-full space-y-4 mb-12">
      <div className="text-left p-4 border border-[#00FF41]/10 rounded bg-[#00FF41]/5">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb size={14} className="text-[#00FF41]" />
          <span className="text-[10px] font-mono text-[#00FF41] uppercase">Calibration Req</span>
        </div>
        <p className="text-[11px] text-gray-400 font-mono">Ensure flashlight is accessible. System uses light absorption (Beer-Lambert) to detect contaminants.</p>
      </div>
    </div>

    <button 
      onClick={onStart}
      className="group flex items-center gap-3 px-8 py-4 bg-[#00FF41] text-[#0D0D0D] font-mono text-sm font-bold tracking-widest uppercase hover:bg-white transition-colors"
    >
      Initialize System
      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
    </button>
  </motion.div>
);

const AnalysisScreen = ({ onComplete }: { onComplete: (result: AnalysisResult) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [intensity0, setIntensity0] = useState<number | null>(null);
  const [currentIntensity, setCurrentIntensity] = useState<number>(0);
  const [opticalState, setOpticalState] = useState<IntensityResult | null>(null);
  const [intensityHistory, setIntensityHistory] = useState<number[]>([]);
  const [roi, setRoi] = useState<ROI>({ x: 0, y: 0, radius: 40 });
  const [timeLeft, setTimeLeft] = useState(3);
  const [log, setLog] = useState<string[]>(['SYSTEM READY']);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);

  const addLog = (msg: string) => setLog(prev => [msg, ...prev].slice(0, 5));

  const toggleTorch = async (on: boolean) => {
    if (videoTrack && videoTrack.getCapabilities().hasOwnProperty('torch' as any)) {
      try {
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: on }]
        });
        addLog(`TORCH: ${on ? 'ENABLED' : 'DISABLED'}`);
      } catch (err) {
        console.warn('Torch control failed:', err);
      }
    }
  };

  useEffect(() => {
    let stream: MediaStream | null = null;

    const setupCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment', 
            width: { ideal: 640 }, 
            height: { ideal: 640 }
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        const track = stream.getVideoTracks()[0];
        setVideoTrack(track);
        addLog('OPTICAL SENSOR ACTIVE');
      } catch (err) {
        addLog('SENSOR ERROR: CHECK PERMISSIONS');
        console.error(err);
      }
    };

    setupCamera();

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Update history periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setIntensityHistory(prev => [...prev, currentIntensity].slice(-50));
    }, 100);
    return () => clearInterval(interval);
  }, [currentIntensity]);

  // Frame processing loop
  useEffect(() => {
    let animationFrame: number;
    
    const processFrame = () => {
      if (videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const width = canvasRef.current.width;
          const height = canvasRef.current.height;
          
          // Set ROI to center if not set
          if (roi.x === 0) {
            setRoi({ x: width / 2, y: height / 2, radius: 60 });
          }

          ctx.drawImage(videoRef.current, 0, 0, width, height);
          
          const result = getIntensityInROI(ctx, roi);
          setCurrentIntensity(result.mean);
          setOpticalState(result);

          // Draw Overlay
          const overlayColor = !result.isWaterLike ? '#FFCC00' : (status === AnalysisStatus.ANALYZING ? '#FF3131' : '#00FF41');
          ctx.strokeStyle = overlayColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(roi.x, roi.y, roi.radius, 0, Math.PI * 2);
          ctx.stroke();

          // Draw Crosshair
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(roi.x - 20, roi.y); ctx.lineTo(roi.x + 20, roi.y);
          ctx.moveTo(roi.x, roi.y - 20); ctx.lineTo(roi.x, roi.y + 20);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      animationFrame = requestAnimationFrame(processFrame);
    };

    animationFrame = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(animationFrame);
  }, [roi, status]);

  const startCalibration = async () => {
    setStatus(AnalysisStatus.CALIBRATING);
    addLog('CALIBRATING I0 (REF)...');
    await toggleTorch(true);

    let count = 3;
    const interval = setInterval(async () => {
      count--;
      setTimeLeft(count);
      if (count <= 0) {
        clearInterval(interval);
        setIntensity0(currentIntensity);
        setStatus(AnalysisStatus.IDLE);
        addLog(`I0 CAPTURED: ${currentIntensity.toFixed(1)}lx`);
        await toggleTorch(false);
      }
    }, 1000);
  };

  const startAnalysis = async () => {
    if (intensity0 === null) {
      addLog('ERR: CALIBRATE FIRST');
      return;
    }
    setStatus(AnalysisStatus.ANALYZING);
    addLog('ANALYZING SAMPLE...');
    await toggleTorch(true);
    
    let count = 5;
    const interval = setInterval(async () => {
      count--;
      setTimeLeft(count);
      if (count <= 0) {
        clearInterval(interval);
        await toggleTorch(false);
        
        // Final calculation
        const I = currentIntensity;
        const I0 = intensity0;
        const ratio = I / I0;
        const absorbance = -Math.log10(Math.max(ratio, 0.001)); // Avoid log(0)
        const concentration = absorbance / (BEER_LAMBERT_CONSTANTS.EPSILON * BEER_LAMBERT_CONSTANTS.PATH_LENGTH);
        
        let safeStatus: AnalysisResult['status'] = 'Safe';
        if (concentration > THRESHOLDS.WARNING) safeStatus = 'Unsafe';
        else if (concentration > THRESHOLDS.SAFE) safeStatus = 'Warning';

        onComplete({
          intensityRatio: ratio,
          absorbance,
          concentration,
          status: safeStatus,
          timestamp: Date.now()
        });
      }
    }, 1000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col min-h-screen pt-16 p-4"
    >
      <Header title="Analysis Module" status={status} />
      
      {/* Viewport */}
      <div className="relative flex-1 bg-black border border-[#00FF41]/20 rounded-xl overflow-hidden mb-4">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen"
        />
        <canvas 
          ref={canvasRef} 
          width={640} 
          height={640}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
        
        <div className="absolute top-4 left-4 p-2 bg-black/60 border border-[#00FF41]/20 rounded font-mono text-[10px] text-[#00FF41]">
          ROI: {roi.x.toFixed(0)},{roi.y.toFixed(0)} r={roi.radius}<br/>
          INT: {currentIntensity.toFixed(1)} LX<br/>
          SAT: {opticalState ? ((Math.max(opticalState.r, opticalState.g, opticalState.b) - Math.min(opticalState.r, opticalState.g, opticalState.b)) / (opticalState.mean + 1)).toFixed(2) : '0.00'}
        </div>

        {!opticalState?.isWaterLike && status === AnalysisStatus.IDLE && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] p-3 bg-[#FFCC00]/90 text-black font-mono text-[10px] text-center rounded animate-pulse">
            <div className="flex items-center justify-center gap-2 font-bold mb-1">
              <AlertTriangle size={12} />
              SAMPLE VALIDATION FAILED
            </div>
            Target doesn't look like a clear liquid sample. Place voucher/vial in center.
          </div>
        )}

        {status !== AnalysisStatus.IDLE && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="text-center">
              <div className="text-5xl font-mono text-[#00FF41] mb-2">{timeLeft}s</div>
              <div className="text-[10px] font-mono text-[#00FF41] uppercase tracking-[0.2em]">
                {status === AnalysisStatus.CALIBRATING ? 'Detecting Light Source...' : 'Scanning Molecular Absorption...'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data Feed & Controls */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[#00FF41]/5 border border-[#00FF41]/20 rounded flex flex-col justify-between">
            <div className="text-[10px] text-[#00FF41]/60 uppercase font-mono mb-2">Reference (I0)</div>
            <div className="font-mono text-xl text-[#00FF41]">
              {intensity0 ? `${intensity0.toFixed(1)}` : '---'}
            </div>
            <div className="mt-2 text-[8px] font-mono text-[#00FF41]/40">CALIBRATION UNIT</div>
          </div>
          <div className="p-4 bg-white/5 border border-white/10 rounded flex flex-col justify-between">
            <div className="text-[10px] text-white/40 uppercase font-mono mb-2">Current (I)</div>
            <div className="font-mono text-xl text-white">
              {currentIntensity.toFixed(1)}
            </div>
            <div className="mt-2 text-[8px] font-mono text-white/20">LIVE SPECTRAL FEED</div>
          </div>
        </div>

        <IntensityGraph history={intensityHistory} />

        <div className="h-24 p-3 bg-black border border-white/10 rounded font-mono text-[10px] overflow-hidden">
          {log.map((line, i) => (
            <div key={i} className={i === 0 ? 'text-[#00FF41]' : 'text-gray-600'}>
              &gt; {line}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 h-16">
          <button 
            disabled={status !== AnalysisStatus.IDLE}
            onClick={startCalibration}
            className="flex items-center justify-center gap-2 border border-[#00FF41] text-[#00FF41] disabled:opacity-20 font-mono text-[10px] uppercase tracking-widest hover:bg-[#00FF41]/10 transition-colors"
          >
            <RefreshCcw size={14} />
            Calibrate
          </button>
          <button 
            disabled={status !== AnalysisStatus.IDLE || intensity0 === null || !opticalState?.isWaterLike}
            onClick={startAnalysis}
            className="flex items-center justify-center gap-2 bg-[#00FF41] text-black font-mono text-[10px] font-bold uppercase tracking-widest disabled:grayscale disabled:opacity-50 hover:bg-white transition-colors"
          >
            <Activity size={14} />
            Analyze
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const ResultsScreen = ({ result, onReset }: { result: AnalysisResult; onReset: () => void }) => {
  const getStatusColor = () => {
    if (result.status === 'Safe') return '#00FF41';
    if (result.status === 'Warning') return '#FFCC00';
    return '#FF3131';
  };

  const getStatusIcon = () => {
    if (result.status === 'Safe') return <ShieldCheck size={48} />;
    if (result.status === 'Warning') return <Info size={48} />;
    return <AlertTriangle size={48} />;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col min-h-screen pt-16 p-6"
    >
      <Header title="Final Report" status="Report Generated" />
      
      <div className="flex-1 flex flex-col py-8">
        <div className="mb-12 text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ color: getStatusColor() }}
            className="inline-block p-6 border rounded-full mb-6"
          >
            {getStatusIcon()}
          </motion.div>
          <h2 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-2">Verdict</h2>
          <div className="text-4xl font-mono uppercase tracking-tighter" style={{ color: getStatusColor() }}>
            {result.status}
          </div>
        </div>

        <div className="space-y-4 mb-12">
          <div className="grid grid-cols-2 gap-4 p-4 border border-white/10 rounded font-mono text-xs">
            <div className="text-gray-500">Light Transmittance</div>
            <div className="text-right">{(result.intensityRatio * 100).toFixed(1)}%</div>
          </div>
          <div className="grid grid-cols-2 gap-4 p-4 border border-white/10 rounded font-mono text-xs">
            <div className="text-gray-500">Molecular Absorbance</div>
            <div className="text-right">{result.absorbance.toFixed(3)} AU</div>
          </div>
          <div className="grid grid-cols-2 gap-4 p-4 border border-[#00FF41]/20 bg-[#00FF41]/5 rounded font-mono text-xs">
            <div className="text-[#00FF41]">Chemical Concentration</div>
            <div className="text-right text-[#00FF41]">{result.concentration.toFixed(4)} mol/L</div>
          </div>
        </div>

        <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-[#00FF41]" />
            <h3 className="text-[10px] font-mono text-[#00FF41] uppercase">Technical Summary</h3>
          </div>
          <p className="text-[11px] text-gray-400 font-mono leading-relaxed italic">
            "Based on the Beer-Lambert law simulations, the detected light absorption suggests a 
            {result.status === 'Safe' ? ' minimal ' : ' significant '} presence of suspended particulate or chemical agents. 
            Estimated concentration is {result.concentration < 0.1 ? 'below' : 'above'} WHO guideline thresholds for this prototype model."
          </p>
        </div>
      </div>

      <button 
        onClick={onReset}
        className="w-full flex items-center justify-center gap-3 py-5 bg-white text-black font-mono text-xs font-bold tracking-widest uppercase hover:bg-[#00FF41] transition-colors mb-6"
      >
        New Scan
        <RefreshCcw size={16} />
      </button>
    </motion.div>
  );
};

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'analysis' | 'results'>('landing');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleStart = () => setScreen('analysis');
  const handleComplete = (res: AnalysisResult) => {
    setAnalysisResult(res);
    setScreen('results');
  };
  const handleReset = () => {
    setAnalysisResult(null);
    setScreen('landing');
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white selection:bg-[#00FF41] selection:text-black">
      <AnimatePresence mode="wait">
        {screen === 'landing' && (
          <LandingScreen key="landing" onStart={handleStart} />
        )}
        {screen === 'analysis' && (
          <AnalysisScreen key="analysis" onComplete={handleComplete} />
        )}
        {screen === 'results' && analysisResult && (
          <ResultsScreen key="results" result={analysisResult} onReset={handleReset} />
        )}
      </AnimatePresence>
      
      {/* Scanline Effect */}
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
    </div>
  );
}

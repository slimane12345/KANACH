import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Zap, ZapOff } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
  cooldownMs?: number;
  paused?: boolean;
}

export default function BarcodeScanner({ onScan, onError, cooldownMs = 800, paused = false }: BarcodeScannerProps) {
  const [isScanned, setIsScanned] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanTime = useRef<number>(0);

  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 20,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const size = Math.floor(minEdge * 0.7);
              return { width: size, height: Math.floor(size * 0.6) };
            },
            aspectRatio: undefined,
          },
          (decodedText) => {
            if (paused) return;
            const now = Date.now();
            if (now - lastScanTime.current > cooldownMs) {
              lastScanTime.current = now;
              setIsScanned(true);
              onScanRef.current(decodedText);
              
              setTimeout(() => {
                setIsScanned(false);
              }, 400);
            }
          },
          () => {
            // Silently handle scan errors
          }
        );

        const track = (html5QrCode as any).getRunningTrack();
        if (track && track.getCapabilities()?.torch) {
          setHasTorch(true);
        }
      } catch (err) {
        if (onErrorRef.current) onErrorRef.current(err instanceof Error ? err.message : String(err));
      }
    };

    startScanner();

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Error stopping scanner", err));
      }
    };
  }, [cooldownMs, paused]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const newTorchState = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newTorchState } as any]
      });
      setIsTorchOn(newTorchState);
    } catch (err) {
      console.error("Failed to toggle torch", err);
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden rounded-2xl border-2 border-emerald-500/30">
      <div id="reader" className="w-full h-full"></div>
      
      {/* Scanning Animation Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
        {/* Corner Brackets with Pulse */}
        <div className="absolute top-8 left-8 w-10 h-10 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl opacity-80 animate-pulse"></div>
        <div className="absolute top-8 right-8 w-10 h-10 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl opacity-80 animate-pulse"></div>
        <div className="absolute bottom-8 left-8 w-10 h-10 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl opacity-80 animate-pulse"></div>
        <div className="absolute bottom-8 right-8 w-10 h-10 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl opacity-80 animate-pulse"></div>
        
        {/* Scanning Target Area */}
        <div className="w-64 h-40 border-2 border-white/10 rounded-3xl backdrop-brightness-110"></div>
        
        {/* Laser Line */}
        <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_rgba(52,211,153,1)] absolute animate-scan-line"></div>
        
        {/* Success Flash */}
        {isScanned && (
          <div className="absolute inset-0 bg-emerald-500/30 backdrop-blur-[4px] transition-opacity duration-200"></div>
        )}

        {/* Status Text */}
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <span className="bg-black/40 backdrop-blur-sm text-white/70 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-white/10">
            جاري المسح بالهاتف...
          </span>
        </div>
      </div>

      {/* Torch Button */}
      {hasTorch && (
        <button 
          onClick={toggleTorch}
          className="absolute top-4 right-4 p-3 bg-black/50 backdrop-blur-md rounded-full text-white border border-white/20 active:scale-95 transition-transform pointer-events-auto z-20"
        >
          {isTorchOn ? <ZapOff className="w-5 h-5 text-yellow-400" /> : <Zap className="w-5 h-5" />}
        </button>
      )}

      <style>{`
        #reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
        @keyframes scan-line {
          0% { top: 20%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 80%; opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

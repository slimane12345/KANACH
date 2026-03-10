import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please ensure you have given permission.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            onCapture(blob);
            onClose();
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-zinc-900"
        >
          <div className="flex items-center justify-between p-4 text-white">
            <h3 className="text-lg font-semibold">Take Photo</h3>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10">
              <X size={24} />
            </button>
          </div>

          <div className="relative aspect-square w-full bg-black">
            {error ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-zinc-400">
                <p>{error}</p>
                <button 
                  onClick={startCamera}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-black font-medium"
                >
                  <RefreshCw size={18} />
                  Try Again
                </button>
              </div>
            ) : (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="h-full w-full object-cover"
              />
            )}
          </div>

          <div className="flex justify-center p-6">
            <button
              onClick={capturePhoto}
              disabled={!!error}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 transition-transform active:scale-90 disabled:opacity-50"
            >
              <div className="h-12 w-12 rounded-full bg-white" />
            </button>
          </div>
          
          <canvas ref={canvasRef} className="hidden" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

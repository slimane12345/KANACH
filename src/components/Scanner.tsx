import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface ScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0
      },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        onScan(decodedText);
      },
      (error) => {
        // Silent errors for continuous scanning
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear scanner", error);
        });
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="p-4 flex justify-between items-center bg-zinc-900 text-white">
        <h2 className="text-lg font-medium">Scanning...</h2>
        <button 
          onClick={onClose}
          className="px-4 py-2 bg-red-600 rounded-lg text-sm font-semibold"
        >
          Done
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div id="reader" className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-white/20"></div>
      </div>
      <div className="p-8 bg-zinc-900 text-zinc-400 text-center text-sm">
        Point the camera at a barcode to scan.
        <br />
        Duplicates are handled automatically.
      </div>
    </div>
  );
};

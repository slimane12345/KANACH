import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  Timestamp 
} from 'firebase/firestore';
import { Product } from '../types';
import { 
  XCircle, 
  Package, 
  Plus, 
  Check, 
  Smartphone, 
  ArrowLeft,
  Search,
  AlertCircle
} from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Card, Input } from '../App'; // Assuming these are exported or I'll need to redefine them

interface SmartInventoryScanProps {
  user: any;
  onFinish: () => void;
  products: Product[];
}

interface ScannedItem {
  barcode: string;
  product?: Product;
  quantity: number;
  isNew: boolean;
  tempName?: string;
  tempPrice?: string;
}

export default function SmartInventoryScan({ user, onFinish, products }: SmartInventoryScanProps) {
  const [isScanning, setIsScanning] = useState(true);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [showNewProductForm, setShowNewProductForm] = useState<string | null>(null);
  const [newProductData, setNewProductData] = useState({ name: '', price: '', costPrice: '', lowStockThreshold: '5' });
  const [saving, setSaving] = useState(false);

  // Preloaded Product Map for O(1) lookup
  const barcodeMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => {
      if (p.barcode) map.set(p.barcode, p);
    });
    return map;
  }, [products]);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (e) {
      console.log('Audio feedback failed', e);
    }
  };

  const handleBarcodeScanned = (barcode: string) => {
    setLastScanned(barcode);
    playBeep();
    
    setScannedItems(prev => {
      const existingIndex = prev.findIndex(item => item.barcode === barcode);
      
      if (existingIndex !== -1) {
        const newItems = [...prev];
        newItems[existingIndex].quantity += 1;
        return newItems;
      } else {
        const existingProduct = barcodeMap.get(barcode);
        if (existingProduct) {
          return [...prev, { barcode, product: existingProduct, quantity: 1, isNew: false }];
        } else {
          setShowNewProductForm(barcode);
          return [...prev, { barcode, quantity: 1, isNew: true }];
        }
      }
    });
  };

  const handleNewProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showNewProductForm) return;

    setScannedItems(prev => prev.map(item => 
      item.barcode === showNewProductForm 
        ? { ...item, tempName: newProductData.name, tempPrice: newProductData.price } 
        : item
    ));

    setShowNewProductForm(null);
    setNewProductData({ name: '', price: '', costPrice: '', lowStockThreshold: '5' });
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      for (const item of scannedItems) {
        if (item.isNew && item.tempName && item.tempPrice) {
          // Create new product
          await addDoc(collection(db, 'products'), {
            name: item.tempName,
            price: Number(item.tempPrice),
            costPrice: Number(item.tempPrice) * 0.7, // Simulated cost price
            stock: item.quantity,
            lowStockThreshold: 5,
            barcode: item.barcode,
            ownerId: user.uid,
            createdAt: Timestamp.now()
          });
        } else if (item.product) {
          // Update existing product stock
          await updateDoc(doc(db, 'products', item.product.id), {
            stock: item.product.stock + item.quantity
          });
        }
      }
      onFinish();
    } catch (error) {
      console.error('Save inventory failed', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col">
      {/* Header */}
      <div className="bg-emerald-600 text-white p-6 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={onFinish} className="p-2 hover:bg-white/10 rounded-xl">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-black">جرد السلعة (Scan)</h2>
        </div>
        <button 
          onClick={handleFinish}
          disabled={scannedItems.length === 0 || saving}
          className="bg-white text-emerald-600 px-6 py-2 rounded-xl font-black disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ الكل'}
        </button>
      </div>

      {/* Scanner View */}
      <div className="relative h-64 bg-slate-900 flex items-center justify-center overflow-hidden">
        <BarcodeScanner 
          onScan={(barcode) => handleBarcodeScanned(barcode)}
          onError={(error) => console.log(error)}
        />
      </div>

      {/* Scanned List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="font-black text-slate-800">السلع الممسوحة ({scannedItems.length})</h3>
          {lastScanned && (
            <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full font-bold">
              آخر باركود: {lastScanned}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {scannedItems.map((item, index) => (
              <motion.div 
                key={item.barcode}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-4 rounded-3xl border border-emerald-50 shadow-sm flex justify-between items-center"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-2xl",
                    item.isNew ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                  )}>
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">
                      {item.isNew ? (item.tempName || 'سلعة جديدة') : item.product?.name}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{item.barcode}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-black text-emerald-900">x{item.quantity}</div>
                    {item.isNew && !item.tempName && (
                      <button 
                        onClick={() => setShowNewProductForm(item.barcode)}
                        className="text-[10px] text-amber-600 font-bold underline"
                      >
                        عمر المعلومات
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )).reverse()}
          </AnimatePresence>

          {scannedItems.length === 0 && (
            <div className="text-center py-12 space-y-4 opacity-30">
              <Search className="w-12 h-12 mx-auto" />
              <p className="font-bold">باقي ما سكانيتي والو</p>
            </div>
          )}
        </div>
      </div>

      {/* New Product Modal */}
      {showNewProductForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[40px] p-8 max-w-sm w-full space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900">معلومات السلعة</h3>
              <button onClick={() => setShowNewProductForm(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl flex items-center gap-3 text-amber-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              هاد الباركود جديد، دخل السمية والثمن باش تعقل عليه.
            </div>
            <form onSubmit={handleNewProductSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 mr-2 uppercase">الباركود</label>
                <div className="bg-slate-100 p-3 rounded-xl font-mono text-sm text-slate-500">{showNewProductForm}</div>
              </div>
              <Input 
                label="سمية السلعة" 
                placeholder="مثلا: كوكا كولا 1.5L" 
                value={newProductData.name}
                onChange={e => setNewProductData({...newProductData, name: e.target.value})}
                required
              />
              <Input 
                label="ثمن البيع (DH)" 
                type="number"
                placeholder="0.00" 
                value={newProductData.price}
                onChange={e => setNewProductData({...newProductData, price: e.target.value})}
                required
              />
              <Button type="submit" className="w-full">تأكيد</Button>
            </form>
          </motion.div>
        </div>
      )}

      <style>{`
        @keyframes scan-line {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
      `}</style>
    </div>
  );
}

// Helper function for tailwind classes (copied from App.tsx)
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

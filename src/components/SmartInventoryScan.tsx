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
import { Product, Category } from '../types';
import { 
  XCircle, 
  Package, 
  Plus, 
  Check, 
  Smartphone, 
  ArrowLeft,
  Search,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Card, Input } from '../App';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SmartInventoryScanProps {
  user: any;
  onFinish: () => void;
  products: Product[];
  categories: Category[];
}

interface ScannedItem {
  barcode: string;
  product?: Product;
  quantity: number;
  isNew: boolean;
  tempName?: string;
  tempPrice?: string;
}

export default function SmartInventoryScan({ user, onFinish, products, categories }: SmartInventoryScanProps) {
  const [step, setStep] = useState<'category' | 'scanning' | 'summary'>('category');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [showNewProductForm, setShowNewProductForm] = useState<string | null>(null);
  const [newProductData, setNewProductData] = useState({ name: '', price: '', costPrice: '', lowStockThreshold: '5' });
  const [saving, setSaving] = useState(false);

  const selectedCategory = useMemo(() => 
    categories.find(c => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  // Preloaded Product Map for O(1) lookup
  const barcodeMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => {
      if (p.barcode) map.set(p.barcode, p);
    });
    return map;
  }, [products]);

  // Map for bulk barcodes (cartons/boxes)
  const bulkBarcodeMap = useMemo(() => {
    const map = new Map<string, { product: Product; quantity: number; label: string }>();
    products.forEach(p => {
      if (p.bulkBarcodes) {
        p.bulkBarcodes.forEach(bb => {
          map.set(bb.barcode, { product: p, quantity: bb.quantity, label: bb.label });
        });
      }
    });
    return map;
  }, [products]);

  const stats = useMemo(() => {
    const existing = scannedItems.filter(i => !i.isNew).length;
    const newItems = scannedItems.filter(i => i.isNew).length;
    const totalQty = scannedItems.reduce((acc, i) => acc + i.quantity, 0);
    return { existing, newItems, totalQty };
  }, [scannedItems]);

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
    if (showNewProductForm) return; // Don't scan while form is open
    
    setLastScanned(barcode);
    playBeep();
    
    setScannedItems(prev => {
      const existingIndex = prev.findIndex(item => item.barcode === barcode);
      
      if (existingIndex !== -1) {
        const newItems = [...prev];
        const bulkMatch = bulkBarcodeMap.get(barcode);
        newItems[existingIndex].quantity += bulkMatch ? bulkMatch.quantity : 1;
        return newItems;
      } else {
        const bulkMatch = bulkBarcodeMap.get(barcode);
        if (bulkMatch) {
          return [...prev, { barcode, product: bulkMatch.product, quantity: bulkMatch.quantity, isNew: false }];
        }

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
          await addDoc(collection(db, 'products'), {
            name: item.tempName,
            price: Number(item.tempPrice),
            costPrice: Number(item.tempPrice) * 0.7,
            stock: item.quantity,
            lowStockThreshold: 5,
            barcode: item.barcode,
            categoryId: selectedCategoryId || '',
            categoryName: selectedCategory ? selectedCategory.name : '',
            ownerId: user.uid,
            createdAt: Timestamp.now()
          });
        } else if (item.product) {
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

  if (step === 'category') {
    return (
      <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col">
        <div className="bg-emerald-600 text-white p-6 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-3">
            <button onClick={onFinish} className="p-2 hover:bg-white/10 rounded-xl">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black">اختار الفئة أولاً</h2>
          </div>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <p className="text-slate-500 font-bold text-sm mb-2">الفئة اللي غاتزاد فيها السلعة الجديدة:</p>
          <div className="grid grid-cols-1 gap-3">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategoryId(cat.id);
                  setStep('scanning');
                }}
                className={cn(
                  "p-5 rounded-[32px] border-2 text-right flex items-center justify-between transition-all active:scale-95",
                  selectedCategoryId === cat.id 
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100" 
                    : "bg-white border-emerald-50 text-slate-700 hover:border-emerald-200"
                )}
              >
                <span className="font-black text-lg">{cat.name}</span>
                <div className={cn(
                  "p-2 rounded-xl",
                  selectedCategoryId === cat.id ? "bg-white/20" : "bg-emerald-50 text-emerald-600"
                )}>
                  <Plus className="w-5 h-5" />
                </div>
              </button>
            ))}
            
            <button
              onClick={() => {
                setSelectedCategoryId(null);
                setStep('scanning');
              }}
              className="p-5 rounded-[32px] border-2 border-dashed border-slate-200 text-slate-400 text-center font-bold hover:bg-slate-50 transition-all"
            >
              بدون فئة محددة
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'summary') {
    return (
      <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col">
        <div className="bg-emerald-600 text-white p-6 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('scanning')} className="p-2 hover:bg-white/10 rounded-xl">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black">ملخص الجرد</h2>
          </div>
          {selectedCategory && (
            <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
              {selectedCategory.name}
            </div>
          )}
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center p-4 bg-white">
              <div className="text-2xl font-black text-emerald-600">{stats.totalQty}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">مجموع القطع</div>
            </Card>
            <Card className="text-center p-4 bg-white">
              <div className="text-2xl font-black text-blue-600">{stats.existing}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">سلعة كاينة</div>
            </Card>
            <Card className="text-center p-4 bg-white">
              <div className="text-2xl font-black text-amber-600">{stats.newItems}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">سلعة جديدة</div>
            </Card>
          </div>

          <div className="space-y-3">
            <h3 className="font-black text-slate-800">تفاصيل السلع</h3>
            {scannedItems.map((item) => (
              <div key={item.barcode} className="bg-white p-4 rounded-3xl border border-slate-100 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-800">
                    {item.isNew ? (item.tempName || 'سلعة غير معروفة') : item.product?.name}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">{item.barcode}</div>
                </div>
                <div className="text-xl font-black text-emerald-900">x{item.quantity}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-100">
          <Button 
            onClick={handleFinish} 
            disabled={saving}
            className="w-full py-4 text-lg"
          >
            {saving ? 'جاري الحفظ...' : 'تأكيد وحفظ الكل'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col">
      {/* Header */}
      <div className="bg-emerald-600 text-white p-6 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('category')} className="p-2 hover:bg-white/10 rounded-xl">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="text-right">
            <h2 className="text-xl font-black leading-tight">جرد السلعة (Scan)</h2>
            {selectedCategory && (
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">الفئة: {selectedCategory.name}</p>
            )}
          </div>
        </div>
        <button 
          onClick={() => setStep('summary')}
          disabled={scannedItems.length === 0}
          className="bg-white text-emerald-600 px-6 py-2 rounded-xl font-black disabled:opacity-50"
        >
          مراجعة ({scannedItems.length})
        </button>
      </div>

      {/* Scanner View */}
      <div className="relative h-64 bg-slate-900 flex items-center justify-center overflow-hidden">
        <BarcodeScanner 
          onScan={(barcode) => handleBarcodeScanned(barcode)}
          onError={(error) => console.log(error)}
          paused={!!showNewProductForm}
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


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import SmartInventoryScan from './components/SmartInventoryScan';
import BarcodeScanner from './components/BarcodeScanner';
import { auth, db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  Phone,
  MessageSquare,
  Smartphone,
  Lock,
  UserPlus,
  LogIn
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  setDoc,
  updateDoc, 
  doc, 
  deleteDoc,
  getDoc,
  getDocs,
  Timestamp,
  orderBy,
  limit,
  increment
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Plus, 
  Search, 
  LogOut, 
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  History,
  ChevronRight,
  ArrowLeft,
  Gift,
  Copy,
  Share2,
  Check,
  ScanLine,
  PlusCircle,
  Minus,
  CreditCard,
  Wallet,
  QrCode,
  Trash2,
  Pencil,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Product, Category, BulkBarcode, Sale, Customer, CreditTransaction, UserProfile, DailyReport, AppNotification, Supplier, SupplyOrder, SupplyOrderItem, SupplierPayment } from './types';
import AdminDashboard from './components/AdminDashboard';
import CustomerCreditPage from './components/CustomerCreditPage';
import SubscriptionPage from './components/SubscriptionPage';
import { QRCodeSVG } from 'qrcode.react';
import { utils, read, writeFile } from 'xlsx';
import { FileUp, FileDown, Download, Tags, Star, Zap, TrendingUp, Sparkles, Upload, Camera, X, Image as ImageIcon } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { db as localDb } from './db';
import { CameraModal } from './components/CameraModal';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

export const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) => {
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200',
    secondary: 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-50 shadow-sm',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200',
    ghost: 'bg-transparent text-emerald-600 hover:bg-emerald-50'
  };

  return (
    <button 
      className={cn(
        'px-6 py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 text-lg shadow-md',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white rounded-3xl p-6 shadow-sm border border-emerald-50', className)} {...props}>
    {children}
  </div>
);

export const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div className="flex flex-col gap-2 w-full">
    <label className="text-sm font-bold text-emerald-800 ml-2">{label}</label>
    <input 
      className="px-4 py-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg"
      {...props}
    />
  </div>
);

// --- Main App ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null, onIndexError?: (url: string) => void) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // If it's an index error, show a more helpful message in console and UI
  if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
    const urlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
    if (urlMatch && onIndexError) {
      onIndexError(urlMatch[0]);
    }
    console.warn('%c INDEX REQUIRED: %c Click the link in the error message above to create the required Firestore index.', 'background: #ff0000; color: #fff; font-weight: bold; padding: 2px 4px; border-radius: 4px;', 'color: #ff0000; font-weight: bold;');
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'credits' | 'dashboard' | 'report' | 'subscription' | 'suppliers'>('dashboard');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [credits, setCredits] = useState<CreditTransaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [publicCreditId, setPublicCreditId] = useState<string | null>(null);
  const [prefilledBarcode, setPrefilledBarcode] = useState<string>('');
  const [preselectedProductForOrder, setPreselectedProductForOrder] = useState<Product | null>(null);
  const [missingIndexUrl, setMissingIndexUrl] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/credit/')) {
      const id = path.split('/credit/')[1];
      if (id) setPublicCreditId(id);
    }
  }, []);

  // Phone + Password Auth State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authStep, setAuthStep] = useState<'method' | 'phone'>('method');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const qProducts = query(collection(db, 'products'), where('ownerId', '==', user.uid));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products', setMissingIndexUrl);
    });

    const qCategories = query(collection(db, 'categories'), where('ownerId', '==', user.uid));
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories', setMissingIndexUrl);
    });

    const qSales = query(collection(db, 'sales'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'), limit(100));
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales', setMissingIndexUrl);
    });

    const qCustomers = query(collection(db, 'customers'), where('ownerId', '==', user.uid));
    const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers', setMissingIndexUrl);
    });

    const qCredits = query(collection(db, 'credits'), where('ownerId', '==', user.uid), orderBy('date', 'desc'));
    const unsubCredits = onSnapshot(qCredits, (snapshot) => {
      setCredits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditTransaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'credits', setMissingIndexUrl);
    });

    const qSuppliers = query(collection(db, 'suppliers'), where('ownerId', '==', user.uid));
    const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'suppliers', setMissingIndexUrl);
    });

    const qSupplyOrders = query(collection(db, 'supply_orders'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubSupplyOrders = onSnapshot(qSupplyOrders, (snapshot) => {
      setSupplyOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplyOrder)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'supply_orders', setMissingIndexUrl);
    });

    const qSupplierPayments = query(collection(db, 'supplier_payments'), where('ownerId', '==', user.uid), orderBy('date', 'desc'));
    const unsubSupplierPayments = onSnapshot(qSupplierPayments, (snapshot) => {
      setSupplierPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierPayment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'supplier_payments', setMissingIndexUrl);
    });

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Check for subscription expiry
        const now = new Date();
        const endDate = data.subscriptionEndDate?.toDate ? data.subscriptionEndDate.toDate() : new Date(data.subscriptionEndDate);
        
        if (endDate < now && data.subscriptionStatus !== 'expired' && data.subscriptionStatus !== 'pending') {
          updateDoc(doc(db, 'users', user.uid), { subscriptionStatus: 'expired' });
        }

        // Bootstrap admin role if email matches
        if (user.email === 'elegancecom71@gmail.com' && data.role !== 'admin') {
          updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
        }
        setUserProfile({ uid: docSnap.id, ...data } as UserProfile);
        setShowSetup(false);
      } else {
        setShowSetup(true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`, setMissingIndexUrl);
    });

    // Check for daily report notification
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const qReport = query(
      collection(db, 'daily_reports'),
      where('shopId', '==', user.uid),
      where('date', '==', todayStr)
    );
    const unsubReport = onSnapshot(qReport, (snapshot) => {
      if (!snapshot.empty) {
        const reportNotif: AppNotification = {
          id: 'daily-report-' + todayStr,
          title: 'تقرير اليوم واجد!',
          message: 'شوف ملخص المبيعات ديالك ديال اليوم.',
          type: 'info',
          read: false,
          timestamp: Timestamp.now()
        };
        setNotifications(prev => {
          if (prev.some(n => n.id === reportNotif.id)) return prev;
          return [reportNotif, ...prev];
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'daily_reports', setMissingIndexUrl);
    });

    // Check for low stock products
    const lowStockProducts = products.filter(p => p.stock <= p.lowStockThreshold);
    if (lowStockProducts.length > 0) {
      const stockNotif: AppNotification = {
        id: 'low-stock-' + todayStr,
        title: 'تنبيه: السلعة قربات تسالي',
        message: `عندك ${lowStockProducts.length} سلعة قربات تسالي. خاصك تعمر الستوك.`,
        type: 'warning',
        read: false,
        timestamp: Timestamp.now()
      };
      setNotifications(prev => {
        if (prev.some(n => n.id === stockNotif.id)) return prev;
        return [stockNotif, ...prev];
      });
    }

    return () => {
      unsubProducts();
      unsubCategories();
      unsubSales();
      unsubCustomers();
      unsubCredits();
      unsubSuppliers();
      unsubSupplyOrders();
      unsubSupplierPayments();
      unsubProfile();
      unsubReport();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login failed', error);
      if (error.code === 'auth/unauthorized-domain') {
        alert('خطأ: هاد النطاق (Domain) ما مسموحش بيه فـ Firebase. خاصك تزيد هاد الرابط فـ Authorized Domains فـ Firebase Console.');
      } else if (error.code === 'auth/operation-not-allowed') {
        alert('خطأ: تسجيل الدخول بـ Google ما مفعلش فـ Firebase. خاصك تفعلو فـ Sign-in method فـ Firebase Console.');
      } else {
        alert('وقع مشكل فالدخول: ' + error.message);
      }
    }
  };

  const handleLogout = () => auth.signOut();

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 8 || password.length < 6) {
      alert('الرقم خاص يكون صحيح وكلمة السر فيها على الأقل 6 حروف');
      return;
    }

    setAuthLoading(true);
    // Map phone to a dummy email format for Firebase Email/Pass Auth
    const email = `${phoneNumber.replace(/\s+/g, '')}@kanach.app`;

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error('Phone auth failed', error);
      if (error.code === 'auth/user-not-found') {
        alert('هاد الرقم ما كاينش، واش بغيتي تسجل حساب جديد؟');
        setIsRegistering(true);
      } else if (error.code === 'auth/wrong-password') {
        alert('كلمة السر غلط، عاود جرب');
      } else if (error.code === 'auth/email-already-in-use') {
        alert('هاد الرقم ديجا مسجل، دخل بكلمة السر ديالك');
        setIsRegistering(false);
      } else {
        alert('وقع مشكل: ' + error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  if (publicCreditId) {
    return <CustomerCreditPage customerId={publicCreditId} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-[40px] shadow-xl max-w-md w-full border border-emerald-100">
          <div className="bg-emerald-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-black text-emerald-900 mb-2">KANACH</h1>
          <p className="text-emerald-700 mb-8 text-sm">كناش ديجيتال باش تنظم حانوتك بكل سهولة</p>

          <AnimatePresence mode="wait">
            {authStep === 'method' && (
              <motion.div 
                key="method"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <Button onClick={handleLogin} className="w-full py-5 text-lg bg-white text-emerald-900 border border-emerald-100 hover:bg-emerald-50 shadow-none">
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  دخول بـ Google
                </Button>
                <div className="flex items-center gap-4 my-4">
                  <div className="h-px bg-emerald-100 flex-1"></div>
                  <span className="text-emerald-300 text-xs font-bold">أو</span>
                  <div className="h-px bg-emerald-100 flex-1"></div>
                </div>
                <Button onClick={() => setAuthStep('phone')} className="w-full py-5 text-lg">
                  <Smartphone className="w-5 h-5" />
                  دخول برقم الهاتف
                </Button>
              </motion.div>
            )}

            {authStep === 'phone' && (
              <motion.div 
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-right">
                  <button onClick={() => setAuthStep('method')} className="text-emerald-600 text-sm font-bold flex items-center gap-1 mb-4">
                    <ArrowLeft className="w-4 h-4" /> رجوع
                  </button>
                  
                  <div className="space-y-4">
                    <Input 
                      label="رقم الهاتف" 
                      placeholder="06XXXXXXXX" 
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                    <Input 
                      label="كلمة السر" 
                      placeholder="******" 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <button 
                      onClick={() => setIsRegistering(!isRegistering)}
                      className="text-emerald-600 text-xs font-bold underline"
                    >
                      {isRegistering ? 'عندي حساب ديجا' : 'ماعنديش حساب؟ تسجل دابا'}
                    </button>
                  </div>
                </div>

                <Button onClick={handlePhoneAuth} disabled={authLoading || !phoneNumber || !password} className="w-full py-5">
                  {authLoading ? 'جاري التحميل...' : (isRegistering ? 'تسجيل حساب جديد' : 'دخول')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  if (showSetup && user) {
    return <SetupView user={user} />;
  }

  if (userProfile?.role === 'admin' && isAdminMode) {
    return <AdminDashboard adminUser={userProfile} onBackToApp={() => setIsAdminMode(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-24 font-sans text-emerald-950">
      {/* Header */}
      <header className="bg-white border-b border-emerald-50 px-6 py-4 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl">
            <Package className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tight text-emerald-900">KANACH</span>
        </div>
        <div className="flex items-center gap-2">
          {notifications.some(n => !n.read) && (
            <button 
              onClick={() => setActiveTab('report')}
              className="relative p-2 text-emerald-600"
            >
              <Bell className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-3 h-3 bg-rose-500 border-2 border-white rounded-full"></span>
            </button>
          )}
          {userProfile?.role === 'admin' && (
            <button 
              onClick={() => setIsAdminMode(true)}
              className="p-2 text-emerald-400 hover:text-emerald-600 transition-colors"
              title="Admin Dashboard"
            >
              <LayoutDashboard className="w-6 h-6" />
            </button>
          )}
          <button onClick={handleLogout} className="p-2 text-emerald-400 hover:text-rose-500 transition-colors">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {missingIndexUrl && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm space-y-3">
            <div className="flex items-center gap-2 font-black">
              <AlertCircle className="w-5 h-5" />
              <span>خاصك تفعل الفهرس (Index)</span>
            </div>
            <p>باش التطبيق يخدم مزيان، خاصك تضغط على الرابط لتحت وتفعل الفهرس في Firebase Console:</p>
            <a 
              href={missingIndexUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full py-3 bg-rose-600 text-white text-center rounded-xl font-bold hover:bg-rose-700 transition-colors"
            >
              تفعيل الفهرس دابا
            </a>
            <button 
              onClick={() => setMissingIndexUrl(null)}
              className="w-full text-center text-xs text-rose-400 font-bold"
            >
              إخفاء التنبيه
            </button>
          </div>
        )}
        <AnimatePresence mode="wait">
          {activeTab === 'sales' && <SalesView products={products} categories={categories} sales={sales} customers={customers} user={user} onAddProduct={(barcode) => {
            setPrefilledBarcode(barcode);
            setActiveTab('products');
          }} />}
          {activeTab === 'products' && <ProductsView products={products} categories={categories} user={user} prefilledBarcode={prefilledBarcode} onClearPrefilled={() => setPrefilledBarcode('')} onOpenSuppliers={(p) => {
            setPreselectedProductForOrder(p || null);
            setActiveTab('suppliers');
          }} />}
          {activeTab === 'credits' && <CreditsView customers={customers} credits={credits} user={user} />}
          {activeTab === 'dashboard' && <DashboardView sales={sales} products={products} customers={customers} onOpenReport={() => setActiveTab('report')} onOpenSubscription={() => setActiveTab('subscription')} onOpenSuppliers={(p) => {
            setPreselectedProductForOrder(p || null);
            setActiveTab('suppliers');
          }} userProfile={userProfile} user={user} />}
          {activeTab === 'report' && <DailyReportView sales={sales} credits={credits} user={user!} />}
          {activeTab === 'suppliers' && <SuppliersView suppliers={suppliers} supplyOrders={supplyOrders} supplierPayments={supplierPayments} products={products} user={user!} preselectedProduct={preselectedProductForOrder} onClearPreselected={() => setPreselectedProductForOrder(null)} />}
          {activeTab === 'subscription' && <SubscriptionPage userProfile={userProfile} onBack={() => setActiveTab('dashboard')} />}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-emerald-50 px-2 py-3 flex justify-around items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <NavButton 
          active={activeTab === 'sales'} 
          onClick={() => setActiveTab('sales')} 
          icon={<ShoppingCart />} 
          label="مبيعات" 
        />
        <NavButton 
          active={activeTab === 'products'} 
          onClick={() => setActiveTab('products')} 
          icon={<Package />} 
          label="سلعة" 
        />
        <NavButton 
          active={activeTab === 'credits'} 
          onClick={() => setActiveTab('credits')} 
          icon={<Users />} 
          label="كريدي" 
        />
        <NavButton 
          active={activeTab === 'suppliers'} 
          onClick={() => setActiveTab('suppliers')} 
          icon={<Truck />} 
          label="موردين" 
        />
        <NavButton 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
          icon={<LayoutDashboard />} 
          label="حسابات" 
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-300",
        active ? "text-emerald-600 bg-emerald-50" : "text-emerald-300"
      )}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" })}
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}

// --- Views ---

function SalesView({ products, categories, sales, customers, user, onAddProduct }: { products: Product[]; categories: Category[]; sales: Sale[]; customers: Customer[]; user: User; onAddProduct: (barcode: string) => void }) {
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'qr' | null>(null);
  const [selectedCustomerForCredit, setSelectedCustomerForCredit] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [isCartBouncing, setIsCartBouncing] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<{ id: string; name: string; price: number; time: number }[]>([]);

  useEffect(() => {
    if (recentScans.length > 0) {
      const timer = setTimeout(() => {
        setRecentScans(prev => prev.slice(0, prev.length - 1));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [recentScans]);

  const [customProduct, setCustomProduct] = useState({ name: '', price: '' });
  const [showCustomAdd, setShowCustomAdd] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

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

  // Calculate most sold products
  const mostSoldIds = useMemo(() => {
    const counts: { [id: string]: number } = {};
    sales.forEach(s => {
      counts[s.productId] = (counts[s.productId] || 0) + s.quantity;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => id);
  }, [sales]);

  const mostSoldProducts = useMemo(() => {
    return mostSoldIds
      .map(id => products.find(p => p.id === id))
      .filter((p): p is Product => !!p);
  }, [mostSoldIds, products]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aIndex = mostSoldIds.indexOf(a.id);
      const bIndex = mostSoldIds.indexOf(b.id);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });
  }, [products, mostSoldIds]);

  const filteredProducts = sortedProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const cartItems = Object.entries(cart).map(([id, quantity]) => {
    const product = products.find(p => p.id === id);
    return { product, quantity };
  }).filter(item => item.product !== undefined) as { product: Product; quantity: number }[];

  const total = cartItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

  const addToCart = (product: Product) => {
    setCart(prev => ({
      ...prev,
      [product.id]: (prev[product.id] || 0) + 1
    }));
    playBeep();
    setIsCartBouncing(true);
    setLastAddedId(product.id);
    setTimeout(() => {
      setIsCartBouncing(false);
      setLastAddedId(null);
    }, 300);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[productId] > 1) {
        newCart[productId] -= 1;
      } else {
        delete newCart[productId];
      }
      return newCart;
    });
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0 || !paymentMethod) return;

    // Check stock before processing
    const outOfStockItems = cartItems.filter(item => item.product.stock < item.quantity);
    if (outOfStockItems.length > 0) {
      const itemNames = outOfStockItems.map(item => item.product.name).join(', ');
      alert(`عفواً، هاد السلع تقاضاو من الستوك: ${itemNames}. نقص الكمية ولا حيدهم باش تكمل.`);
      return;
    }

    if (paymentMethod === 'credit' && !selectedCustomerForCredit) {
      alert('اختار الكليان لي غايدير الكريدي');
      return;
    }

    try {
      for (const item of cartItems) {
        const totalPrice = item.product.price * item.quantity;
        const profit = (item.product.price - item.product.costPrice) * item.quantity;

        await addDoc(collection(db, 'sales'), {
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          totalPrice,
          profit,
          paymentMethod,
          customerId: paymentMethod === 'credit' ? selectedCustomerForCredit : null,
          ownerId: user.uid,
          createdAt: Timestamp.now()
        });

        // Update stock
        await updateDoc(doc(db, 'products', item.product.id), {
          stock: item.product.stock - item.quantity
        });

        // If credit, update customer debt
        if (paymentMethod === 'credit') {
          const customer = customers.find(c => c.id === selectedCustomerForCredit);
          if (customer) {
            await updateDoc(doc(db, 'customers', customer.id), {
              totalDebt: customer.totalDebt + totalPrice,
              updatedAt: new Date().toISOString()
            });
            
            // Also add to credits collection
            await addDoc(collection(db, 'credits'), {
              customerId: customer.id,
              customerName: customer.name,
              amount: totalPrice,
              note: `تقضية: ${item.product.name} x${item.quantity}`,
              date: Timestamp.now(),
              status: 'unpaid',
              type: 'credit',
              ownerId: user.uid
            });
          }
        }
      }

      setCart({});
      setIsCheckoutOpen(false);
      setPaymentMethod(null);
      setSelectedCustomerForCredit('');
      alert('تمت العملية بنجاح!');
    } catch (error) {
      console.error('Checkout failed', error);
      alert('وقع مشكل فالتسجيل');
    }
  };

  const handleAddCustom = async () => {
    if (!customProduct.name || !customProduct.price) return;
    const price = Number(customProduct.price);
    
    try {
      // For custom products, we just record a sale without a linked product or with a dummy one
      // In this case, let's just add it to the cart as a temporary item if we had a way, 
      // but the current schema relies on productId. 
      // Let's create a "Custom" product if it doesn't exist or just alert.
      // Better: Add it to the cart with a special ID or just record it immediately.
      
      await addDoc(collection(db, 'sales'), {
        productId: 'custom',
        productName: customProduct.name,
        quantity: 1,
        totalPrice: price,
        profit: price * 0.1, // Assume 10% profit for custom items
        paymentMethod: 'cash',
        ownerId: user.uid,
        createdAt: Timestamp.now()
      });

      setCustomProduct({ name: '', price: '' });
      setShowCustomAdd(false);
      alert('تم تسجيل البيع');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] -mt-2">
      {/* Search & Scan */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors w-5 h-5" />
          <input 
            className="w-full pl-12 pr-12 py-3 rounded-[20px] border border-slate-100 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-base font-bold transition-all"
            placeholder="قلب على السلعة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
        <button 
          onClick={() => setIsScanning(!isScanning)}
          className={cn(
            "p-3 rounded-[20px] border transition-all active:scale-90 shadow-sm",
            isScanning 
              ? "bg-emerald-600 border-emerald-600 text-white shadow-emerald-200" 
              : "bg-white border-slate-100 text-emerald-600 hover:border-emerald-200"
          )}
        >
          <Smartphone className="w-5 h-5" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
        <button 
          onClick={() => setSelectedCategory('all')}
          className={cn(
            "px-6 py-2.5 rounded-2xl font-black whitespace-nowrap transition-all text-sm",
            selectedCategory === 'all' 
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/10 scale-105" 
              : "bg-white text-slate-500 border border-slate-100 hover:border-emerald-200 hover:text-emerald-600"
          )}
        >
          الكل
        </button>
        {categories.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "px-6 py-2.5 rounded-2xl font-black whitespace-nowrap transition-all text-sm",
              selectedCategory === cat.id 
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/10 scale-105" 
                : "bg-white text-slate-500 border border-slate-100 hover:border-emerald-200 hover:text-emerald-600"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {isScanning && (
        <div className="bg-slate-900 rounded-3xl p-2 mb-4 text-center relative overflow-hidden h-64">
          <BarcodeScanner 
            cooldownMs={800}
            onScan={(barcode) => {
              const product = barcodeMap.get(barcode);
              if (product) {
                addToCart(product);
                
                // Add to recent scans
                const newScan = { 
                  id: Math.random().toString(), 
                  name: product.name, 
                  price: product.price, 
                  time: Date.now() 
                };
                setRecentScans(prev => [newScan, ...prev].slice(0, 3));
                setScanError(null);
              } else {
                setScanError(barcode);
              }
            }}
            onError={(error) => console.log(error)}
          />
          
          {/* Recent Scans Overlay */}
          <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
              {recentScans.map((scan) => (
                <motion.div
                  key={scan.id}
                  initial={{ opacity: 0, x: -20, scale: 0.8 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="bg-emerald-600/90 backdrop-blur-md text-white px-4 py-2 rounded-2xl flex items-center justify-between shadow-lg border border-white/20"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span className="font-bold text-sm truncate max-w-[120px]">{scan.name}</span>
                  </div>
                  <span className="font-mono text-xs bg-white/20 px-2 py-0.5 rounded-lg">+{scan.price} DH</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          <AnimatePresence>
            {scanError && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute inset-0 bg-rose-600/95 flex flex-col items-center justify-center text-white z-10 p-6"
              >
                <AlertTriangle className="w-12 h-12 mb-2" />
                <p className="font-black text-lg">هاد السلعة ما كايناش</p>
                <p className="text-xs font-mono mb-4 opacity-80">{scanError}</p>
                <div className="flex gap-2 w-full">
                  <Button 
                    onClick={() => {
                      onAddProduct(scanError);
                      setScanError(null);
                    }}
                    className="flex-1 py-3 text-sm bg-white text-rose-600"
                  >
                    زيد السلعة
                  </Button>
                  <Button 
                    onClick={() => setScanError(null)}
                    variant="ghost"
                    className="text-white border border-white/30"
                  >
                    إلغاء
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <Button onClick={() => setIsScanning(false)} variant="ghost" className="text-white hover:bg-white/10 w-full">إيقاف المسح</Button>
        </div>
      )}

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <button 
            onClick={() => setShowCustomAdd(true)}
            className="bg-emerald-50 border-2 border-dashed border-emerald-200 p-4 rounded-[32px] flex flex-col items-center justify-center gap-2 text-emerald-600 hover:bg-emerald-100 transition-colors h-32"
          >
            <PlusCircle className="w-8 h-8" />
            <span className="font-bold text-sm">سلعة خرى</span>
          </button>

          {filteredProducts.map(product => (
            <motion.button 
              key={product.id}
              whileTap={{ scale: 0.95 }}
              whileHover={{ y: -4 }}
              onClick={() => addToCart(product)}
              className={cn(
                "bg-white rounded-[32px] border shadow-sm flex flex-col transition-all h-52 relative overflow-hidden group hover:shadow-xl hover:shadow-emerald-900/5",
                lastAddedId === product.id ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-emerald-50"
              )}
            >
              <div className="h-32 w-full relative overflow-hidden bg-slate-50">
                <LocalProductImage 
                  localImageId={product.localImageId} 
                  imageUrl={product.imageUrl}
                  fallbackIcon={Package} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
                
                {/* Price Tag - Glassmorphism */}
                <div className="absolute top-2 left-2 bg-white/70 backdrop-blur-md border border-white/20 text-emerald-900 px-2.5 py-1 rounded-xl text-[11px] font-black shadow-sm z-10">
                  {product.price} DH
                </div>

                {/* Low Stock Badge */}
                {product.stock <= product.lowStockThreshold && (
                  <div className="absolute top-2 right-2 bg-rose-500/90 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[9px] font-black z-10 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    قليل
                  </div>
                )}
                
                {cart[product.id] && (
                  <div className="absolute bottom-2 right-2 bg-rose-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg z-20 animate-in zoom-in duration-300">
                    {cart[product.id]}
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between text-right">
                <div className="font-black text-slate-800 text-sm leading-tight line-clamp-2 group-hover:text-emerald-700 transition-colors">
                  {product.name}
                </div>
                <div className="flex justify-between items-end w-full mt-2">
                  <div className="flex flex-col items-start">
                    <div className="text-emerald-600 font-black text-xl leading-none">
                      {product.price} <span className="text-[10px] font-bold opacity-60">DH</span>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 mt-1">
                      {product.stock} فـ الستوك
                    </div>
                  </div>
                  <div className="bg-emerald-100 text-emerald-600 p-2 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all group-active:scale-90">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Cart Summary & Checkout */}
      <AnimatePresence>
        {cartItems.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ 
              y: 0, 
              opacity: 1,
              scale: isCartBouncing ? [1, 1.02, 1] : 1
            }}
            exit={{ y: 100, opacity: 0 }}
            className={cn(
              "fixed bottom-24 left-4 right-4 z-[90] bg-white/80 backdrop-blur-xl border border-white/40 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-3 space-y-2 transition-all",
              isCartBouncing ? "bg-emerald-50/90" : "bg-white/80"
            )}
          >
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-lg shadow-emerald-200">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-black text-slate-900 block leading-none text-sm">{cartItems.length} سلع</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">فـ السلة</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">المجموع</p>
                <p className="text-2xl font-black text-emerald-900 leading-none">{total} <span className="text-xs">DH</span></p>
              </div>
            </div>

            {/* Quick Cart List - Minimalist */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {cartItems.map(item => (
                <div key={`quick-${item.product.id}`} className="bg-white/50 border border-white/60 p-1.5 rounded-xl flex items-center gap-2 min-w-[130px] shadow-sm">
                  <div className="w-6 h-6 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    <LocalProductImage 
                      localImageId={item.product.localImageId} 
                      imageUrl={item.product.imageUrl}
                      fallbackIcon={Package} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-800 truncate">{item.product.name}</p>
                    <p className="text-[10px] font-black text-emerald-600">{item.product.price * item.quantity} DH</p>
                  </div>
                  <div className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">
                    {item.quantity}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => setIsCheckoutOpen(true)}
                className="flex-1 py-3 text-base rounded-[20px] shadow-lg shadow-emerald-200"
              >
                خلاص دابا
              </Button>
              <button 
                onClick={() => setCart({})}
                className="bg-rose-50 text-rose-500 p-3 rounded-[20px] active:scale-90 transition-transform hover:bg-rose-100"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end justify-center">
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            className="bg-white w-full max-w-md rounded-t-[40px] p-6 space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900">تأكيد الخلاص</h3>
              <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {cartItems.map(item => (
                <div key={item.product.id} className={cn(
                  "flex justify-between items-center p-3 rounded-2xl",
                  item.product.stock < item.quantity ? "bg-red-50 border border-red-200" : "bg-slate-50"
                )}>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <div className="font-bold text-slate-800 text-sm">{item.product.name}</div>
                      {item.product.stock < item.quantity && (
                        <div className="text-red-500 text-[10px] font-bold">
                          الستوك فيه غير {item.product.stock} حبة
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-black text-slate-900 w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => addToCart(item.product)}
                      className="w-8 h-8 flex items-center justify-center bg-emerald-600 rounded-lg text-white shadow-sm active:scale-90 transition-transform"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="font-black text-emerald-600 min-w-[60px] text-left">{item.product.price * item.quantity} DH</div>
                </div>
              ))}
            </div>

            {cartItems.some(item => item.product.stock < item.quantity) && (
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-red-700 text-xs font-bold">
                  كاين شي سلع تقاضاو من الستوك. نقص الكمية ولا حيدهم باش تقدر تخلص.
                </p>
              </div>
            )}

            <div className="bg-emerald-50 p-6 rounded-3xl flex justify-between items-center">
              <span className="text-emerald-700 font-bold">المجموع الكلي</span>
              <span className="text-3xl font-black text-emerald-950">{total} DH</span>
            </div>

            {/* Payment Methods */}
            <div className="space-y-4">
              <p className="font-bold text-slate-500 text-sm uppercase tracking-widest text-center">طريقة الخلاص</p>
              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={() => setPaymentMethod('cash')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all",
                    paymentMethod === 'cash' ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200" : "bg-white border-slate-100 text-slate-600"
                  )}
                >
                  <Wallet className="w-6 h-6" />
                  <span className="font-bold text-xs">نقدا</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('credit')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all",
                    paymentMethod === 'credit' ? "bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-200" : "bg-white border-slate-100 text-slate-600"
                  )}
                >
                  <CreditCard className="w-6 h-6" />
                  <span className="font-bold text-xs">كريدي</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('qr')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all",
                    paymentMethod === 'qr' ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-white border-slate-100 text-slate-600"
                  )}
                >
                  <QrCode className="w-6 h-6" />
                  <span className="font-bold text-xs">QR</span>
                </button>
              </div>
            </div>

            {paymentMethod === 'credit' && (
              <div className="space-y-3 animate-in slide-in-from-top-4">
                <label className="text-sm font-bold text-rose-600 ml-2">اختار الكليان</label>
                <select 
                  className="w-full p-4 rounded-2xl border border-rose-100 bg-rose-50/30 text-lg font-bold"
                  value={selectedCustomerForCredit}
                  onChange={(e) => setSelectedCustomerForCredit(e.target.value)}
                >
                  <option value="">-- اختار كليان --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.totalDebt} DH)</option>
                  ))}
                </select>
              </div>
            )}

            <Button 
              onClick={handleCheckout} 
              disabled={!paymentMethod || cartItems.some(item => item.product.stock < item.quantity)}
              className={cn(
                "w-full py-6 text-xl rounded-[28px]",
                (!paymentMethod || cartItems.some(item => item.product.stock < item.quantity)) && "opacity-50 grayscale"
              )}
            >
              تأكيد العملية
            </Button>
          </motion.div>
        </div>
      )}

      {/* Custom Add Modal */}
      {showCustomAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[40px] p-8 max-w-sm w-full space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900">سلعة خرى</h3>
              <button onClick={() => setShowCustomAdd(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <Input 
                label="سمية السلعة" 
                placeholder="مثلا: خبزة، بيضة..." 
                value={customProduct.name}
                onChange={e => setCustomProduct({...customProduct, name: e.target.value})}
              />
              <Input 
                label="الثمن (DH)" 
                type="number"
                placeholder="0.00" 
                value={customProduct.price}
                onChange={e => setCustomProduct({...customProduct, price: e.target.value})}
              />
              <Button onClick={handleAddCustom} className="w-full">تسجيل البيع</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// --- Local Image Component ---
const LocalProductImage = ({ localImageId, imageUrl, fallbackIcon: Icon, className }: { localImageId?: string; imageUrl?: string; fallbackIcon: any; className?: string }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (localImageId) {
      localDb.products.get(Number(localImageId)).then(p => {
        if (p?.imageData) {
          const objectUrl = URL.createObjectURL(p.imageData);
          setUrl(objectUrl);
        }
      });
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [localImageId]);

  const displayUrl = url || imageUrl;

  if (displayUrl) {
    return (
      <motion.img 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        src={displayUrl} 
        alt="Product" 
        className={cn("w-full h-full object-cover", className)} 
        referrerPolicy="no-referrer" 
      />
    );
  }

  return <Icon className={cn("w-6 h-6", className)} />;
};

function ProductsView({ products, categories, user, prefilledBarcode, onClearPrefilled, onOpenSuppliers }: { products: Product[]; categories: Category[]; user: User; prefilledBarcode?: string; onClearPrefilled?: () => void; onOpenSuppliers: (p?: Product) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [importSummary, setImportSummary] = useState<{ success: number; errors: string[] } | null>(null);
  const [isScanMode, setIsScanMode] = useState(false);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    costPrice: '',
    stock: '',
    lowStockThreshold: '5',
    barcode: '',
    categoryId: '',
    imageUrl: '',
    localImageId: '',
    bulkBarcodes: [] as BulkBarcode[]
  });
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const processImage = async (file: Blob) => {
    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file as File, options);
      setImageBlob(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error("Compression error:", error);
      setImageBlob(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processImage(file);
  };

  useEffect(() => {
    if (prefilledBarcode) {
      setIsAdding(true);
      setFormData(prev => ({ ...prev, barcode: prefilledBarcode }));
      if (onClearPrefilled) onClearPrefilled();
    }
  }, [prefilledBarcode, onClearPrefilled]);

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name,
        price: editingProduct.price.toString(),
        costPrice: editingProduct.costPrice.toString(),
        stock: editingProduct.stock.toString(),
        lowStockThreshold: editingProduct.lowStockThreshold.toString(),
        barcode: editingProduct.barcode || '',
        categoryId: editingProduct.categoryId || '',
        imageUrl: editingProduct.imageUrl || '',
        localImageId: editingProduct.localImageId || '',
        bulkBarcodes: editingProduct.bulkBarcodes || []
      });
      
      if (editingProduct.localImageId) {
        localDb.products.get(Number(editingProduct.localImageId)).then(p => {
          if (p?.imageData) {
            setImagePreview(URL.createObjectURL(p.imageData));
          }
        });
      } else {
        setImagePreview(null);
      }
    } else {
      setFormData({ name: '', price: '', costPrice: '', stock: '', lowStockThreshold: '5', barcode: '', categoryId: '', imageUrl: '', localImageId: '', bulkBarcodes: [] });
      setImageBlob(null);
      setImagePreview(null);
    }
  }, [editingProduct]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        ownerId: user.uid
      });
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = () => {
    const data = products.map(p => ({
      'Name': p.name,
      'Price': p.price,
      'Cost Price': p.costPrice,
      'Stock': p.stock,
      'Low Stock Threshold': p.lowStockThreshold,
      'Barcode': p.barcode || ''
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Products");
    writeFile(wb, "products_export.xlsx");
  };

  const downloadTemplate = () => {
    const data = [
      { 'Name': 'Example Product', 'Price': 10, 'Cost Price': 7, 'Stock': 100, 'Low Stock Threshold': 5, 'Barcode': '123456789' }
    ];
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    writeFile(wb, "products_template.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws) as any[];

      let successCount = 0;
      const errors: string[] = [];
      const barcodes = new Set(products.map(p => p.barcode).filter(Boolean));

      for (const [index, row] of data.entries()) {
        const name = row['Name'] || row['name'];
        const price = Number(row['Price'] || row['price']);
        const costPrice = Number(row['Cost Price'] || row['costPrice'] || 0);
        const stock = Number(row['Stock'] || row['stock'] || 0);
        const lowStockThreshold = Number(row['Low Stock Threshold'] || row['lowStockThreshold'] || 5);
        const barcode = String(row['Barcode'] || row['barcode'] || '').trim();

        if (!name) {
          errors.push(`Row ${index + 2}: Name is missing`);
          continue;
        }
        if (isNaN(price) || price < 0) {
          errors.push(`Row ${index + 2}: Invalid price for ${name}`);
          continue;
        }
        if (barcode && barcodes.has(barcode)) {
          errors.push(`Row ${index + 2}: Duplicate barcode ${barcode} for ${name}`);
          continue;
        }

        try {
          await addDoc(collection(db, 'products'), {
            name,
            price,
            costPrice,
            stock,
            lowStockThreshold,
            barcode,
            ownerId: user.uid,
            createdAt: Timestamp.now()
          });
          successCount++;
          if (barcode) barcodes.add(barcode);
        } catch (err) {
          errors.push(`Row ${index + 2}: Failed to save ${name}`);
        }
      }

      setImportSummary({ success: successCount, errors });
      setIsImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedCategory = categories.find(c => c.id === formData.categoryId);
      
      let localImageId = formData.localImageId;
      let imageUrl = formData.imageUrl;

      if (imageBlob) {
        // 1. Save to Local DB (for offline/speed)
        const localId = await localDb.products.put({
          name: formData.name,
          price: Number(formData.price),
          imageData: imageBlob,
          createdAt: Date.now()
        });
        localImageId = localId.toString();

        // 2. Upload to Firebase Storage (for cross-device sync)
        try {
          const storageRef = ref(storage, `products/${user.uid}/${Date.now()}_${formData.name}`);
          await uploadBytes(storageRef, imageBlob);
          imageUrl = await getDownloadURL(storageRef);
        } catch (storageErr) {
          console.error('Storage upload failed, falling back to local only', storageErr);
        }
      }

      const productData = {
        name: formData.name,
        price: Number(formData.price),
        costPrice: Number(formData.costPrice),
        stock: Number(formData.stock),
        lowStockThreshold: Number(formData.lowStockThreshold),
        barcode: formData.barcode,
        imageUrl: imageUrl,
        localImageId: localImageId,
        bulkBarcodes: formData.bulkBarcodes,
        categoryId: formData.categoryId,
        categoryName: selectedCategory ? selectedCategory.name : '',
        ownerId: user.uid,
        createdAt: editingProduct ? editingProduct.createdAt : Timestamp.now()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        setEditingProduct(null);
      } else {
        await addDoc(collection(db, 'products'), productData);
        setIsAdding(false);
      }
      setFormData({ name: '', price: '', costPrice: '', stock: '', lowStockThreshold: '5', barcode: '', categoryId: '', imageUrl: '', localImageId: '', bulkBarcodes: [] });
      setImageBlob(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Save product failed', error);
    }
  };

  const handleDelete = async (product: Product) => {
    if (window.confirm('واش متيقن بغيتي تمسح هاد السلعة؟')) {
      try {
        await deleteDoc(doc(db, 'products', product.id));
        if (product.localImageId) {
          await localDb.products.delete(Number(product.localImageId));
        }
      } catch (error) {
        console.error('Delete product failed', error);
      }
    }
  };

  if (isScanMode) {
    return <SmartInventoryScan user={user} products={products} categories={categories} onFinish={() => setIsScanMode(false)} />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-emerald-900">السلعة</h2>
        <div className="flex gap-2">
          <Button onClick={() => setIsAddingCategory(true)} variant="secondary" className="px-4 py-3 rounded-xl">
            <Tags className="w-6 h-6" />
          </Button>
          <Button onClick={() => setIsImporting(true)} variant="secondary" className="px-4 py-3 rounded-xl">
            <FileUp className="w-6 h-6" />
          </Button>
          <Button onClick={handleExport} variant="secondary" className="px-4 py-3 rounded-xl">
            <FileDown className="w-6 h-6" />
          </Button>
          <Button onClick={() => setIsScanMode(true)} variant="secondary" className="px-4 py-3 rounded-xl">
            <ScanLine className="w-6 h-6" />
          </Button>
          <Button onClick={() => setIsAdding(true)} variant="primary" className="px-4 py-3 rounded-xl">
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {isAddingCategory && (
        <Card className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-bold">زيد تصنيف جديد</h3>
            <button onClick={() => setIsAddingCategory(false)}><XCircle className="text-rose-400" /></button>
          </div>
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <Input 
              label="سمية التصنيف"
              placeholder="مثلا: مشروبات، ألبان..." 
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              required
              className="flex-1"
            />
            <Button type="submit">زيد</Button>
          </form>

          {categories.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">التصنيفات اللي كاينين</h4>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <div key={cat.id} className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                    {cat.name}
                    <button 
                      onClick={async () => {
                        if (window.confirm('واش متيقن بغيتي تمسح هاد التصنيف؟ السلع اللي فيه غايوليو بدون تصنيف.')) {
                          await deleteDoc(doc(db, 'categories', cat.id));
                        }
                      }}
                      className="text-emerald-400 hover:text-rose-500 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {isImporting && (
        <Card className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">استيراد السلعة</h3>
            <button onClick={() => setIsImporting(false)}><XCircle className="text-rose-400" /></button>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">تقدر تزيد بزاف ديال السلعة دقة وحدة باستعمال ملف Excel أو CSV.</p>
            <Button onClick={downloadTemplate} variant="secondary" className="w-full flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              تحميل النموذج (Template)
            </Button>
            <div className="relative">
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleImport}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button className="w-full">اختار الملف</Button>
            </div>
          </div>
        </Card>
      )}

      {importSummary && (
        <Card className="space-y-4 border-2 border-emerald-500">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">نتيجة الاستيراد</h3>
            <button onClick={() => setImportSummary(null)}><XCircle className="text-slate-400" /></button>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-700 font-bold">
            تم استيراد {importSummary.success} سلعة بنجاح!
          </div>
          {importSummary.errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-rose-600">أخطاء ({importSummary.errors.length}):</p>
              <div className="max-h-32 overflow-y-auto text-xs text-rose-500 space-y-1 bg-rose-50 p-3 rounded-xl">
                {importSummary.errors.map((err, i) => <div key={i}>{err}</div>)}
              </div>
            </div>
          )}
        </Card>
      )}

      {(isAdding || editingProduct) && (
        <Card className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-bold">{editingProduct ? 'تعديل السلعة' : 'زيد سلعة جديدة'}</h3>
            <button onClick={() => { setIsAdding(false); setEditingProduct(null); }}><XCircle className="text-rose-400" /></button>
          </div>
          <form onSubmit={handleAdd} className="space-y-4">
            <Input 
              label="سمية السلعة" 
              placeholder="مثلا: حليب، خبز..." 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              required
            />
            <div className="relative">
              <Input 
                label="الباركود (اختياري)" 
                placeholder="سكاني الباركود هنا..." 
                value={formData.barcode}
                onChange={e => setFormData({...formData, barcode: e.target.value})}
              />
              <button
                type="button"
                onClick={() => setIsScanningBarcode(!isScanningBarcode)}
                className={cn(
                  "absolute left-3 bottom-3 p-2 rounded-xl transition-all",
                  isScanningBarcode ? "bg-rose-500 text-white" : "bg-emerald-100 text-emerald-600"
                )}
              >
                <ScanLine className="w-5 h-5" />
              </button>
            </div>

            {isScanningBarcode && (
              <div className="bg-slate-900 rounded-3xl p-2 mb-4 text-center relative overflow-hidden h-48">
                <BarcodeScanner 
                  cooldownMs={1000}
                  onScan={(barcode) => {
                    setFormData(prev => ({ ...prev, barcode }));
                    setIsScanningBarcode(false);
                  }}
                  onError={(error) => console.log(error)}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 mr-2 uppercase">صورة المنتج</label>
              {imagePreview ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50">
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setImageBlob(null);
                      setImagePreview(null);
                      setFormData(prev => ({ ...prev, localImageId: '' }));
                    }}
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-100 bg-emerald-50/30 py-6 transition-colors hover:border-emerald-500 hover:bg-emerald-50/50"
                  >
                    <Upload className="text-emerald-400" size={24} />
                    <span className="text-xs font-bold text-emerald-700">تحميل صورة</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-100 bg-emerald-50/30 py-6 transition-colors hover:border-emerald-500 hover:bg-emerald-50/50"
                  >
                    <Camera className="text-emerald-400" size={24} />
                    <span className="text-xs font-bold text-emerald-700">تصوير</span>
                  </button>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 mr-2 uppercase">التصنيف</label>
              <select 
                className="w-full p-4 rounded-2xl border border-emerald-100 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg"
                value={formData.categoryId}
                onChange={e => setFormData({...formData, categoryId: e.target.value})}
              >
                <option value="">بدون تصنيف</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            {/* Bulk Barcodes Section */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-black text-slate-700">باركود الكرتونة (Bulk)</h4>
                <button 
                  type="button" 
                  onClick={() => setFormData(prev => ({
                    ...prev, 
                    bulkBarcodes: [...prev.bulkBarcodes, { barcode: '', quantity: 20, label: 'كرتونة' }]
                  }))}
                  className="text-emerald-600 text-xs font-bold flex items-center gap-1 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> زيد باركود
                </button>
              </div>
              
              {formData.bulkBarcodes.map((bb, idx) => (
                <div key={idx} className="flex gap-2 items-end bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex-1">
                    <Input 
                      label="الباركود" 
                      value={bb.barcode} 
                      onChange={e => {
                        const newBB = [...formData.bulkBarcodes];
                        newBB[idx].barcode = e.target.value;
                        setFormData({...formData, bulkBarcodes: newBB});
                      }}
                      className="bg-white"
                    />
                  </div>
                  <div className="w-20">
                    <Input 
                      label="العدد" 
                      type="number"
                      value={bb.quantity} 
                      onChange={e => {
                        const newBB = [...formData.bulkBarcodes];
                        newBB[idx].quantity = Number(e.target.value);
                        setFormData({...formData, bulkBarcodes: newBB});
                      }}
                      className="bg-white"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      const newBB = formData.bulkBarcodes.filter((_, i) => i !== idx);
                      setFormData({...formData, bulkBarcodes: newBB});
                    }}
                    className="p-2 text-rose-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="ثمن البيع (DH)" 
                type="number" 
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                required
              />
              <Input 
                label="ثمن الشراء (DH)" 
                type="number" 
                value={formData.costPrice}
                onChange={e => setFormData({...formData, costPrice: e.target.value})}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="الكمية (Stock)" 
                type="number" 
                value={formData.stock}
                onChange={e => setFormData({...formData, stock: e.target.value})}
                required
              />
              <Input 
                label="تنبيه (Stock Low)" 
                type="number" 
                value={formData.lowStockThreshold}
                onChange={e => setFormData({...formData, lowStockThreshold: e.target.value})}
                required
              />
            </div>
            <Button type="submit" className="w-full">{editingProduct ? 'تحديث السلعة' : 'حفظ السلعة'}</Button>
          </form>
        </Card>
      )}

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={processImage}
      />

      <div className="grid gap-4">
        {products.map(product => {
          const isLowStock = product.stock <= product.lowStockThreshold;
          return (
            <Card key={product.id} className={cn(
              "flex justify-between items-center transition-all",
              isLowStock ? "border-rose-200 bg-rose-50/30" : ""
            )}>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shrink-0",
                  isLowStock ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                )}>
                  <LocalProductImage 
                    localImageId={product.localImageId} 
                    imageUrl={product.imageUrl}
                    fallbackIcon={Package} 
                  />
                </div>
                <div>
                  <div className="font-bold text-lg">{product.name}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 font-mono text-sm">{product.price} DH</span>
                    {isLowStock && (
                      <span className="bg-rose-100 text-rose-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        Stock Low
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setEditingProduct(product)}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                  title="تعديل"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleDelete(product)}
                  className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-colors"
                  title="مسح"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                {isLowStock && (
                  <button 
                    onClick={() => onOpenSuppliers(product)}
                    className="p-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors shadow-sm"
                    title="طلب من المورد"
                  >
                    <Truck className="w-5 h-5" />
                  </button>
                )}
                <div className="text-right">
                  <div className={cn(
                    "font-black text-xl",
                    isLowStock ? "text-rose-600" : "text-emerald-900"
                  )}>
                    {product.stock}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300">الكمية</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}

function CreditsView({ customers, credits, user }: { customers: Customer[]; credits: CreditTransaction[]; user: User }) {
  const [view, setView] = useState<'list' | 'profile' | 'add-customer'>('list');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddingCredit, setIsAddingCredit] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'credits' | 'payments'>('credits');
  
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '' });
  const [creditForm, setCreditForm] = useState({ amount: '', note: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '' });

  const totalGlobalDebt = customers.reduce((acc, curr) => acc + curr.totalDebt, 0);
  const sortedCustomers = [...customers].sort((a, b) => b.totalDebt - a.totalDebt);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'customers'), {
        name: customerForm.name,
        phone: customerForm.phone,
        totalDebt: 0,
        ownerId: user.uid,
        createdAt: Timestamp.now()
      });
      setView('list');
      setCustomerForm({ name: '', phone: '' });
    } catch (error) {
      console.error('Add customer failed', error);
    }
  };

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amount = Number(creditForm.amount);
    try {
      await addDoc(collection(db, 'credits'), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        amount: amount,
        note: creditForm.note,
        date: Timestamp.now(),
        status: 'unpaid',
        type: 'credit',
        ownerId: user.uid
      });

      // Update customer total debt
      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        totalDebt: selectedCustomer.totalDebt + amount,
        updatedAt: new Date().toISOString()
      });

      setIsAddingCredit(false);
      setCreditForm({ amount: '', note: '' });
      // Refresh selected customer from local state or let snapshot handle it
      const updatedCust = customers.find(c => c.id === selectedCustomer.id);
      if (updatedCust) setSelectedCustomer(updatedCust);
    } catch (error) {
      console.error('Add credit failed', error);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amount = Number(paymentForm.amount);
    try {
      await addDoc(collection(db, 'credits'), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        amount: amount,
        note: paymentForm.note,
        date: Timestamp.now(),
        status: 'paid',
        type: 'payment',
        ownerId: user.uid
      });

      // Update customer total debt
      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        totalDebt: Math.max(0, selectedCustomer.totalDebt - amount),
        updatedAt: new Date().toISOString()
      });

      setIsAddingPayment(false);
      setPaymentForm({ amount: '', note: '' });
      const updatedCust = customers.find(c => c.id === selectedCustomer.id);
      if (updatedCust) setSelectedCustomer(updatedCust);
    } catch (error) {
      console.error('Add payment failed', error);
    }
  };

  const markAsPaid = async (credit: CreditTransaction) => {
    if (!selectedCustomer) return;
    try {
      await updateDoc(doc(db, 'credits', credit.id), { status: 'paid', type: 'payment' });
      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        totalDebt: Math.max(0, selectedCustomer.totalDebt - credit.amount),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Mark as paid failed', error);
    }
  };

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  
  const customerCredits = credits.filter(c => c.customerId === selectedCustomer?.id && c.type !== 'payment' && c.status !== 'paid');
  const customerPayments = credits.filter(c => c.customerId === selectedCustomer?.id && (c.type === 'payment' || c.status === 'paid'));

  const totalTaken = customerCredits.reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = customerPayments.reduce((sum, t) => sum + t.amount, 0);

  const shareUrl = `${window.location.origin}/credit/${selectedCustomer?.id}`;

  const handleShareWhatsApp = () => {
    if (!selectedCustomer) return;
    const message = `السلام عليكم ${selectedCustomer.name}،\n\nعندك تحديث جديد فالحساب ديالك.\n\nالكريدي الحالي: ${selectedCustomer.totalDebt} DH\n\nتقدر تشوف التفاصيل هنا:\n${shareUrl}`;
    window.open(`https://wa.me/${selectedCustomer.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('تم نسخ الرابط!');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {view === 'list' && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black text-emerald-900">الكريدي</h2>
            <Button onClick={() => setView('add-customer')} variant="primary" className="px-4 py-3 rounded-xl">
              <Plus className="w-6 h-6" />
            </Button>
          </div>

          <Card className="bg-rose-500 text-white border-none">
            <div className="text-rose-100 font-bold mb-1">مجموع الكريدي عند الناس</div>
            <div className="text-4xl font-black">{totalGlobalDebt} DH</div>
          </Card>

          <div className="space-y-4">
            <h3 className="font-bold text-emerald-800 ml-2">كليان لي عندهم الكريدي</h3>
            <div className="grid gap-3">
              {sortedCustomers.map(customer => (
                <button 
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setView('profile');
                  }}
                  className="bg-white p-5 rounded-3xl border border-emerald-50 shadow-sm flex justify-between items-center active:bg-emerald-50 transition-colors text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-rose-100 p-3 rounded-2xl text-rose-600">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-lg">{customer.name}</div>
                      <div className="text-emerald-400 text-xs">{customer.phone || 'بلا نمرة'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-rose-600 font-black text-xl">{customer.totalDebt} DH</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'add-customer' && (
        <Card className="space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2 hover:bg-emerald-50 rounded-xl">
              <ArrowLeft className="w-6 h-6 text-emerald-600" />
            </button>
            <h3 className="text-xl font-bold">زيد كليان جديد</h3>
          </div>
          <form onSubmit={handleAddCustomer} className="space-y-4">
            <Input 
              label="سمية الكليان" 
              placeholder="مثلا: سي محمد..." 
              value={customerForm.name}
              onChange={e => setCustomerForm({...customerForm, name: e.target.value})}
              required
            />
            <Input 
              label="نمرة التلفون (اختياري)" 
              placeholder="06..." 
              value={customerForm.phone}
              onChange={e => setCustomerForm({...customerForm, phone: e.target.value})}
            />
            <Button type="submit" className="w-full">حفظ الكليان</Button>
          </form>
        </Card>
      )}

      {view === 'profile' && selectedCustomer && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2 hover:bg-emerald-50 rounded-xl">
              <ArrowLeft className="w-6 h-6 text-emerald-600" />
            </button>
            <h3 className="text-xl font-bold">{selectedCustomer.name}</h3>
          </div>

          <Card className="bg-emerald-900 text-white border-none flex justify-between items-center">
            <div>
              <div className="text-emerald-300 font-bold text-sm">الكريدي لي عليه</div>
              <div className="text-4xl font-black">{selectedCustomer.totalDebt} DH</div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsQRModalOpen(true)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors"
                title="QR Code"
              >
                <Share2 className="w-6 h-6" />
              </button>
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={() => {
                    setIsAddingCredit(true);
                    setIsAddingPayment(false);
                  }}
                  variant="primary" 
                  className="bg-rose-500 hover:bg-rose-400 px-4 py-2 text-sm"
                >
                  <PlusCircle className="w-4 h-4" /> تقضية
                </Button>
                <Button 
                  onClick={() => {
                    setIsAddingPayment(true);
                    setIsAddingCredit(false);
                  }}
                  variant="primary" 
                  className="bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-sm"
                >
                  <Wallet className="w-4 h-4" /> خلاص
                </Button>
              </div>
            </div>
          </Card>

          {isQRModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-[40px] p-8 max-w-sm w-full space-y-6 text-center"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black text-slate-900">رابط الحساب</h3>
                  <button onClick={() => setIsQRModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                    <XCircle className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl flex justify-center">
                  <QRCodeSVG value={shareUrl} size={200} />
                </div>

                <div className="space-y-3">
                  <Button onClick={handleShareWhatsApp} className="w-full bg-[#25D366] hover:bg-[#128C7E] border-none">
                    <MessageSquare className="w-5 h-5" />
                    إرسال فـ WhatsApp
                  </Button>
                  <Button onClick={handleCopyLink} variant="secondary" className="w-full">
                    <Copy className="w-5 h-5" />
                    نسخ الرابط
                  </Button>
                </div>
                
                <p className="text-[10px] text-slate-400 font-bold uppercase">
                  {shareUrl}
                </p>
              </motion.div>
            </div>
          )}

          {isAddingCredit && (
            <Card className="space-y-4 border-2 border-emerald-500">
              <div className="flex justify-between items-center">
                <h4 className="font-bold">سجل كريدي جديد</h4>
                <button onClick={() => setIsAddingCredit(false)}><XCircle className="text-rose-400" /></button>
              </div>
              <form onSubmit={handleAddCredit} className="space-y-4">
                <Input 
                  label="المبلغ (DH)" 
                  type="number" 
                  value={creditForm.amount}
                  onChange={e => setCreditForm({...creditForm, amount: e.target.value})}
                  required
                />
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-sm font-bold text-emerald-800 ml-2">تفاصيل التقضية (اختياري)</label>
                  <textarea 
                    className="px-4 py-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg min-h-[100px] resize-none"
                    placeholder="مثلا: سكر، أتاي، زيت..." 
                    value={creditForm.note}
                    onChange={e => setCreditForm({...creditForm, note: e.target.value})}
                  />
                </div>
                <Button type="submit" className="w-full">تأكيد</Button>
              </form>
            </Card>
          )}

          {isAddingPayment && (
            <Card className="space-y-4 border-2 border-emerald-500">
              <div className="flex justify-between items-center">
                <h4 className="font-bold">سجل خلاص جديد</h4>
                <button onClick={() => setIsAddingPayment(false)}><XCircle className="text-rose-400" /></button>
              </div>
              <form onSubmit={handleAddPayment} className="space-y-4">
                <Input 
                  label="المبلغ (DH)" 
                  type="number" 
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                  required
                />
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-sm font-bold text-emerald-800 ml-2">ملاحظة (اختياري)</label>
                  <textarea 
                    className="px-4 py-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg min-h-[80px] resize-none"
                    placeholder="مثلا: خلص 100 درهم..." 
                    value={paymentForm.note}
                    onChange={e => setPaymentForm({...paymentForm, note: e.target.value})}
                  />
                </div>
                <Button type="submit" className="w-full bg-emerald-600">تأكيد الخلاص</Button>
              </form>
            </Card>
          )}

          {/* Tabs for Profile View */}
          <div className="bg-white p-1 rounded-2xl shadow-sm border border-emerald-50 flex gap-1">
            <button 
              onClick={() => setActiveProfileTab('credits')}
              className={cn(
                "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                activeProfileTab === 'credits' ? "bg-rose-500 text-white shadow-md" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              السلعة ({totalTaken} DH)
            </button>
            <button 
              onClick={() => setActiveProfileTab('payments')}
              className={cn(
                "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                activeProfileTab === 'payments' ? "bg-emerald-500 text-white shadow-md" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              الخلاص ({totalPaid} DH)
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-emerald-800 ml-2">
              {activeProfileTab === 'credits' ? 'تاريخ السلعة' : 'تاريخ الخلاص'}
            </h4>
            <div className="grid gap-3">
              {(activeProfileTab === 'credits' ? customerCredits : customerPayments).map(credit => (
                <div 
                  key={credit.id}
                  className={cn(
                    "bg-white p-5 rounded-3xl border shadow-sm flex justify-between items-center",
                    credit.status === 'paid' ? "border-emerald-100" : "border-rose-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-3 rounded-2xl",
                      credit.status === 'paid' ? "bg-emerald-50 text-emerald-400" : "bg-rose-50 text-rose-500"
                    )}>
                      {credit.status === 'paid' ? <CheckCircle2 /> : <History />}
                    </div>
                    <div>
                      <div className="font-bold">{credit.amount} DH</div>
                      <div className="text-xs text-emerald-400 mt-1 whitespace-pre-wrap">
                        {credit.note || 'بلا ملاحظة'}
                      </div>
                      <div className="text-[10px] text-emerald-300 mt-1">
                        {format((credit.date as any).toDate ? (credit.date as any).toDate() : new Date(credit.date), 'dd/MM HH:mm')}
                      </div>
                    </div>
                  </div>
                  {activeProfileTab === 'credits' && credit.status === 'unpaid' && (
                    <button 
                      onClick={() => markAsPaid(credit)}
                      className="bg-emerald-100 text-emerald-600 px-4 py-2 rounded-xl font-bold text-sm"
                    >
                      خلاص
                    </button>
                  )}
                </div>
              ))}
              {(activeProfileTab === 'credits' ? customerCredits : customerPayments).length === 0 && (
                <div className="text-center py-8 text-slate-400 italic text-sm">
                  لا توجد عمليات مسجلة هنا
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SetupView({ user }: { user: User }) {
  const [shopName, setShopName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let inviterId = '';
      if (referralCode) {
        const q = query(collection(db, 'users'), where('referralCode', '==', referralCode.toUpperCase()), limit(1));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          setError('كود الدعوة ماشي صحيح');
          setLoading(false);
          return;
        }
        inviterId = querySnapshot.docs[0].id;
      }

      const myReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        shopName,
        referralCode: myReferralCode,
        referredBy: inviterId || null,
        referralCount: 0,
        subscriptionStatus: 'trial',
        subscriptionEndDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        internalCredit: 0,
        createdAt: Timestamp.now()
      });

      if (inviterId) {
        // Reward inviter
        await updateDoc(doc(db, 'users', inviterId), {
          referralCount: increment(1),
          internalCredit: increment(50) // 50 DH credit for referral
        });

        // Record referral
        await addDoc(collection(db, 'referrals'), {
          inviterId,
          inviteeId: user.uid,
          date: Timestamp.now(),
          rewardGiven: true
        });
      }
    } catch (err) {
      console.error('Setup failed', err);
      setError('وقع مشكل، عاود جرب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 text-center">
      <Card className="max-w-md w-full space-y-8 p-10">
        <div className="bg-emerald-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto">
          <Package className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-3xl font-black text-emerald-900">مرحبا بك فـ KANACH</h2>
        <p className="text-emerald-600">كمل المعلومات ديالك باش تبدا</p>
        
        <form onSubmit={handleSetup} className="space-y-6 text-right">
          <Input 
            label="سمية الحانوت" 
            placeholder="مثلا: حانوت البركة" 
            value={shopName}
            onChange={e => setShopName(e.target.value)}
            required
          />
          <Input 
            label="كود الدعوة (إلى عندك)" 
            placeholder="مثلا: AB12CD" 
            value={referralCode}
            onChange={e => setReferralCode(e.target.value)}
          />
          {error && <p className="text-rose-500 text-sm font-bold">{error}</p>}
          <Button type="submit" className="w-full py-5" disabled={loading}>
            {loading ? 'جاري الحفظ...' : 'بدا دابا'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function ReferralView({ userProfile, user, onBack }: { userProfile: UserProfile | null; user: User; onBack?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'referrals'), where('inviterId', '==', user.uid), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setReferredUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Referrals listener failed', error);
    });
    return unsub;
  }, [user]);

  const handleCopy = () => {
    if (userProfile?.referralCode) {
      navigator.clipboard.writeText(userProfile.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    if (userProfile?.referralCode) {
      const text = `خدم بـ KANACH باش تنظم حانوتك وتتبع مبيعاتك. استعمل الكود ديالي واستافد: ${userProfile.referralCode}\nhttps://kanach.app`;
      if (navigator.share) {
        navigator.share({
          title: 'دعوة لـ KANACH',
          text: text,
          url: window.location.href
        });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        {onBack && (
          <button onClick={onBack} className="p-2 bg-white rounded-xl text-emerald-600 shadow-sm border border-emerald-50">
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        <h2 className="text-3xl font-black text-emerald-900">ربح معانا</h2>
      </div>
      
      <Card className="bg-emerald-900 text-white border-none p-8 text-center space-y-4">
        <div className="bg-emerald-800/50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2">
          <Gift className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold">استدعي صحابك وربح</h3>
        <p className="text-emerald-300 text-sm">على كل واحد دخل بالكود ديالك، غادي تربح 50 DH رصيد فالتطبيق</p>
        
        <div className="bg-white/10 p-6 rounded-3xl border border-white/10 mt-6">
          <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">الكود ديالك</div>
          <div className="text-4xl font-black tracking-widest mb-6">{userProfile?.referralCode}</div>
          <div className="flex gap-3">
            <button 
              onClick={handleCopy}
              className="flex-1 bg-white text-emerald-900 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'تم النسخ' : 'نسخ'}
            </button>
            <button 
              onClick={handleShare}
              className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Share2 className="w-5 h-5" />
              بارطاجي
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center p-6">
          <div className="text-emerald-400 text-xs font-bold mb-1">ناس لي دخلتي</div>
          <div className="text-3xl font-black text-emerald-900">{userProfile?.referralCount || 0}</div>
        </Card>
        <Card className="text-center p-6">
          <div className="text-emerald-400 text-xs font-bold mb-1">الرصيد المربوح</div>
          <div className="text-3xl font-black text-emerald-900">{userProfile?.internalCredit || 0} DH</div>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-emerald-800 ml-2">تاريخ الدعوات</h3>
        <div className="grid gap-3">
          {referredUsers.length === 0 ? (
            <div className="text-center py-10 text-emerald-300 italic">مازال ما دخل حتى واحد بالكود ديالك</div>
          ) : (
            referredUsers.map(ref => (
              <Card key={ref.id} className="flex justify-between items-center p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold">كليان جديد دخل</div>
                    <div className="text-xs text-emerald-400">
                      {format((ref.date as any).toDate ? (ref.date as any).toDate() : new Date(ref.date), 'dd/MM/yyyy')}
                    </div>
                  </div>
                </div>
                <div className="text-emerald-600 font-black">+50 DH</div>
              </Card>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DailyReportView({ sales, credits, user }: { sales: Sale[]; credits: CreditTransaction[]; user: User }) {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const q = query(
      collection(db, 'daily_reports'), 
      where('shopId', '==', user.uid),
      where('date', '==', todayStr),
      limit(1)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setReport({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DailyReport);
        setLoading(false);
      } else {
        // If no report exists, we calculate it on the fly for the UI
        calculateAndSaveReport();
      }
    }, (error) => {
      console.error('Daily report listener failed', error);
    });

    return unsub;
  }, [user.uid, sales, credits]);

  const calculateAndSaveReport = async () => {
    const today = startOfDay(new Date());
    const yesterday = startOfDay(new Date(Date.now() - 86400000));
    const todayStr = format(today, 'yyyy-MM-dd');

    const todaySales = sales.filter(s => {
      const d = (s.createdAt as any).toDate ? (s.createdAt as any).toDate() : new Date(s.createdAt);
      return d >= today;
    });

    const yesterdaySales = sales.filter(s => {
      const d = (s.createdAt as any).toDate ? (s.createdAt as any).toDate() : new Date(s.createdAt);
      return d >= yesterday && d < today;
    });

    const todayCredits = credits.filter(c => {
      const d = (c.date as any).toDate ? (c.date as any).toDate() : new Date(c.date);
      return d >= today && c.type === 'credit';
    });

    const totalSales = todaySales.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const yesterdayTotal = yesterdaySales.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const transactions = todaySales.length;
    const productsSold = todaySales.reduce((acc, curr) => acc + curr.quantity, 0);
    const creditAdded = todayCredits.reduce((acc, curr) => acc + curr.amount, 0);

    // Find top product
    const productCounts: { [name: string]: number } = {};
    todaySales.forEach(s => {
      productCounts[s.productName] = (productCounts[s.productName] || 0) + s.quantity;
    });

    let topProductName = 'لا يوجد';
    let topProductQty = 0;
    Object.entries(productCounts).forEach(([name, qty]) => {
      if (qty > topProductQty) {
        topProductQty = qty;
        topProductName = name;
      }
    });

    const reportData = {
      shopId: user.uid,
      date: todayStr,
      totalSales,
      transactions,
      productsSold,
      creditAdded,
      topProduct: {
        name: topProductName,
        quantity: topProductQty
      },
      yesterdaySales: yesterdayTotal
    };

    try {
      // Check if report already exists to update or add
      const q = query(
        collection(db, 'daily_reports'),
        where('shopId', '==', user.uid),
        where('date', '==', todayStr)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        await addDoc(collection(db, 'daily_reports'), reportData);
      } else {
        await updateDoc(doc(db, 'daily_reports', snap.docs[0].id), reportData);
      }
    } catch (err) {
      console.error('Failed to save report', err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-emerald-600 font-bold">جاري تحضير التقرير...</p>
      </div>
    );
  }

  if (!report) return null;

  const diff = report.totalSales - (report.yesterdaySales || 0);
  const isUp = diff >= 0;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 pb-12"
    >
      <div className="text-center space-y-2">
        <div className="bg-emerald-100 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
          <TrendingUp className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-black text-emerald-900">تقرير اليوم</h2>
        <p className="text-emerald-500 font-bold">{format(new Date(), 'dd MMMM yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Main Sales Card */}
        <Card className="bg-emerald-600 text-white border-none p-8 text-center space-y-4 shadow-xl shadow-emerald-100">
          <p className="text-emerald-100 font-bold uppercase tracking-widest text-xs">مجموع المبيعات</p>
          <div className="text-5xl font-black">{report.totalSales} <span className="text-xl opacity-60">DH</span></div>
          
          <div className="pt-4 border-t border-emerald-500/30 flex justify-between items-center">
            <div className="text-left">
              <p className="text-[10px] text-emerald-200 uppercase font-bold">البارح</p>
              <p className="font-bold">{report.yesterdaySales || 0} DH</p>
            </div>
            <div className={cn(
              "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold",
              isUp ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
            )}>
              {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(diff)} DH
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-6 text-center space-y-2">
            <div className="bg-blue-50 w-10 h-10 rounded-xl flex items-center justify-center mx-auto text-blue-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-slate-800">{report.transactions}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">عمليات البيع</p>
          </Card>

          <Card className="p-6 text-center space-y-2">
            <div className="bg-amber-50 w-10 h-10 rounded-xl flex items-center justify-center mx-auto text-amber-600">
              <Package className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-slate-800">{report.productsSold}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">سلعة تباعت</p>
          </Card>
        </div>

        {/* Top Product */}
        <Card className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">أكثر سلعة تباعت</p>
              <p className="text-lg font-black text-slate-800">{report.topProduct.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-black text-emerald-600">{report.topProduct.quantity}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">حبة</p>
          </div>
        </Card>

        {/* Credit Added */}
        <Card className="p-6 flex items-center justify-between border-rose-100 bg-rose-50/30">
          <div className="flex items-center gap-4">
            <div className="bg-rose-100 p-3 rounded-2xl text-rose-600">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">كريدي جديد تزاد</p>
              <p className="text-lg font-black text-slate-800">{report.creditAdded} DH</p>
            </div>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-300" />
        </Card>
      </div>

      <div className="pt-4">
        <Button onClick={() => window.print()} variant="secondary" className="w-full py-4 text-sm">
          تحميل التقرير (PDF)
        </Button>
      </div>
    </motion.div>
  );
}

function DashboardView({ sales, products, customers, onOpenReport, onOpenSubscription, onOpenSuppliers, userProfile, user }: { 
  sales: Sale[]; 
  products: Product[]; 
  customers: Customer[];
  onOpenReport: () => void;
  onOpenSubscription: () => void;
  onOpenSuppliers: (p?: Product) => void;
  userProfile: UserProfile | null;
  user: User;
}) {
  const [showReferral, setShowReferral] = useState(false);
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(new Date());

  const dailySales = sales.filter(s => {
    const saleDate = (s.createdAt as any).toDate ? (s.createdAt as any).toDate() : new Date(s.createdAt);
    return saleDate >= today;
  });

  const monthlySales = sales.filter(s => {
    const saleDate = (s.createdAt as any).toDate ? (s.createdAt as any).toDate() : new Date(s.createdAt);
    return saleDate >= monthStart;
  });

  const dailyTotal = dailySales.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const dailyProfit = dailySales.reduce((acc, curr) => acc + curr.profit, 0);
  const monthlyTotal = monthlySales.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const monthlyProfit = monthlySales.reduce((acc, curr) => acc + curr.profit, 0);

  const lowStockCount = products.filter(p => p.stock <= p.lowStockThreshold).length;
  const totalCredit = customers.reduce((acc, curr) => acc + curr.totalDebt, 0);

  // Chart data
  const chartData = [
    { name: 'اليوم', total: dailyTotal, profit: dailyProfit },
    { name: 'الشهر', total: monthlyTotal, profit: monthlyProfit }
  ];

  if (showReferral) {
    return <ReferralView userProfile={userProfile} user={user} onBack={() => setShowReferral(false)} />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <h2 className="text-3xl font-black text-emerald-900">الحسابات</h2>

      {/* Subscription Status Bar */}
      <div className="grid grid-cols-1 gap-4">
        <button 
          onClick={onOpenSubscription}
          className={cn(
            "w-full p-4 rounded-3xl flex items-center justify-between border-2 transition-all",
            userProfile?.subscriptionStatus === 'active' 
              ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
              : userProfile?.subscriptionStatus === 'trial'
                ? "bg-amber-50 border-amber-100 text-amber-700"
                : "bg-rose-50 border-rose-100 text-rose-700 animate-pulse"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-xl",
              userProfile?.subscriptionStatus === 'active' ? "bg-emerald-500 text-white" : 
              userProfile?.subscriptionStatus === 'trial' ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
            )}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase opacity-60">حالة الاشتراك</p>
              <p className="text-sm font-black">
                {userProfile?.subscriptionStatus === 'active' ? 'حساب مفعل ومحمي' : 
                 userProfile?.subscriptionStatus === 'trial' ? (
                   `فترة تجريبية: ${Math.max(0, Math.ceil((userProfile.subscriptionEndDate.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} أيام متبقية`
                 ) : 'الاشتراك منتهي أو قيد المراجعة'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 opacity-40" />
        </button>

        {/* Referral Card - Professional Style */}
        <button 
          onClick={() => setShowReferral(true)}
          className="w-full bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-6 rounded-[32px] flex items-center justify-between border-none transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
        >
          <div className="flex items-center gap-4">
            <div className="bg-emerald-700/50 p-3 rounded-2xl text-emerald-400">
              <Gift className="w-6 h-6" />
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase tracking-widest opacity-60 mb-1">برنامج المكافآت</p>
              <p className="text-lg font-black">استدعي صحابك وربح 50 DH</p>
            </div>
          </div>
          <div className="bg-white/10 p-2 rounded-full">
            <ChevronRight className="w-5 h-5 opacity-60" />
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-emerald-600 text-white border-none p-4 cursor-pointer active:scale-95 transition-transform" onClick={onOpenReport}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-emerald-100 text-xs font-bold mb-1">مبيعات اليوم</div>
              <div className="text-2xl font-black">{dailyTotal} DH</div>
            </div>
            <ChevronRight className="w-6 h-6 opacity-50" />
          </div>
        </Card>
        <Card className="bg-emerald-900 text-white border-none p-4">
          <div className="text-emerald-300 text-xs font-bold mb-1">ربح اليوم</div>
          <div className="text-2xl font-black">{dailyProfit} DH</div>
        </Card>
      </div>

      <Card className="bg-rose-500 text-white border-none p-4">
        <div className="text-rose-100 text-xs font-bold mb-1">مجموع الكريدي عند الناس</div>
        <div className="text-3xl font-black">{totalCredit} DH</div>
      </Card>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-emerald-800">مقارنة الأرباح</h3>
          <TrendingUp className="text-emerald-400 w-5 h-5" />
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
              <YAxis hide />
              <Tooltip 
                cursor={{fill: 'transparent'}}
                contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
              />
              <Bar dataKey="total" fill="#10b981" radius={[8, 8, 0, 0]} barSize={40} />
              <Bar dataKey="profit" fill="#064e3b" radius={[8, 8, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="font-bold text-emerald-800 ml-2">تنبيهات</h3>
        {lowStockCount > 0 && (
          <div className="bg-rose-50 border border-rose-100 p-5 rounded-3xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-rose-100 p-3 rounded-2xl text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-rose-900">{lowStockCount} د السلعة قربات تسالي</div>
                <div className="text-rose-500 text-sm">خاصك تعمر الـ Stock</div>
              </div>
            </div>
            <button 
              onClick={() => onOpenSuppliers(products.find(p => p.stock <= p.lowStockThreshold))}
              className="bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors active:scale-95"
            >
              طلب السلعة
            </button>
          </div>
        )}
        
        <Card className="flex items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
            <History className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold text-emerald-900">مبيعات الشهر</div>
            <div className="text-emerald-500 font-black text-xl">{monthlyTotal} DH</div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function SuppliersView({ suppliers, supplyOrders, supplierPayments, products, user, preselectedProduct, onClearPreselected }: { 
  suppliers: Supplier[]; 
  supplyOrders: SupplyOrder[]; 
  supplierPayments: SupplierPayment[];
  products: Product[]; 
  user: User;
  preselectedProduct?: Product | null;
  onClearPreselected?: () => void;
}) {
  const [view, setView] = useState<'list' | 'add' | 'details' | 'new-order' | 'edit'>('list');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', company: '', phone: '', address: '' });
  const [orderItems, setOrderItems] = useState<SupplyOrderItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDetailsTab, setActiveDetailsTab] = useState<'orders' | 'payments'>('orders');
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '' });

  const totalSupplierDebt = suppliers.reduce((acc, curr) => acc + curr.totalDebt, 0);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.company && s.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'suppliers'), {
        ...supplierForm,
        totalDebt: 0,
        ownerId: user.uid,
        createdAt: new Date().toISOString()
      });
      setView('list');
      setSupplierForm({ name: '', company: '', phone: '', address: '' });
    } catch (error) {
      console.error('Add supplier failed', error);
    }
  };

  const handleAddOrder = async () => {
    if (!selectedSupplier || orderItems.length === 0) return;
    setIsSubmitting(true);
    const totalCost = orderItems.reduce((acc, item) => acc + (item.costPrice * item.quantity), 0);
    const paid = Number(paidAmount);
    const debt = totalCost - paid;

    try {
      const orderData: Omit<SupplyOrder, 'id'> = {
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        items: orderItems,
        totalCost,
        paidAmount: paid,
        paymentStatus: paid >= totalCost ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'),
        status: 'received', // Auto-received for simplicity in this version
        ownerId: user.uid,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'supply_orders'), orderData);

      // Update Product Stocks and Cost Prices
      for (const item of orderItems) {
        const productRef = doc(db, 'products', item.productId);
        await updateDoc(productRef, {
          stock: increment(item.quantity),
          costPrice: item.costPrice // Update cost price to latest
        });
      }

      // Update Supplier Debt
      if (debt > 0) {
        await updateDoc(doc(db, 'suppliers', selectedSupplier.id), {
          totalDebt: increment(debt)
        });
      }

      setView('details');
      setOrderItems([]);
      setPaidAmount('0');
      alert('تم تسجيل التوريد وتحديث الستوك بنجاح!');
    } catch (error) {
      console.error('Order failed', error);
      alert('وقع مشكل فالتسجيل');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    try {
      await updateDoc(doc(db, 'suppliers', selectedSupplier.id), {
        ...supplierForm,
        updatedAt: new Date().toISOString()
      });
      setView('details');
      const updated = suppliers.find(s => s.id === selectedSupplier.id);
      if (updated) setSelectedSupplier(updated);
    } catch (error) {
      console.error('Update supplier failed', error);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    const amount = Number(paymentForm.amount);
    if (amount <= 0) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'supplier_payments'), {
        supplierId: selectedSupplier.id,
        amount: amount,
        note: paymentForm.note,
        date: Timestamp.now(),
        ownerId: user.uid
      });

      await updateDoc(doc(db, 'suppliers', selectedSupplier.id), {
        totalDebt: increment(-amount)
      });

      setIsAddingPayment(false);
      setPaymentForm({ amount: '', note: '' });
      const updated = suppliers.find(s => s.id === selectedSupplier.id);
      if (updated) setSelectedSupplier(updated);
    } catch (error) {
      console.error('Record payment failed', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addToOrder = (product: Product) => {
    setOrderItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, costPrice: product.costPrice || 0 }];
    });
  };

  const updateOrderItem = (productId: string, field: keyof SupplyOrderItem, value: number) => {
    setOrderItems(prev => prev.map(item => item.productId === productId ? { ...item, [field]: value } : item));
  };

  const removeFromOrder = (productId: string) => {
    setOrderItems(prev => prev.filter(item => item.productId !== productId));
  };

  useEffect(() => {
    if (preselectedProduct && suppliers.length > 0) {
      // If we have a pre-selected product, we try to open the first supplier for a new order
      setSelectedSupplier(suppliers[0]);
      setView('new-order');
      addToOrder(preselectedProduct);
      onClearPreselected?.();
    }
  }, [preselectedProduct, suppliers, onClearPreselected]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-emerald-900">الموردين</h2>
        {view === 'list' && (
          <Button onClick={() => setView('add')} className="py-3 px-4 rounded-2xl">
            <Plus className="w-5 h-5" />
            <span>مورد جديد</span>
          </Button>
        )}
        {view !== 'list' && (
          <button onClick={() => setView('list')} className="p-3 bg-white rounded-2xl text-emerald-600 shadow-sm border border-emerald-50">
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
      </div>

      {view === 'list' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="bg-emerald-600 text-white border-none p-8 text-center space-y-2 shadow-xl shadow-emerald-100">
            <p className="text-emerald-100 font-bold uppercase tracking-widest text-xs">ديون الموردين</p>
            <div className="text-5xl font-black">{totalSupplierDebt} <span className="text-xl opacity-60">DH</span></div>
          </Card>

          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="بحث عن مورد..." 
              className="w-full pr-12 pl-4 py-4 rounded-2xl border border-emerald-100 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {filteredSuppliers.map(s => (
              <button 
                key={s.id} 
                onClick={() => { setSelectedSupplier(s); setView('details'); }}
                className="w-full bg-white p-5 rounded-[32px] border border-emerald-50 shadow-sm flex justify-between items-center active:scale-95 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-800 text-lg">{s.name}</div>
                    <div className="text-slate-400 text-xs font-bold">{s.company || 'بدون شركة'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("font-black text-xl", s.totalDebt > 0 ? "text-rose-600" : "text-emerald-600")}>
                    {s.totalDebt} <span className="text-xs">DH</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">الكريدي</div>
                </div>
              </button>
            ))}
            {filteredSuppliers.length === 0 && (
              <div className="text-center py-12 text-slate-400 italic">لا يوجد موردين بهذا الاسم</div>
            )}
          </div>
        </motion.div>
      )}

      {view === 'add' && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="p-8 space-y-6">
            <h3 className="text-xl font-black text-slate-900">معلومات المورد</h3>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <Input label="اسم المورد" value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} required />
              <Input label="الشركة" value={supplierForm.company} onChange={e => setSupplierForm({...supplierForm, company: e.target.value})} />
              <Input label="الهاتف" value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} />
              <Input label="العنوان" value={supplierForm.address} onChange={e => setSupplierForm({...supplierForm, address: e.target.value})} />
              <Button type="submit" className="w-full py-5">حفظ المورد</Button>
            </form>
          </Card>
        </motion.div>
      )}

      {view === 'edit' && selectedSupplier && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="p-8 space-y-6">
            <h3 className="text-xl font-black text-slate-900">تعديل معلومات المورد</h3>
            <form onSubmit={handleEditSupplier} className="space-y-4">
              <Input label="اسم المورد" value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} required />
              <Input label="الشركة" value={supplierForm.company} onChange={e => setSupplierForm({...supplierForm, company: e.target.value})} />
              <Input label="الهاتف" value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} />
              <Input label="العنوان" value={supplierForm.address} onChange={e => setSupplierForm({...supplierForm, address: e.target.value})} />
              <Button type="submit" className="w-full py-5">تحديث المعلومات</Button>
            </form>
          </Card>
        </motion.div>
      )}

      {view === 'details' && selectedSupplier && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <Card className="p-8 text-center space-y-4 relative">
            <button 
              onClick={() => {
                setSupplierForm({
                  name: selectedSupplier.name,
                  company: selectedSupplier.company || '',
                  phone: selectedSupplier.phone || '',
                  address: selectedSupplier.address || ''
                });
                setView('edit');
              }}
              className="absolute left-6 top-6 p-2 text-slate-400 hover:text-emerald-600 transition-colors"
            >
              <Pencil className="w-5 h-5" />
            </button>
            <div className="bg-emerald-50 w-20 h-20 rounded-[32px] flex items-center justify-center mx-auto text-emerald-600">
              <Truck className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">{selectedSupplier.name}</h3>
              <p className="text-slate-400 font-bold">{selectedSupplier.company}</p>
            </div>
            <div className="bg-rose-50 p-6 rounded-3xl">
              <p className="text-rose-600 text-xs font-bold uppercase tracking-widest mb-1">الكريدي اللي كيتسالني</p>
              <p className="text-4xl font-black text-rose-700">{selectedSupplier.totalDebt} DH</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => setView('new-order')} className="py-4 rounded-2xl text-sm">
                <PlusCircle className="w-5 h-5" />
                <span>توريد جديد</span>
              </Button>
              <Button 
                variant="secondary" 
                className="py-4 rounded-2xl text-sm bg-emerald-50 border-emerald-100 text-emerald-700" 
                onClick={() => setIsAddingPayment(true)}
              >
                <Wallet className="w-5 h-5" />
                <span>تسجيل خلاص</span>
              </Button>
            </div>
            {selectedSupplier.phone && (
              <Button variant="ghost" className="w-full py-3 rounded-2xl text-sm" onClick={() => window.open(`tel:${selectedSupplier.phone}`)}>
                <Phone className="w-4 h-4" />
                <span>اتصال بالمورد: {selectedSupplier.phone}</span>
              </Button>
            )}
          </Card>

          {isAddingPayment && (
            <Card className="p-6 space-y-4 border-2 border-emerald-500">
              <div className="flex justify-between items-center">
                <h4 className="font-black text-slate-900">تسجيل خلاص للمورد</h4>
                <button onClick={() => setIsAddingPayment(false)} className="text-slate-400"><XCircle className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleRecordPayment} className="space-y-4">
                <Input 
                  label="المبلغ المدفوع (DH)" 
                  type="number" 
                  value={paymentForm.amount} 
                  onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} 
                  required 
                />
                <Input 
                  label="ملاحظة" 
                  value={paymentForm.note} 
                  onChange={e => setPaymentForm({...paymentForm, note: e.target.value})} 
                  placeholder="مثلا: خلاص شيك رقم..."
                />
                <Button type="submit" className="w-full py-4" disabled={isSubmitting}>
                  {isSubmitting ? 'جاري الحفظ...' : 'تأكيد الخلاص'}
                </Button>
              </form>
            </Card>
          )}

          <div className="bg-white p-1 rounded-2xl shadow-sm border border-emerald-50 flex gap-1">
            <button 
              onClick={() => setActiveDetailsTab('orders')}
              className={cn(
                "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                activeDetailsTab === 'orders' ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              التوريدات
            </button>
            <button 
              onClick={() => setActiveDetailsTab('payments')}
              className={cn(
                "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                activeDetailsTab === 'payments' ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              الأداءات
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="font-black text-slate-800 ml-2">
              {activeDetailsTab === 'orders' ? 'تاريخ التوريدات' : 'تاريخ الأداءات'}
            </h4>
            
            {activeDetailsTab === 'orders' ? (
              <div className="space-y-4">
                {supplyOrders.filter(o => o.supplierId === selectedSupplier.id).map(order => (
                  <Card key={order.id} className="p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-800">{format(order.createdAt.toDate(), 'dd/MM/yyyy')}</div>
                        <div className="text-xs text-slate-400">{order.items.length} سلع</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-emerald-600">{order.totalCost} DH</div>
                        <div className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                          order.paymentStatus === 'paid' ? "bg-emerald-100 text-emerald-600" : 
                          order.paymentStatus === 'partial' ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                        )}>
                          {order.paymentStatus === 'paid' ? 'خالص' : 
                           order.paymentStatus === 'partial' ? 'خالص جزئيا' : 'باقي الكريدي'}
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-50 pt-3 space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-slate-500">{item.name} x{item.quantity}</span>
                          <span className="font-bold text-slate-700">{item.costPrice * item.quantity} DH</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
                {supplyOrders.filter(o => o.supplierId === selectedSupplier.id).length === 0 && (
                  <div className="text-center py-8 text-slate-400 italic">لا توجد توريدات مسجلة</div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {supplierPayments.filter(p => p.supplierId === selectedSupplier.id).map(payment => (
                  <Card key={payment.id} className="p-5 flex justify-between items-center border-emerald-100 bg-emerald-50/20">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{payment.amount} DH</div>
                        <div className="text-[10px] text-slate-400 font-bold">{format(payment.date.toDate(), 'dd/MM/yyyy HH:mm')}</div>
                      </div>
                    </div>
                    {payment.note && (
                      <div className="text-xs text-slate-500 italic max-w-[150px] text-left">
                        {payment.note}
                      </div>
                    )}
                  </Card>
                ))}
                {supplierPayments.filter(p => p.supplierId === selectedSupplier.id).length === 0 && (
                  <div className="text-center py-8 text-slate-400 italic">لا توجد أداءات مسجلة</div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {view === 'new-order' && selectedSupplier && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-black text-slate-900">توريد جديد من {selectedSupplier.name}</h3>
            
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase">اختار السلعة</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {products.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => addToOrder(p)}
                    className="shrink-0 bg-emerald-50 px-4 py-3 rounded-2xl text-emerald-700 font-bold text-sm border border-emerald-100"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-t border-slate-50 pt-4">
              {orderItems.map(item => (
                <div key={item.productId} className="bg-slate-50 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">{item.name}</span>
                    <button onClick={() => removeFromOrder(item.productId)} className="text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">الكمية</label>
                      <input 
                        type="number" 
                        className="w-full p-2 rounded-xl border border-slate-200" 
                        value={item.quantity} 
                        onChange={e => updateOrderItem(item.productId, 'quantity', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">ثمن الشراء (DH)</label>
                      <input 
                        type="number" 
                        className="w-full p-2 rounded-xl border border-slate-200" 
                        value={item.costPrice} 
                        onChange={e => updateOrderItem(item.productId, 'costPrice', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {orderItems.length > 0 && (
              <div className="space-y-4 border-t border-slate-50 pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500">المجموع الكلي:</span>
                  <span className="text-2xl font-black text-emerald-600">
                    {orderItems.reduce((acc, item) => acc + (item.costPrice * item.quantity), 0)} DH
                  </span>
                </div>
                <Input 
                  label="المبلغ المدفوع (DH)" 
                  type="number" 
                  value={paidAmount} 
                  onChange={e => setPaidAmount(e.target.value)} 
                />
                <Button onClick={handleAddOrder} className="w-full py-5" disabled={isSubmitting}>
                  {isSubmitting ? 'جاري الحفظ...' : 'تأكيد التوريد'}
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { Customer, CreditTransaction, UserProfile } from '../types';
import { format } from 'date-fns';
import { Package, Clock, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';

interface CustomerCreditPageProps {
  customerId: string;
}

export default function CustomerCreditPage({ customerId }: CustomerCreditPageProps) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [shop, setShop] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'credits' | 'payments'>('credits');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;

    // Listen to customer data
    const unsubCustomer = onSnapshot(doc(db, 'customers', customerId), (docSnap) => {
      if (docSnap.exists()) {
        const customerData = { id: docSnap.id, ...docSnap.data() } as Customer;
        setCustomer(customerData);
        
        // Fetch shop info once we have ownerId
        if (customerData.ownerId) {
          onSnapshot(doc(db, 'users', customerData.ownerId), (shopSnap) => {
            if (shopSnap.exists()) {
              setShop({ uid: shopSnap.id, ...shopSnap.data() } as UserProfile);
            }
          });
        }
        setLoading(false);
      } else {
        setError('المستخدم غير موجود');
        setLoading(false);
      }
    }, (err) => {
      console.error(err);
      setError('وقع مشكل فالحصول على البيانات');
      setLoading(false);
    });

    // Listen to transactions
    const q = query(
      collection(db, 'credits'),
      where('customerId', '==', customerId),
      limit(100)
    );

    const unsubTransactions = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditTransaction));
      const sorted = docs.sort((a, b) => {
        const dateA = (a.date as any)?.toDate ? (a.date as any).toDate().getTime() : new Date(a.date).getTime();
        const dateB = (b.date as any)?.toDate ? (b.date as any).toDate().getTime() : new Date(b.date).getTime();
        return dateB - dateA;
      });
      setTransactions(sorted);
    }, (err) => {
      console.error("Transactions listener error:", err);
    });

    return () => {
      unsubCustomer();
      unsubTransactions();
    };
  }, [customerId]);

  const creditTransactions = transactions.filter(t => t.type !== 'payment' && t.status !== 'paid');
  const paymentTransactions = transactions.filter(t => t.type === 'payment' || t.status === 'paid');

  const totalTaken = creditTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = paymentTransactions.reduce((sum, t) => sum + t.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-emerald-800 font-bold">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-[40px] shadow-xl max-w-sm w-full space-y-4">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <Package className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">{error || 'مشكل فالحساب'}</h2>
          <p className="text-slate-500">تأكد من الرابط أو اتصل بمول الحانوت</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] font-sans text-emerald-950 pb-12">
      {/* Header */}
      <div className="bg-emerald-600 text-white p-8 rounded-b-[50px] shadow-lg shadow-emerald-100 text-center space-y-2">
        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold opacity-90">{shop?.shopName || 'حانوت'}</h1>
        <p className="text-3xl font-black">{customer.name}</p>
      </div>

      <div className="max-w-md mx-auto px-6 -mt-8 space-y-6">
        {/* Total Debt Card */}
        <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-emerald-100/50 border border-emerald-50 text-center space-y-2">
          <p className="text-emerald-600 font-bold uppercase tracking-widest text-xs">الكريدي الحالي</p>
          <div className="text-5xl font-black text-emerald-950 flex items-center justify-center gap-2">
            <span>{customer.totalDebt}</span>
            <span className="text-xl opacity-50">DH</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-emerald-500 text-xs font-bold mt-4">
            <Clock className="w-3 h-3" />
            <span>آخر تحديث: {customer.updatedAt ? format(new Date(customer.updatedAt), 'HH:mm - dd/MM') : 'دابا'}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white p-2 rounded-3xl shadow-sm border border-emerald-50 flex gap-2">
          <button 
            onClick={() => setActiveTab('credits')}
            className={`flex-1 py-4 rounded-2xl font-black transition-all ${
              activeTab === 'credits' 
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' 
                : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            السلعة (الكريدي)
          </button>
          <button 
            onClick={() => setActiveTab('payments')}
            className={`flex-1 py-4 rounded-2xl font-black transition-all ${
              activeTab === 'payments' 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' 
                : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            الخلاص (الأداء)
          </button>
        </div>

        {/* Tab Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-3xl border border-emerald-50 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">مجموع السلعة</p>
            <p className="text-xl font-black text-rose-600">{totalTaken} DH</p>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-emerald-50 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">مجموع الخلاص</p>
            <p className="text-xl font-black text-emerald-600">{totalPaid} DH</p>
          </div>
        </div>

        {/* Transactions list */}
        <div className="space-y-4">
          <h3 className="text-lg font-black px-2 flex items-center gap-2">
            <TrendingUp className={`w-5 h-5 ${activeTab === 'credits' ? 'text-rose-500' : 'text-emerald-600'}`} />
            {activeTab === 'credits' ? 'السلعة لي خديتي' : 'الخلاص لي عطيتي'}
          </h3>
          
          <div className="space-y-3">
            {(activeTab === 'credits' ? creditTransactions : paymentTransactions).length === 0 ? (
              <div className="bg-white p-12 rounded-[40px] text-center text-slate-400 italic border border-dashed border-slate-200">
                لا توجد عمليات مسجلة
              </div>
            ) : (
              (activeTab === 'credits' ? creditTransactions : paymentTransactions).map((t) => {
                const tDate = (t.date as any)?.toDate ? (t.date as any).toDate() : new Date(t.date);
                const isPayment = t.type === 'payment' || t.status === 'paid';
                return (
                  <div key={t.id} className="bg-white p-5 rounded-3xl shadow-sm border border-emerald-50 flex items-center justify-between group active:scale-95 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        isPayment 
                          ? 'bg-emerald-100 text-emerald-600' 
                          : 'bg-rose-100 text-rose-600'
                      }`}>
                        {isPayment ? <ArrowDownRight /> : <ArrowUpRight />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{isPayment ? 'خلاص' : 'تقضية جديدة'}</p>
                        {t.note && (
                          <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap leading-relaxed">
                            {t.note}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{format(tDate, 'dd MMMM yyyy')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${
                        isPayment ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isPayment ? '-' : '+'}{t.amount} DH
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Branding */}
        <div className="pt-8 text-center space-y-4">
          <div className="h-px bg-emerald-100 w-24 mx-auto"></div>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em]">
            Managed by KANACH – Digital Hanout App
          </p>
        </div>
      </div>
    </div>
  );
}

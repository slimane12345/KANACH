import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Upload, 
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Subscription, PaymentProof } from '../types';
import { format } from 'date-fns';
import { Button, Card, Input } from '../App';

interface SubscriptionPageProps {
  userProfile: UserProfile | null;
  onBack: () => void;
}

const PAYMENT_METHODS = {
  bank: {
    name: "تحويل بنكي",
    bankName: "CIH Bank",
    accountName: "KANACH SAAS SOLUTIONS",
    iban: "MA64 230 120 0000 1234 5678 9012 34",
    amount: 50
  },
  whatsapp: {
    name: "واتساب باي / محفظة",
    phone: "+212 600 000 000",
    note: "صيفط لينا التوصيل فواتساب"
  }
};

export default function SubscriptionPage({ userProfile, onBack }: SubscriptionPageProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'renew'>('status');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'whatsapp'>('bank');
  const [loading, setLoading] = useState(false);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    const q = query(
      collection(db, 'payment_proofs'), 
      where('shopId', '==', userProfile.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setProofs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentProof)));
    });
    return unsub;
  }, [userProfile]);

  const handleCopyIban = () => {
    navigator.clipboard.writeText(PAYMENT_METHODS.bank.iban);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // In a real app, we would upload to Firebase Storage
      // For this demo, we'll use a data URL or a placeholder
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload failed', err);
      setUploading(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!userProfile || !imageUrl) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'payment_proofs'), {
        shopId: userProfile.uid,
        shopName: userProfile.shopName || 'بدون اسم',
        amount: PAYMENT_METHODS.bank.amount || 50,
        imageUrl: imageUrl,
        status: 'pending',
        createdAt: Timestamp.now()
      });

      // Also send a notification to admin (simulated by adding to notifications collection)
      await addDoc(collection(db, 'notifications'), {
        title: 'طلب اشتراك جديد',
        message: `قام ${userProfile.shopName} برفع إثبات دفع بقيمة 50 درهم`,
        type: 'info',
        read: false,
        timestamp: Timestamp.now(),
        targetType: 'specific',
        targetUserId: 'admin' // Assuming admin has this ID or role
      });

      setSuccess(true);
      setImageUrl('');
      setActiveTab('status');
    } catch (err) {
      console.error('Submission failed', err);
    } finally {
      setLoading(false);
    }
  };

  const isExpired = userProfile?.subscriptionStatus === 'expired';
  const isTrial = userProfile?.subscriptionStatus === 'trial';
  const isPending = userProfile?.subscriptionStatus === 'pending' || proofs.some(p => p.status === 'pending');

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-600">
            <ChevronRight className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-black text-slate-900">الاشتراك الشهري</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Status Card */}
        <Card className="overflow-hidden border-none shadow-sm">
          <div className={cn(
            "p-6 text-white flex flex-col items-center text-center space-y-4",
            isExpired ? "bg-rose-500" : isTrial ? "bg-amber-500" : isPending ? "bg-amber-500" : "bg-emerald-500"
          )}>
            <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
              {isExpired ? (
                <AlertCircle className="w-10 h-10" />
              ) : isTrial || isPending ? (
                <Clock className="w-10 h-10" />
              ) : (
                <ShieldCheck className="w-10 h-10" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black">
                {isExpired ? 'اشتراك منتهي' : isTrial ? 'فترة تجريبية' : isPending ? 'في انتظار التأكيد' : 'اشتراك مفعل'}
              </h2>
              <p className="opacity-90 text-sm mt-1">
                {isExpired ? 'جدد اشتراكك دابا باش تستافد من كاع المميزات' : 
                 isTrial ? 'كتستافد دابا من فترة تجريبية فابور' :
                 isPending ? 'كنراجعو الطلب ديالك، غادي يتفعل قريبا' : 
                 'حسابك مفعل ومحمي'}
              </p>
            </div>
          </div>
          
          <div className="p-6 bg-white space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">نوع الخطة:</span>
              <span className="text-slate-900 font-black">{isTrial ? 'تجريبية (Trial)' : 'شهري (Monthly)'}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">الثمن:</span>
              <span className="text-emerald-600 font-black">50 درهم / شهر</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">{isTrial ? 'نهاية التجربة:' : 'تاريخ الانتهاء:'}</span>
              <span className="text-slate-900 font-black">
                {userProfile?.subscriptionEndDate ? format(userProfile.subscriptionEndDate.toDate(), 'dd/MM/yyyy') : '---'}
              </span>
            </div>
            
            {!isPending && (
              <Button 
                onClick={() => setActiveTab('renew')} 
                className="w-full py-4 mt-2"
                variant={isExpired || isTrial ? 'primary' : 'secondary'}
              >
                {isExpired ? 'تجديد الاشتراك دابا' : isTrial ? 'تفعيل الحساب دابا' : 'تمديد الاشتراك'}
              </Button>
            )}
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200">
          <button 
            onClick={() => setActiveTab('status')}
            className={cn(
              "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
              activeTab === 'status' ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500"
            )}
          >
            تاريخ العمليات
          </button>
          <button 
            onClick={() => setActiveTab('renew')}
            className={cn(
              "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
              activeTab === 'renew' ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500"
            )}
          >
            طريقة الدفع
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'status' ? (
            <motion.div 
              key="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-black text-slate-900 px-1">آخر العمليات</h3>
              {proofs.length === 0 ? (
                <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
                  <CreditCard className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-slate-400 text-sm font-bold">مازال ما درتي حتى عملية دفع</p>
                </div>
              ) : (
                proofs.map(proof => (
                  <div key={proof.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl",
                        proof.status === 'approved' ? "bg-emerald-100 text-emerald-600" :
                        proof.status === 'rejected' ? "bg-rose-100 text-rose-600" :
                        "bg-amber-100 text-amber-600"
                      )}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{proof.amount} درهم</p>
                        <p className="text-[10px] text-slate-400 font-bold">
                          {format(proof.createdAt.toDate(), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-black uppercase",
                      proof.status === 'approved' ? "bg-emerald-50 text-emerald-600" :
                      proof.status === 'rejected' ? "bg-rose-50 text-rose-600" :
                      "bg-amber-50 text-amber-600"
                    )}>
                      {proof.status === 'approved' ? 'مقبول' : 
                       proof.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="renew"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Payment Method Selection */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setPaymentMethod('bank')}
                  className={cn(
                    "p-4 rounded-2xl border-2 font-black text-sm transition-all",
                    paymentMethod === 'bank' ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"
                  )}
                >
                  {PAYMENT_METHODS.bank.name}
                </button>
                <button 
                  onClick={() => setPaymentMethod('whatsapp')}
                  className={cn(
                    "p-4 rounded-2xl border-2 font-black text-sm transition-all",
                    paymentMethod === 'whatsapp' ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"
                  )}
                >
                  {PAYMENT_METHODS.whatsapp.name}
                </button>
              </div>

              {/* Payment Details */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-slate-900">
                    {paymentMethod === 'bank' ? 'تعليمات التحويل البنكي' : 'تعليمات الواتساب / المحفظة'}
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                    {paymentMethod === 'bank' ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500 font-bold">اسم البنك:</span>
                          <span className="text-sm text-slate-900 font-black">{PAYMENT_METHODS.bank.bankName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500 font-bold">اسم الحساب:</span>
                          <span className="text-sm text-slate-900 font-black">{PAYMENT_METHODS.bank.accountName}</span>
                        </div>
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          <span className="text-xs text-slate-500 font-bold">رقم الحساب (IBAN):</span>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-white p-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 break-all">
                              {PAYMENT_METHODS.bank.iban}
                            </code>
                            <button 
                              onClick={handleCopyIban}
                              className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                            >
                              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <p className="text-sm font-black text-slate-900">{PAYMENT_METHODS.whatsapp.phone}</p>
                        <p className="text-xs text-slate-500 font-bold">{PAYMENT_METHODS.whatsapp.note}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700 font-bold leading-relaxed">
                      حول مبلغ <span className="font-black">50 درهم</span>، وصيفط لينا التوصيل (Reçu) باش نفعلوا ليك الحساب.
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Section */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6">
                <h3 className="font-black text-slate-900">رفع إثبات الدفع</h3>
                
                {!imageUrl ? (
                  <label className="block">
                    <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center space-y-3 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all">
                      <div className="bg-slate-100 p-4 rounded-full text-slate-400">
                        {uploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-slate-900">اضغط هنا لرفع الصورة</p>
                        <p className="text-xs text-slate-400 mt-1">سكرين شوت أو صورة التوصيل</p>
                      </div>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                      <img src={imageUrl} alt="Proof" className="w-full h-full object-contain" />
                      <button 
                        onClick={() => setImageUrl('')}
                        className="absolute top-2 right-2 bg-rose-500 text-white p-2 rounded-xl shadow-lg"
                      >
                        إلغاء
                      </button>
                    </div>
                    <Button 
                      onClick={handleSubmitProof} 
                      className="w-full py-4" 
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          جاري الإرسال...
                        </span>
                      ) : 'تأكيد وإرسال الطلب'}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-8 text-center space-y-6"
            >
              <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900">تم الإرسال بنجاح!</h3>
                <p className="text-slate-500 font-bold">
                  غادي نراجعو الطلب ديالك في أقرب وقت (غالبا قل من ساعة) وغادي يوصلك إشعار فاش يتفعل.
                </p>
              </div>
              <Button onClick={() => setSuccess(false)} className="w-full py-4">
                مفهوم
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

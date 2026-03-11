import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  doc, 
  addDoc, 
  Timestamp, 
  orderBy, 
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Users, 
  CreditCard, 
  Gift, 
  BarChart3, 
  Bell, 
  Settings, 
  Search, 
  Download, 
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Package,
  Plus,
  ArrowLeft,
  LayoutDashboard,
  Smartphone,
  Store,
  Calendar,
  FileText,
  Share2,
  Trophy,
  Eye,
  Trash2,
  UserPlus,
  Shield,
  Clock,
  ChevronRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { UserProfile, Payment, AppNotification, AuditLog, Sale, Product, Customer, PaymentProof, Subscription } from '../types';

interface AdminDashboardProps {
  adminUser: UserProfile;
  onBackToApp: () => void;
}

export default function AdminDashboard({ adminUser, onBackToApp }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'payments' | 'referrals' | 'reports' | 'notifications' | 'settings' | 'subscriptions'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    const unsubPayments = onSnapshot(query(collection(db, 'payments'), orderBy('date', 'desc')), (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    });

    const unsubProofs = onSnapshot(query(collection(db, 'payment_proofs'), orderBy('createdAt', 'desc')), (snapshot) => {
      setPaymentProofs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentProof)));
    });

    const unsubNotifications = onSnapshot(query(collection(db, 'notifications'), orderBy('sentAt', 'desc')), (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
    });

    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setAllSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setAllProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setAllCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    setLoading(false);

    return () => {
      unsubUsers();
      unsubPayments();
      unsubNotifications();
      unsubSales();
      unsubProducts();
      unsubCustomers();
    };
  }, []);

  const logAction = async (action: string, targetId: string, targetType: AuditLog['targetType'], details: string) => {
    await addDoc(collection(db, 'audit_logs'), {
      adminId: adminUser.uid,
      adminName: adminUser.shopName || adminUser.email,
      action,
      targetId,
      targetType,
      details,
      timestamp: Timestamp.now()
    });
  };

  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const exportToPDF = (headers: string[], data: any[][], fileName: string) => {
    const doc = new jsPDF();
    (doc as any).autoTable({
      head: [headers],
      body: data,
    });
    doc.save(`${fileName}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center h-screen">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-bottom border-slate-100">
          <h1 className="text-2xl font-black text-emerald-600">KANACH ADMIN</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem icon={<Users />} label="المستخدمين" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          <SidebarItem 
            icon={<CreditCard />} 
            label="الاشتراكات" 
            active={activeTab === 'subscriptions'} 
            onClick={() => setActiveTab('subscriptions')} 
            badge={paymentProofs.filter(p => p.status === 'pending').length}
          />
          <SidebarItem icon={<Gift />} label="نظام الدعوات" active={activeTab === 'referrals'} onClick={() => setActiveTab('referrals')} />
          <SidebarItem icon={<BarChart3 />} label="التقارير" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          <SidebarItem icon={<Bell />} label="التنبيهات" active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} />
          <SidebarItem icon={<Settings />} label="الإعدادات" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={onBackToApp}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-all font-bold"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>الرجوع للتطبيق</span>
          </button>
        </div>
        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
              {adminUser.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{adminUser.email}</p>
              <p className="text-xs text-slate-500">مدير النظام</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <h2 className="text-xl font-bold text-slate-800">
            {activeTab === 'users' && 'إدارة المستخدمين'}
            {activeTab === 'subscriptions' && 'طلبات الاشتراكات'}
            {activeTab === 'payments' && 'الاشتراكات والأداء'}
            {activeTab === 'referrals' && 'نظام الدعوات'}
            {activeTab === 'reports' && 'تقارير المبيعات والديون'}
            {activeTab === 'notifications' && 'إدارة التنبيهات'}
            {activeTab === 'settings' && 'إعدادات النظام'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="بحث..." 
                className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 w-64"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === 'users' && <UsersSection users={users} allCustomers={allCustomers} exportToExcel={exportToExcel} exportToPDF={exportToPDF} logAction={logAction} />}
          {activeTab === 'subscriptions' && (
            <SubscriptionsSection 
              proofs={paymentProofs} 
              users={users} 
              onApprove={async (proof) => {
                const user = users.find(u => u.uid === proof.shopId);
                const currentEndDate = user?.subscriptionEndDate?.toDate() || new Date();
                const newEndDate = new Date(Math.max(currentEndDate.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000);

                await updateDoc(doc(db, 'payment_proofs', proof.id), {
                  status: 'approved',
                  reviewedBy: adminUser.uid,
                  reviewedAt: Timestamp.now()
                });

                await updateDoc(doc(db, 'users', proof.shopId), {
                  subscriptionStatus: 'active',
                  subscriptionEndDate: Timestamp.fromDate(newEndDate)
                });

                await addDoc(collection(db, 'subscriptions'), {
                  shopId: proof.shopId,
                  status: 'active',
                  startDate: Timestamp.now(),
                  endDate: Timestamp.fromDate(newEndDate),
                  plan: 'monthly',
                  price: proof.amount
                });

                await addDoc(collection(db, 'notifications'), {
                  title: 'تم تفعيل الاشتراك! 🎉',
                  message: `تم قبول إثبات الدفع ديالك. الاشتراك ديالك دابا مفعل حتى لـ ${format(newEndDate, 'dd/MM/yyyy')}. شكرا على الثقة!`,
                  type: 'success',
                  read: false,
                  timestamp: Timestamp.now(),
                  targetType: 'specific',
                  targetUserId: proof.shopId
                });

                logAction('approve_payment', proof.id, 'payment', `Approved payment of ${proof.amount} for ${proof.shopName}`);
              }}
              onReject={async (proof, reason) => {
                await updateDoc(doc(db, 'payment_proofs', proof.id), {
                  status: 'rejected',
                  reviewedBy: adminUser.uid,
                  reviewedAt: Timestamp.now(),
                  rejectionReason: reason
                });

                await addDoc(collection(db, 'notifications'), {
                  title: 'تم رفض إثبات الدفع ❌',
                  message: `للأسف، تم رفض إثبات الدفع ديالك. السبب: ${reason}. عاود جرب مرة أخرى أو تواصل معنا.`,
                  type: 'warning',
                  read: false,
                  timestamp: Timestamp.now(),
                  targetType: 'specific',
                  targetUserId: proof.shopId
                });

                logAction('reject_payment', proof.id, 'payment', `Rejected payment for ${proof.shopName}. Reason: ${reason}`);
              }}
            />
          )}
          {activeTab === 'payments' && <PaymentsSection payments={payments} users={users} exportToExcel={exportToExcel} logAction={logAction} />}
          {activeTab === 'referrals' && <ReferralsSection users={users} />}
          {activeTab === 'reports' && <ReportsSection sales={allSales} products={allProducts} customers={allCustomers} />}
          {activeTab === 'notifications' && <NotificationsSection notifications={notifications} users={users} logAction={logAction} />}
          {activeTab === 'settings' && <SettingsSection adminUser={adminUser} />}
        </main>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
      <span className="font-bold">{label}</span>
      {badge ? (
        <span className="bg-rose-500 text-white text-[10px] px-2 py-1 rounded-full mr-auto font-black">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function UsersSection({ users, allCustomers, exportToExcel, exportToPDF, logAction }: { 
  users: UserProfile[], 
  allCustomers: Customer[], 
  exportToExcel: any, 
  exportToPDF: any,
  logAction: any
}) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredUsers = users.filter(u => 
    u.shopName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUserDebt = (userId: string) => {
    return allCustomers
      .filter(c => c.ownerId === userId)
      .reduce((sum, c) => sum + c.totalDebt, 0);
  };

  const handleUpdateStatus = async (userId: string, status: string) => {
    await updateDoc(doc(db, 'users', userId), { subscriptionStatus: status });
    logAction('update_subscription', userId, 'subscription', `Changed status to ${status}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button 
            onClick={() => exportToExcel(filteredUsers.map(u => ({
              'Shop Name': u.shopName,
              'Email': u.email,
              'Status': u.subscriptionStatus,
              'Referrals': u.referralCount,
              'Debt': getUserDebt(u.uid)
            })), 'users')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
          <button 
            onClick={() => exportToPDF(
              ['Shop Name', 'Email', 'Status', 'Referrals', 'Debt'],
              filteredUsers.map(u => [u.shopName || 'N/A', u.email, u.subscriptionStatus || 'N/A', u.referralCount || 0, getUserDebt(u.uid)]),
              'users'
            )}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="بحث عن مستخدم..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">المحل</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">البريد الإلكتروني</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">حالة الاشتراك</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">الدعوات</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">مجموع الديون</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map(u => (
              <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{u.shopName || 'بدون اسم'}</div>
                  <div className="text-xs text-slate-500">كود: {u.referralCode}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    u.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                  }`}>
                    {u.subscriptionStatus === 'active' ? 'مفعل' : 'منتهي'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-slate-900">{u.referralCount || 0}</td>
                <td className="px-6 py-4 text-sm font-bold text-rose-600">{getUserDebt(u.uid)} DH</td>
                <td className="px-6 py-4">
                  <select 
                    onChange={(e) => handleUpdateStatus(u.uid, e.target.value)}
                    className="text-xs bg-slate-100 border-none rounded-lg px-2 py-1 focus:ring-emerald-500"
                    value={u.subscriptionStatus}
                  >
                    <option value="active">تفعيل</option>
                    <option value="expired">توقيف</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentsSection({ payments, users, exportToExcel, logAction }: { 
  payments: Payment[], 
  users: UserProfile[], 
  exportToExcel: (data: any[], fileName: string) => void,
  logAction: (action: string, targetId: string, targetType: 'user' | 'subscription' | 'payment' | 'notification', details: string) => Promise<void> 
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPayment, setNewPayment] = useState({ userId: '', amount: 0, method: 'manual' as const });

  const handleAddPayment = async () => {
    const user = users.find(u => u.uid === newPayment.userId);
    if (!user) return;

    const paymentData = {
      ...newPayment,
      shopName: user.shopName || user.email,
      status: 'paid',
      date: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, 'payments'), paymentData);
    await updateDoc(doc(db, 'users', user.uid), { subscriptionStatus: 'active' });
    logAction('create_payment', docRef.id, 'payment', `Manual payment of ${newPayment.amount} DH`);
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <StatCard label="مجموع المداخيل" value={`${payments.reduce((sum, p) => sum + p.amount, 0)} DH`} icon={<TrendingUp />} color="emerald" />
          <StatCard label="عمليات اليوم" value={payments.filter(p => format(p.date.toDate(), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length.toString()} icon={<CreditCard />} color="blue" />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
        >
          <Plus className="w-5 h-5" /> تسجيل أداء يدوي
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">المحل</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">المبلغ</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">الطريقة</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">التاريخ</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-900">{p.shopName}</td>
                <td className="px-6 py-4 font-black text-emerald-600">{p.amount} DH</td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {p.method === 'stripe' && 'Stripe'}
                  {p.method === 'manual' && 'يدوي'}
                  {p.method === 'telecommerce' && 'Maroc Tele'}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{format(p.date.toDate(), 'dd/MM/yyyy HH:mm')}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    p.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                  }`}>
                    {p.status === 'paid' ? 'تم الدفع' : 'فشل'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-[40px] p-10 max-w-md w-full space-y-6">
            <h3 className="text-2xl font-black text-slate-900">تسجيل أداء جديد</h3>
            <div className="space-y-4 text-right">
              <div>
                <label className="text-sm font-bold text-slate-600 block mb-2">المستخدم</label>
                <select 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl"
                  onChange={e => setNewPayment({...newPayment, userId: e.target.value})}
                >
                  <option value="">اختر مستخدم...</option>
                  {users.map(u => <option key={u.uid} value={u.uid}>{u.shopName || u.email}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-600 block mb-2">المبلغ (DH)</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl"
                  onChange={e => setNewPayment({...newPayment, amount: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={handleAddPayment} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold">حفظ</button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReferralsSection({ users }: { users: UserProfile[] }) {
  const topReferrers = [...users].sort((a, b) => (b.referralCount || 0) - (a.referralCount || 0)).slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <TrendingUp className="text-emerald-500" /> المتصدرين (Leaderboard)
        </h3>
        <div className="space-y-4">
          {topReferrers.map((u, i) => (
            <div key={u.uid} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${
                  i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {i + 1}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{u.shopName || u.email}</div>
                  <div className="text-xs text-slate-500">{u.referralCode}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-emerald-600">{u.referralCount || 0}</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">دعوة</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-emerald-900 text-white p-8 rounded-[40px] shadow-xl shadow-emerald-100">
          <h3 className="text-xl font-bold mb-2">إحصائيات النظام</h3>
          <p className="text-emerald-300 text-sm mb-8">نظرة عامة على نمو الدعوات</p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-3xl font-black">{users.reduce((sum, u) => sum + (u.referralCount || 0), 0)}</div>
              <div className="text-xs text-emerald-400 uppercase font-bold mt-1">إجمالي الدعوات</div>
            </div>
            <div>
              <div className="text-3xl font-black">{users.reduce((sum, u) => sum + (u.internalCredit || 0), 0)} DH</div>
              <div className="text-xs text-emerald-400 uppercase font-bold mt-1">إجمالي المكافآت</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">أحدث الدعوات</h3>
          {/* This would ideally query the referrals collection */}
          <div className="text-center py-10 text-slate-400 italic text-sm">
            سيتم عرض تفاصيل الدعوات هنا قريباً
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsSection({ sales, products, customers }: { sales: Sale[], products: Product[], customers: Customer[] }) {
  const totalSales = sales.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
  const totalDebt = customers.reduce((sum, c) => sum + c.totalDebt, 0);
  const lowStockCount = products.filter(p => p.stock <= p.lowStockThreshold).length;

  const salesByDay = sales.reduce((acc: any, sale) => {
    const day = format(new Date(sale.createdAt), 'MM/dd');
    acc[day] = (acc[day] || 0) + sale.totalPrice;
    return acc;
  }, {});

  const chartData = Object.keys(salesByDay).map(day => ({ name: day, value: salesByDay[day] })).slice(-7);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="إجمالي المبيعات" value={`${totalSales} DH`} icon={<TrendingUp />} color="emerald" />
        <StatCard label="إجمالي الأرباح" value={`${totalProfit} DH`} icon={<BarChart3 />} color="blue" />
        <StatCard label="الديون الخارجية" value={`${totalDebt} DH`} icon={<AlertTriangle />} color="rose" />
        <StatCard label="منتجات قاربت النفاد" value={lowStockCount.toString()} icon={<Package />} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm h-[400px]">
          <h3 className="text-lg font-bold text-slate-900 mb-6">تطور المبيعات (آخر 7 أيام)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">أكثر المنتجات مبيعاً</h3>
          <div className="space-y-4">
            {products.slice(0, 5).map(p => {
              const pSales = sales.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0);
              return (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">المخزون: {p.stock}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900">{pSales}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">قطعة</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SubscriptionsSection({ proofs, users, onApprove, onReject }: { 
  proofs: PaymentProof[], 
  users: UserProfile[],
  onApprove: (proof: PaymentProof) => Promise<void>,
  onReject: (proof: PaymentProof, reason: string) => Promise<void>
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        {proofs.length === 0 ? (
          <div className="bg-white p-20 rounded-[40px] text-center space-y-4 border border-slate-100">
            <CreditCard className="w-16 h-16 text-slate-200 mx-auto" />
            <p className="text-slate-400 font-bold">ما كاين حتى طلب اشتراك دابا</p>
          </div>
        ) : (
          proofs.map(proof => (
            <div key={proof.id} className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="bg-emerald-100 p-4 rounded-3xl text-emerald-600">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{proof.shopName}</h3>
                    <p className="text-slate-500 text-sm font-bold">المبلغ: {proof.amount} درهم</p>
                    <p className="text-slate-400 text-[10px] font-bold mt-1">
                      تاريخ الطلب: {format(proof.createdAt.toDate(), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-2xl text-xs font-black uppercase ${
                  proof.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                  proof.status === 'rejected' ? 'bg-rose-100 text-rose-600' :
                  'bg-amber-100 text-amber-600'
                }`}>
                  {proof.status === 'approved' ? 'مقبول' : 
                   proof.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">إثبات الدفع</h4>
                  <div className="aspect-video bg-slate-50 rounded-3xl overflow-hidden border border-slate-100 group relative">
                    <img src={proof.imageUrl} alt="Proof" className="w-full h-full object-contain" />
                    <a 
                      href={proof.imageUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold"
                    >
                      عرض الصورة كاملة
                    </a>
                  </div>
                </div>

                {proof.status === 'pending' && (
                  <div className="flex flex-col justify-end gap-3">
                    <button 
                      onClick={() => onApprove(proof)}
                      className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      تفعيل الاشتراك
                    </button>
                    <button 
                      onClick={() => {
                        const reason = prompt('سبب الرفض؟');
                        if (reason) onReject(proof, reason);
                      }}
                      className="w-full py-4 bg-white text-rose-500 border-2 border-rose-500 rounded-2xl font-black hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-5 h-5" />
                      رفض الطلب
                    </button>
                  </div>
                )}

                {proof.status === 'rejected' && (
                  <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                    <p className="text-xs text-rose-600 font-bold">سبب الرفض: {proof.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NotificationsSection({ notifications, users, logAction }: { notifications: AppNotification[], users: UserProfile[], logAction: any }) {
  const [showModal, setShowModal] = useState(false);
  const [newNotif, setNewNotif] = useState({ title: '', message: '', targetType: 'all' as const });

  const handleSend = async () => {
    const notifData = {
      ...newNotif,
      sentBy: 'Admin',
      sentAt: Timestamp.now()
    };
    const docRef = await addDoc(collection(db, 'notifications'), notifData);
    logAction('send_notification', docRef.id, 'notification', `Sent notification: ${newNotif.title}`);
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-slate-900">سجل التنبيهات</h3>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
        >
          <Send className="w-5 h-5" /> إرسال تنبيه جديد
        </button>
      </div>

      <div className="grid gap-4">
        {notifications.map(n => (
          <div key={n.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex justify-between items-start">
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900">{n.title}</h4>
              <p className="text-sm text-slate-600">{n.message}</p>
              <div className="flex items-center gap-3 mt-4">
                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-lg text-slate-500 font-bold uppercase">
                  {n.targetType === 'all' ? 'للجميع' : 'مخصص'}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {format(n.timestamp.toDate(), 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
            </div>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-[40px] p-10 max-w-md w-full space-y-6">
            <h3 className="text-2xl font-black text-slate-900">تنبيه جديد</h3>
            <div className="space-y-4 text-right">
              <div>
                <label className="text-sm font-bold text-slate-600 block mb-2">العنوان</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl"
                  onChange={e => setNewNotif({...newNotif, title: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-600 block mb-2">الرسالة</label>
                <textarea 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-32"
                  onChange={e => setNewNotif({...newNotif, message: e.target.value})}
                ></textarea>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={handleSend} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold">إرسال دابا</button>
              <button onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsSection({ adminUser }: { adminUser: UserProfile }) {
  return (
    <div className="max-w-2xl space-y-8">
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-xl font-bold text-slate-900">إعدادات الحساب</h3>
        <div className="grid gap-4">
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
            <span className="text-slate-600 font-bold">البريد الإلكتروني</span>
            <span className="text-slate-900 font-black">{adminUser.email}</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
            <span className="text-slate-600 font-bold">الدور</span>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-xs font-bold">مدير النظام (Admin)</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-xl font-bold text-slate-900">إعدادات النظام</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900">وضع الصيانة</div>
              <div className="text-xs text-slate-500">توقيف التطبيق مؤقتاً للقيام بتحديثات</div>
            </div>
            <div className="w-12 h-6 bg-slate-200 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm"></div>
            </div>
          </div>
          <div className="h-px bg-slate-100"></div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900">التسجيل التلقائي</div>
              <div className="text-xs text-slate-500">السماح للمستخدمين الجدد بإنشاء حسابات</div>
            </div>
            <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color: 'emerald' | 'blue' | 'rose' | 'orange' }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${colors[color]}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
      </div>
      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
    </div>
  );
}

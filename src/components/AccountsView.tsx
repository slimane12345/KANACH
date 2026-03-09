import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { User } from 'firebase/auth';
import { Card, Button } from '../App';
import { Copy, Share2, Users, CreditCard, User as UserIcon, CheckCircle2, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface AccountsViewProps {
  userProfile: UserProfile | null;
  user: User;
}

export default function AccountsView({ userProfile, user }: AccountsViewProps) {
  const [copied, setCopied] = useState(false);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'referrals'), where('inviterId', '==', user.uid), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setReferredUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
        }).catch(err => console.error('Share failed', err));
      } else {
        navigator.clipboard.writeText(text);
        alert('تم نسخ الرابط');
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-6 p-4"
    >
      <h2 className="text-3xl font-black text-emerald-900">حسابي</h2>

      {/* Profile Section */}
      <Card className="flex items-center gap-4 p-6">
        <div className="bg-emerald-100 p-4 rounded-full text-emerald-600">
          <UserIcon className="w-8 h-8" />
        </div>
        <div>
          <div className="font-bold text-lg">{userProfile?.shopName || 'بدون اسم'}</div>
          <div className="text-slate-500 text-sm">{user.email}</div>
        </div>
      </Card>

      {/* Subscription Section */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <CreditCard className="text-emerald-500" />
          <h3 className="font-bold text-lg">الاشتراك</h3>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500">الحالة:</span>
          <span className="font-bold text-emerald-600">{userProfile?.subscriptionStatus === 'active' ? 'مفعل' : 'منتهي'}</span>
        </div>
        <Button className="w-full">تجديد الاشتراك</Button>
      </Card>

      {/* Referral Section */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Users className="text-emerald-500" />
          <h3 className="font-bold text-lg">دعوة الأصدقاء</h3>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center">
          <span className="font-mono font-bold text-lg">{userProfile?.referralCode || '---'}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleCopy} className="px-3">
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="primary" onClick={handleShare} className="px-3">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-slate-500">شارك الكود مع أصحابك واستافد من تخفيضات.</p>
        
        <div className="mt-4">
          <h4 className="font-bold text-sm mb-2">الأصدقاء اللي دعيتيهم:</h4>
          <div className="space-y-2">
            {referredUsers.map(user => (
              <div key={user.id} className="text-sm text-slate-600 bg-white p-2 rounded border">
                {user.inviteeEmail}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

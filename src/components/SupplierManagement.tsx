import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Supplier, Order } from '../types';
import { User } from 'firebase/auth';
import { Card, Button, Input } from '../App';
import { Plus, Package, Phone, ShoppingCart } from 'lucide-react';

export const SupplierManagement = ({ user }: { user: User }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', products: '' });

  useEffect(() => {
    const qSuppliers = query(collection(db, 'suppliers'), where('ownerId', '==', user.uid));
    const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });

    const qOrders = query(collection(db, 'orders'), where('shopId', '==', user.uid));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    return () => {
      unsubSuppliers();
      unsubOrders();
    };
  }, [user.uid]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'suppliers'), {
      name: formData.name,
      phone: formData.phone,
      products: formData.products.split(',').map(p => p.trim()),
      ownerId: user.uid
    });
    setIsAdding(false);
    setFormData({ name: '', phone: '', products: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-emerald-900">الموردين</h2>
        <Button onClick={() => setIsAdding(true)} variant="primary">
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {isAdding && (
        <Card>
          <form onSubmit={handleAddSupplier} className="space-y-4">
            <Input label="اسم المورد" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <Input label="رقم الهاتف" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            <Input label="المنتجات (مفصولة بفاصلة)" value={formData.products} onChange={e => setFormData({...formData, products: e.target.value})} />
            <Button type="submit">إضافة</Button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map(supplier => (
          <Card key={supplier.id}>
            <h3 className="text-xl font-bold">{supplier.name}</h3>
            <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> {supplier.phone}</p>
            <p className="text-sm text-gray-500">المنتجات: {supplier.products.join(', ')}</p>
          </Card>
        ))}
      </div>

      <h2 className="text-3xl font-black text-emerald-900">طلبات التوريد</h2>
      <div className="space-y-4">
        {orders.map(order => (
          <Card key={order.id}>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold">طلب بتاريخ {order.createdAt.toDate().toLocaleDateString()}</p>
                <p className="text-sm text-gray-500">الحالة: {order.status}</p>
              </div>
              <ShoppingCart className="w-6 h-6 text-emerald-600" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

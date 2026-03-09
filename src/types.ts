export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  lowStockThreshold: number;
  barcode?: string;
  supplierId?: string;
  ownerId: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  profit: number;
  ownerId: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  totalDebt: number;
  ownerId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreditTransaction {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  note?: string;
  date: string;
  status: 'unpaid' | 'paid';
  type?: 'credit' | 'payment';
  ownerId: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  shopName?: string;
  role?: string;
  referralCode?: string;
  referredBy?: string;
  referralCount?: number;
  subscriptionStatus?: 'active' | 'expired' | 'pending';
  subscriptionEndDate?: any;
  trialStartDate?: any;
  trialNotificationSent?: boolean;
  internalCredit?: number;
  createdAt?: string;
}

export interface Subscription {
  id: string;
  shopId: string;
  status: 'active' | 'expired' | 'pending';
  startDate: any;
  endDate: any;
  plan: 'monthly';
  price: number;
}

export interface PaymentProof {
  id: string;
  shopId: string;
  shopName: string;
  amount: number;
  imageUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  reviewedBy?: string;
  reviewedAt?: any;
  rejectionReason?: string;
}

export interface Referral {
  id: string;
  inviterId: string;
  inviteeId: string;
  date: string;
  rewardGiven: boolean;
}

export interface Payment {
  id: string;
  userId: string;
  shopName: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  method: 'stripe' | 'manual' | 'telecommerce';
  date: any;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetId: string;
  targetType: 'user' | 'payment' | 'subscription' | 'notification';
  details: string;
  timestamp: any;
}

export interface DailyReport {
  id: string;
  shopId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  totalSales: number;
  transactions: number;
  productsSold: number;
  creditAdded: number;
  topProduct: {
    name: string;
    quantity: number;
  };
  yesterdaySales?: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  read: boolean;
  timestamp: any;
  targetType?: 'all' | 'specific';
  targetUserId?: string;
  sentBy?: string;
}

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  address?: string;
  totalDebt: number;
  ownerId: string;
  createdAt?: string;
}

export interface SupplyOrderItem {
  productId: string;
  name: string;
  quantity: number;
  costPrice: number;
}

export interface SupplyOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  items: SupplyOrderItem[];
  totalCost: number;
  paidAmount: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  status: 'pending' | 'received';
  ownerId: string;
  createdAt: any;
}

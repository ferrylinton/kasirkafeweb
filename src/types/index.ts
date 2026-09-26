export interface IParam {
    id: string
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER';

export type VendorStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATE';

export interface Vendor {
  id: string;
  name: string;
  address?: string;
  status: VendorStatus;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorStatusRequest {
  id: string;
  vendorId: string;
  vendorName: string;
  type: 'DEACTIVATE' | 'REACTIVATE';
  reason: string;
  requestedByEmail: string;
  requestedByName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  vendorId?: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt?: string;
}

export interface VariationOption {
  id: string;
  name: string;
  extraPrice: number;
  isDefault?: boolean;
}

export interface CategoryVariation {
  id: string;
  vendorId?: string;
  name: string;
  options: VariationOption[];
  usedInCategoriesCount?: number;
  categoryNames?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  vendorId?: string;
  name: string;
  description?: string;
  categoryVariationIds?: string[];
  variationIds?: string[];
  categoryVariationId?: string;
  variations?: CategoryVariation[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  vendorId?: string;
  name: string;
  category: 'kopi' | 'teh' | 'jus' | 'cemilan' | string;
  price: number;
  stock: number;
  lowStockThreshold?: number;
  description?: string;
  tag?: string;
  image?: string;
  isAvailable?: boolean;
  temporaryUnavailableReason?: string;
  updatedAt?: string;
}

export interface ProductStock {
  id: string;
  productId: string;
  vendorId?: string;
  productName?: string;
  category?: string;
  image?: string;
  price?: number;
  stock: number;
  lowStockThreshold: number;
  isAvailable?: boolean;
  updatedAt?: string;
}

export interface InventoryLog {
  id: string;
  vendorId?: string;
  productId: string;
  productName: string;
  previousStock: number;
  newStock: number;
  change: number;
  type: 'MANUAL_RESTOCK' | 'MANUAL_ADJUSTMENT' | 'SALE_DEDUCTION' | 'THRESHOLD_UPDATE' | 'CSV_IMPORT';
  reason?: string;
  performedBy?: {
    id: string;
    name: string;
    role?: string;
  };
  createdAt: string;
}

export interface InventoryAlertSummary {
  totalProducts: number;
  healthyCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockUnits: number;
  totalStockValue: number;
  defaultThreshold: number;
  alerts: Product[];
}

export interface CartItemModifier {
  size?: 'Regular' | 'Large' | 'Jumbo' | string;
  sizeExtra?: number;
  ice?: 'Normal Ice' | 'Less Ice' | 'No Ice' | string;
  sugar?: '100% Normal' | '50% Less' | '0% No Sugar' | string;
  shot?: string;
  shotExtra?: number;
  milk?: 'Fresh Milk' | 'Oat Milk' | 'Almond Milk' | string;
  milkExtra?: number;
  toppings?: string[];
  toppingsExtra?: number;
  notes?: string;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  modifier?: CartItemModifier;
  itemTotal: number;
  image?: string;
}

export interface AppliedDiscount {
  ruleCode: string;
  ruleName: string;
  description: string;
  discountAmount: number;
  rewardItemName?: string;
}

export interface OrderDiscountItem {
  productId: string;
  name: string;
  category: string;
  originalPrice: number;
  discountedPrice: number;
  discountAmount: number;
  ruleCode: string;
  ruleName: string;
  image?: string;
  source?: 'CART_ITEM' | 'CATALOG_ITEM';
  originalCartItemId?: string;
}

export interface EligibleDiscount {
  id?: string;
  code: string;
  name: string;
  description: string;
  type: 'QUANTITY_THRESHOLD' | 'MIN_SPEND' | 'BIRTHDAY' | 'CUSTOM';
  threshold?: number;
  rewardType: 'FREE_SNACK' | 'FREE_DRINK_OR_SNACK' | 'PERCENTAGE' | 'FIXED_AMOUNT';
  rewardValue?: number;
  isEligible: boolean;
  missingRequirement?: string;
  eligibleCategories?: string[];
}

export interface OrderCustomer {
  name?: string;
  email?: string;
  phone?: string;
}

export interface Order {
  id: string;
  vendorId?: string;
  orderNumber: string;
  queueNumber?: number;
  items: {
    productId: string;
    name: string;
    category: string;
    price: number;
    quantity: number;
    size?: string;
    ice?: string;
    sugar?: string;
    milk?: string;
    toppings?: string[];
    notes?: string;
    itemTotal: number;
  }[];
  discountItem?: OrderDiscountItem;
  selectedDiscountCode?: string;
  subtotal: number;
  discountAmount: number;
  appliedDiscounts?: AppliedDiscount[];
  freeItemsSummary?: string[];
  pb1Tax: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'QRIS' | 'EDC' | 'TRANSFER';
  cashReceived: number;
  change: number;
  customer?: OrderCustomer;
  cashier?: {
    id: string;
    name: string;
  };
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
  emailStatus: 'none' | 'pending' | 'success' | 'failed';
  createdAt: string;
  updatedAt?: string;
  isAdjusted?: boolean;
  originalTotalAmount?: number;
  paymentAdjustment?: {
    type: 'ADDITIONAL_PAYMENT' | 'REFUND' | 'NO_CHANGE';
    differenceAmount: number; // absolute difference
    netDifference: number; // positive = customer pays more, negative = refund to customer
    settledMethod?: 'CASH' | 'QRIS' | 'EDC' | 'TRANSFER';
    reason?: string;
    adjustedAt: string;
    adjustedBy?: string;
  };
  cancellation?: {
    reason: string;
    refundAmount: number;
    refundMethod: 'CASH' | 'QRIS' | 'EDC' | 'TRANSFER';
    cancelledAt: string;
    cancelledBy: string;
  };
}

export interface SavedOrder {
  id: string;
  vendorId?: string;
  draftNumber: string;
  tableNameOrNote?: string;
  items: CartItem[];
  discountItem?: OrderDiscountItem | null;
  selectedDiscountCode?: string | null;
  subtotal: number;
  discountAmount: number;
  pb1Tax: number;
  totalAmount: number;
  totalItemsCount: number;
  customer?: OrderCustomer;
  cashier?: {
    id: string;
    name: string;
  };
  status: 'HOLD';
  createdAt: string;
  updatedAt?: string;
}

export interface DiscountRule {
  id?: string;
  code: string;
  name: string;
  description: string;
  type: 'QUANTITY_THRESHOLD' | 'MIN_SPEND' | 'BIRTHDAY' | 'CUSTOM';
  threshold?: number;
  rewardType: 'FREE_SNACK' | 'FREE_DRINK_OR_SNACK' | 'PERCENTAGE' | 'FIXED_AMOUNT';
  rewardValue?: number;
  isActive: boolean;
}

export interface EmailTemplate {
  id: string;
  code: string;
  name: string;
  description?: string;
  subject: string;
  bodyHtml: string;
  isActive: boolean;
}

export interface ThemeAccent {
  id: string;
  name: string;
  hex: string;
  rgb: string;
}

export type Language = 'en' | 'id';

export interface LoginHistoryEntry {
  id: string;
  vendorId?: string;
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  loginMethod: 'PASSWORD';
  ipAddress: string;
  userAgent?: string;
  device?: string;
  status: 'ACTIVE' | 'LOGGED_OUT' | 'REVOKED' | 'TIMED_OUT';
  timestamp: string;
  revokedAt?: string;
  revokeReason?: string;
}

export type ActivityAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type ActivityEntity =
  | 'PRODUCT'
  | 'INVENTORY'
  | 'DISCOUNT_RULE'
  | 'USER'
  | 'ORDER'
  | 'EMAIL_TEMPLATE'
  | 'CATEGORY'
  | 'VENDOR';

export interface ActivityLogEntry {
  id: string;
  vendorId?: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string;
  entityName?: string;
  summary: string;
  details?: Record<string, any>;
  performedBy: {
    id: string;
    name: string;
    email?: string;
    role: string;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ActivityLogStats {
  totalLogs: number;
  createCount: number;
  updateCount: number;
  deleteCount: number;
  todayCount: number;
  entityBreakdown: Record<string, number>;
}


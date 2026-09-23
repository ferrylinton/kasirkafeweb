import { Language } from '../types';

export function getCategoryLabel(categoryCode: string, lang: Language): string {
  const code = (categoryCode || '').toLowerCase();
  if (lang === 'en') {
    switch (code) {
      case 'kopi': return 'Coffee';
      case 'teh': return 'Tea';
      case 'jus': return 'Juice & Fruits';
      case 'cemilan': return 'Snack & Pastry';
      case 'all':
      case 'semua': return 'All';
      default: return categoryCode;
    }
  } else {
    switch (code) {
      case 'kopi': return 'Kopi';
      case 'teh': return 'Teh';
      case 'jus': return 'Jus & Buah';
      case 'cemilan': return 'Cemilan & Pastry';
      case 'all':
      case 'semua': return 'Semua';
      default: return categoryCode;
    }
  }
}

export function getPaymentMethodLabel(method: string, lang: Language): string {
  if (lang === 'en') {
    switch (method) {
      case 'CASH': return 'Cash';
      case 'QRIS': return 'QRIS Instant';
      case 'EDC': return 'EDC Card';
      case 'TRANSFER': return 'Bank Transfer';
      default: return method;
    }
  } else {
    switch (method) {
      case 'CASH': return 'Uang Tunai';
      case 'QRIS': return 'QRIS Instant';
      case 'EDC': return 'Kartu EDC';
      case 'TRANSFER': return 'Transfer Bank';
      default: return method;
    }
  }
}

export function getOrderStatusLabel(status: string, lang: Language): string {
  if (lang === 'en') {
    switch (status) {
      case 'COMPLETED': return 'Completed';
      case 'PENDING': return 'Pending';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  } else {
    switch (status) {
      case 'COMPLETED': return 'Selesai';
      case 'PENDING': return 'Menunggu';
      case 'CANCELLED': return 'Dibatalkan';
      default: return status;
    }
  }
}

export function getSessionStatusLabel(status: string, lang: Language): string {
  if (lang === 'en') {
    switch (status) {
      case 'ACTIVE': return 'Active';
      case 'LOGGED_OUT': return 'Logged Out';
      case 'REVOKED': return 'Revoked';
      default: return status;
    }
  } else {
    switch (status) {
      case 'ACTIVE': return 'Aktif';
      case 'LOGGED_OUT': return 'Selesai';
      case 'REVOKED': return 'Dicabut';
      default: return status;
    }
  }
}

export function getLoginMethodLabel(method: string, lang: Language): string {
  return 'Email & Password';
}

export function getRoleLabel(role: string, lang: Language): string {
  if (lang === 'en') {
    return role === 'MANAGER' ? 'Manager' : 'Cashier';
  } else {
    return role === 'MANAGER' ? 'Manajer' : 'Kasir';
  }
}

export function getStockStatusLabel(status: 'HEALTHY' | 'LOW' | 'OUT_OF_STOCK', lang: Language): string {
  if (lang === 'en') {
    switch (status) {
      case 'HEALTHY': return 'Safe';
      case 'LOW': return 'Low Stock';
      case 'OUT_OF_STOCK': return 'Out of Stock';
    }
  } else {
    switch (status) {
      case 'HEALTHY': return 'Aman';
      case 'LOW': return 'Menipis';
      case 'OUT_OF_STOCK': return 'Habis';
    }
  }
}

export function getDiscountTypeLabel(type: string, lang: Language): string {
  if (lang === 'en') {
    switch (type) {
      case 'QUANTITY_THRESHOLD': return 'Quantity Threshold (Buy X items)';
      case 'MIN_SPEND': return 'Minimum Spend Amount';
      case 'BIRTHDAY': return 'Birthday Promo';
      case 'CUSTOM': return 'Custom Promotion';
      default: return type;
    }
  } else {
    switch (type) {
      case 'QUANTITY_THRESHOLD': return 'Ambang Jumlah Item (Beli X)';
      case 'MIN_SPEND': return 'Minimal Total Belanja';
      case 'BIRTHDAY': return 'Promo Ulang Tahun';
      case 'CUSTOM': return 'Promo Kustom';
      default: return type;
    }
  }
}

export function getRewardTypeLabel(rewardType: string, lang: Language): string {
  if (lang === 'en') {
    switch (rewardType) {
      case 'FREE_SNACK': return 'Free 1 Snack';
      case 'FREE_DRINK_OR_SNACK': return 'Free 1 Drink or Snack';
      case 'PERCENTAGE': return 'Percentage Discount (%)';
      case 'FIXED_AMOUNT': return 'Fixed Amount Discount (Rp)';
      default: return rewardType;
    }
  } else {
    switch (rewardType) {
      case 'FREE_SNACK': return 'Gratis 1 Cemilan';
      case 'FREE_DRINK_OR_SNACK': return 'Gratis 1 Minuman / Cemilan';
      case 'PERCENTAGE': return 'Diskon Persentase (%)';
      case 'FIXED_AMOUNT': return 'Potongan Harga Tetap (Rp)';
      default: return rewardType;
    }
  }
}

export function getModifierSizeLabel(size: string, lang: Language): string {
  if (lang === 'en') {
    switch (size) {
      case 'Regular': return 'Regular (350ml)';
      case 'Large': return 'Large (500ml)';
      case 'Jumbo': return 'Jumbo (700ml)';
      default: return size;
    }
  } else {
    switch (size) {
      case 'Regular': return 'Regular (350ml)';
      case 'Large': return 'Large (500ml)';
      case 'Jumbo': return 'Jumbo (700ml)';
      default: return size;
    }
  }
}

export function getModifierIceLabel(ice: string, lang: Language): string {
  if (lang === 'en') {
    switch (ice) {
      case 'Normal Ice': return 'Normal Ice (Standard)';
      case 'Less Ice': return 'Less Ice';
      case 'No Ice': return 'No Ice';
      default: return ice;
    }
  } else {
    switch (ice) {
      case 'Normal Ice': return 'Normal Ice (Standar)';
      case 'Less Ice': return 'Less Ice (Sedikit)';
      case 'No Ice': return 'No Ice (Tanpa Es)';
      default: return ice;
    }
  }
}

export function getModifierSugarLabel(sugar: string, lang: Language): string {
  if (lang === 'en') {
    switch (sugar) {
      case '100% Normal': return '100% Normal Sugar';
      case '50% Less': return '50% Less Sugar';
      case '0% No Sugar': return '0% No Sugar';
      default: return sugar;
    }
  } else {
    switch (sugar) {
      case '100% Normal': return '100% Normal';
      case '50% Less': return '50% Sedikit Gula';
      case '0% No Sugar': return '0% Tanpa Gula';
      default: return sugar;
    }
  }
}

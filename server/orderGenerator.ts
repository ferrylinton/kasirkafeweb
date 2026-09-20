/**
 * Generator for authentic historical and live transaction data across vendors
 * Provides continuous realistic datasets across:
 * - Per Hari (Daily - past 30 days including today 2026-09-20)
 * - Per Minggu (Weekly - 12 weeks of 2026)
 * - Per Bulan (Monthly - Jan 2025 through Sep 2026)
 * - Per Tahun (Yearly - 2024, 2025, 2026)
 */

export interface GeneratedOrder {
  id: string;
  vendorId: string;
  orderNumber: string;
  queueNumber: number;
  items: Array<{
    productId: string;
    name: string;
    category: string;
    price: number;
    quantity: number;
    itemTotal: number;
  }>;
  subtotal: number;
  discountAmount: number;
  appliedDiscounts: any[];
  pb1Tax: number;
  totalAmount: number;
  total: number;
  paymentMethod: 'QRIS' | 'CASH' | 'EDC' | 'TRANSFER';
  cashReceived: number;
  change: number;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  cashier: {
    id: string;
    name: string;
    role: string;
  };
  status: 'COMPLETED';
  emailStatus: 'none' | 'success';
  createdAt: Date;
}

const VENDOR_CATALOG = {
  vnd_sipspot_central: {
    code: 'SIP',
    name: 'SipSpot Central',
    cashiers: [
      { id: 'user_2', name: 'Sarah Barista', role: 'CASHIER' },
      { id: 'user_1', name: 'Ferry Manager', role: 'MANAGER' }
    ],
    items: [
      { id: 'prod_1', name: 'Espresso Latte', category: 'Kopi', price: 28000, popularityWeight: 10 },
      { id: 'prod_2', name: 'Caramel Macchiato Latte', category: 'Kopi', price: 29000, popularityWeight: 9 },
      { id: 'prod_3', name: 'Aren Cold Brew', category: 'Kopi', price: 26000, popularityWeight: 8 },
      { id: 'prod_4', name: 'Brown Sugar Boba Milk', category: 'Boba', price: 28000, popularityWeight: 8 },
      { id: 'prod_5', name: 'Matcha Green Tea Latte', category: 'Teh', price: 30000, popularityWeight: 7 },
      { id: 'prod_6', name: 'Dragonfruit Berry Juice', category: 'Jus', price: 35000, popularityWeight: 6 },
      { id: 'prod_7', name: 'Tropical Mango Breeze', category: 'Jus', price: 32000, popularityWeight: 6 },
      { id: 'prod_8', name: 'Croissant Butter Artisan', category: 'Cemilan', price: 22000, popularityWeight: 5 },
      { id: 'prod_9', name: 'Singkong Keju Merekah', category: 'Cemilan', price: 18000, popularityWeight: 5 },
      { id: 'prod_10', name: 'Earl Grey Milk Tea', category: 'Teh', price: 25000, popularityWeight: 4 },
      { id: 'prod_11', name: 'Red Velvet Pastry', category: 'Cemilan', price: 26000, popularityWeight: 4 },
      { id: 'prod_12', name: 'Jasmine Green Tea', category: 'Teh', price: 22000, popularityWeight: 3 }
    ]
  },
  vnd_kopi_kulo_kemang: {
    code: 'KLO',
    name: 'Kopi Kulo (Kemang)',
    cashiers: [
      { id: 'user_kulo_2', name: 'Budi Barista Kulo', role: 'CASHIER' },
      { id: 'user_kulo_1', name: 'Rian Manager Kulo', role: 'MANAGER' }
    ],
    items: [
      { id: 'kulo_prod_1', name: 'Es Kopi Kulo (Signature)', category: 'Kopi', price: 24000, popularityWeight: 10 },
      { id: 'kulo_prod_2', name: 'Kulo Avocatto Chocolate', category: 'Kopi', price: 32000, popularityWeight: 9 },
      { id: 'kulo_prod_3', name: 'Kopi Kulo Gula Aren', category: 'Kopi', price: 24000, popularityWeight: 9 },
      { id: 'kulo_prod_4', name: 'Kulo Baileys Cream Latte', category: 'Kopi', price: 30000, popularityWeight: 8 },
      { id: 'kulo_prod_5', name: 'Toast Keju Melted Spesial', category: 'Cemilan', price: 26000, popularityWeight: 7 },
      { id: 'kulo_prod_6', name: 'Croffle Gula Palem Karamel', category: 'Cemilan', price: 28000, popularityWeight: 7 },
      { id: 'kulo_prod_7', name: 'Cookies & Cream Frappe', category: 'Spesial', price: 29000, popularityWeight: 6 },
      { id: 'kulo_prod_8', name: 'Es Matcha Latte Kulo', category: 'Teh', price: 27000, popularityWeight: 5 },
      { id: 'kulo_prod_9', name: 'Choco Hazelnut Shake', category: 'Spesial', price: 28000, popularityWeight: 5 },
      { id: 'kulo_prod_10', name: 'Kulo Roti Bakar Cokelat', category: 'Cemilan', price: 23000, popularityWeight: 4 },
      { id: 'kulo_prod_11', name: 'Kulo Earl Grey Tea', category: 'Teh', price: 22000, popularityWeight: 4 },
      { id: 'kulo_prod_12', name: 'Kulo Lemon Squash', category: 'Spesial', price: 25000, popularityWeight: 3 }
    ]
  },
  vnd_tehpoci_nusantara: {
    code: 'POC',
    name: 'Teh Poci Nusantara',
    cashiers: [
      { id: 'user_poci_2', name: 'Agus Kasir Poci', role: 'CASHIER' },
      { id: 'user_poci_1', name: 'Dewi Manager Poci', role: 'MANAGER' }
    ],
    items: [
      { id: 'poci_prod_1', name: 'Es Teh Melati Jumbo Segar', category: 'Teh', price: 10000, popularityWeight: 10 },
      { id: 'poci_prod_2', name: 'Teh Poci Seduh Gula Batu Asli', category: 'Teh', price: 15000, popularityWeight: 9 },
      { id: 'poci_prod_3', name: 'Dimsum Hakau Udang Kukus (4 Pcs)', category: 'Cemilan', price: 25000, popularityWeight: 8 },
      { id: 'poci_prod_4', name: 'Siomay Dimsum Ayam Udang (4 Pcs)', category: 'Cemilan', price: 22000, popularityWeight: 8 },
      { id: 'poci_prod_5', name: 'Teh Poci Lemon Tea', category: 'Teh', price: 15000, popularityWeight: 7 },
      { id: 'poci_prod_6', name: 'Teh Poci Susu Jahe Wangi', category: 'Teh', price: 18000, popularityWeight: 6 },
      { id: 'poci_prod_7', name: 'Lumpia Kulit Tahu Goreng', category: 'Cemilan', price: 23000, popularityWeight: 6 },
      { id: 'poci_prod_8', name: 'Bakpao Mini Cokelat Lumer', category: 'Cemilan', price: 18000, popularityWeight: 5 },
      { id: 'poci_prod_9', name: 'Pangsit Udang Mayonaise', category: 'Cemilan', price: 24000, popularityWeight: 5 },
      { id: 'poci_prod_10', name: 'Teh Poci Apple Mint', category: 'Teh', price: 16000, popularityWeight: 4 },
      { id: 'poci_prod_11', name: 'Siomay Nori Keju Kukus', category: 'Cemilan', price: 24000, popularityWeight: 4 },
      { id: 'poci_prod_12', name: 'Teh Poci Tarik Hangat', category: 'Teh', price: 17000, popularityWeight: 3 }
    ]
  }
};

const CUSTOMERS = [
  { name: 'Andi Pratama', email: 'andi.pratama@gmail.com', phone: '08123456001' },
  { name: 'Citra Kirana', email: 'citra.k@yahoo.com', phone: '08123456002' },
  { name: 'Dimas Setiawan', email: 'dimas.setiawan@gmail.com', phone: '08123456003' },
  { name: 'Eka Nurhaliza', email: 'eka.nur@outlook.com', phone: '08123456004' },
  { name: 'Fajar Nugraha', email: 'fajar.nug@gmail.com', phone: '08123456005' },
  { name: 'Gita Savitri', email: 'gita.savitri@gmail.com', phone: '08123456006' },
  { name: 'Hendra Gunawan', email: 'hendra.g@gmail.com', phone: '08123456007' },
  { name: 'Indah Permata', email: 'indah.permata@yahoo.co.id', phone: '08123456008' },
  { name: 'Joko Widodo', email: 'joko.w@sipspot.com', phone: '08123456009' },
  { name: 'Kevin Sanjaya', email: 'kevin.s@gmail.com', phone: '08123456010' },
  { name: 'Lia Anggraini', email: 'lia.ang@gmail.com', phone: '08123456011' },
  { name: 'Mega Utami', email: 'mega.utami@gmail.com', phone: '08123456012' },
  { name: 'Pelanggan Walk-In', email: '', phone: '' },
  { name: 'Tamu Kasir', email: '', phone: '' }
];

const PAYMENT_METHODS: Array<'QRIS' | 'CASH' | 'EDC' | 'TRANSFER'> = [
  'QRIS',
  'QRIS',
  'QRIS',
  'CASH',
  'CASH',
  'EDC',
  'TRANSFER'
];

let orderCounter = 1000;

function createOrderAt(vendorId: keyof typeof VENDOR_CATALOG, date: Date, seq: number): GeneratedOrder {
  orderCounter++;
  const vendor = VENDOR_CATALOG[vendorId];
  const cashier = vendor.cashiers[seq % vendor.cashiers.length];
  const customer = CUSTOMERS[(orderCounter + seq) % CUSTOMERS.length];
  const paymentMethod = PAYMENT_METHODS[(orderCounter + seq) % PAYMENT_METHODS.length];

  // Pick 1 to 4 items with realistic weighted frequency
  const numItems = ((orderCounter + seq) % 3) + 1;
  const items: GeneratedOrder['items'] = [];
  let subtotal = 0;
  const usedIndices = new Set<number>();

  for (let i = 0; i < numItems; i++) {
    // Weighted selection: higher popularity items appear more frequently
    const roll = (orderCounter * 7 + seq * 13 + i * 19) % 100;
    let selectedIdx = 0;
    if (roll < 22) selectedIdx = 0; // #1
    else if (roll < 40) selectedIdx = 1; // #2
    else if (roll < 55) selectedIdx = 2; // #3
    else if (roll < 67) selectedIdx = 3; // #4
    else if (roll < 76) selectedIdx = 4; // #5
    else if (roll < 83) selectedIdx = 5; // #6
    else if (roll < 89) selectedIdx = 6; // #7
    else if (roll < 94) selectedIdx = 7; // #8
    else if (roll < 97) selectedIdx = 8; // #9
    else selectedIdx = (i + seq) % vendor.items.length; // #10-#12

    // Avoid duplicate in same order
    if (usedIndices.has(selectedIdx)) {
      selectedIdx = (selectedIdx + 1) % vendor.items.length;
    }
    usedIndices.add(selectedIdx);

    const itemRef = vendor.items[selectedIdx];
    const qty = (i === 0 && ((orderCounter + seq) % 5 === 0)) ? 2 : 1;
    const itemTotal = itemRef.price * qty;
    subtotal += itemTotal;
    items.push({
      productId: itemRef.id,
      name: itemRef.name,
      category: itemRef.category,
      price: itemRef.price,
      quantity: qty,
      itemTotal
    });
  }

  // 15% discount for some orders
  const hasDiscount = orderCounter % 4 === 0;
  const discountAmount = hasDiscount ? Math.round(subtotal * 0.1) : 0;
  const taxable = subtotal - discountAmount;
  const pb1Tax = Math.round(taxable * 0.1);
  const totalAmount = taxable + pb1Tax;

  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const orderNumber = `${vendor.code}-${yyyymmdd}-${String(seq).padStart(3, '0')}`;

  const cashReceived = paymentMethod === 'CASH' ? Math.ceil(totalAmount / 10000) * 10000 : totalAmount;
  const change = paymentMethod === 'CASH' ? cashReceived - totalAmount : 0;

  return {
    id: `ord_${orderCounter}_${vendor.code.toLowerCase()}`,
    vendorId,
    orderNumber,
    queueNumber: seq,
    items,
    subtotal,
    discountAmount,
    appliedDiscounts: hasDiscount
      ? [
          {
            code: 'MEMBER_10',
            name: 'Diskon Spesial 10%',
            type: 'PERCENTAGE',
            value: 10,
            amount: discountAmount
          }
        ]
      : [],
    pb1Tax,
    totalAmount,
    total: totalAmount,
    paymentMethod,
    cashReceived,
    change,
    customer,
    cashier,
    status: 'COMPLETED',
    emailStatus: customer.email ? 'success' : 'none',
    createdAt: date
  };
}

export function generateHistoricalOrders(): GeneratedOrder[] {
  const orders: GeneratedOrder[] = [];
  const vendors: Array<keyof typeof VENDOR_CATALOG> = [
    'vnd_sipspot_central',
    'vnd_kopi_kulo_kemang',
    'vnd_tehpoci_nusantara'
  ];

  // Base date is 2026-09-20 (local environment timestamp)
  const now = new Date('2026-09-20T14:30:00.000Z');

  // 1. YEAR 2024: ~36 orders (spread over 12 months in 2024)
  for (let m = 0; m < 12; m++) {
    for (let vIdx = 0; vIdx < vendors.length; vIdx++) {
      const v = vendors[vIdx];
      const d = new Date(2024, m, 10 + (vIdx * 5), 11 + vIdx, 20);
      orders.push(createOrderAt(v, d, (m * 3) + vIdx + 1));
    }
  }

  // 2. YEAR 2025: ~72 orders (spread over 12 months in 2025)
  for (let m = 0; m < 12; m++) {
    for (let vIdx = 0; vIdx < vendors.length; vIdx++) {
      const v = vendors[vIdx];
      // 2 orders per vendor per month
      orders.push(createOrderAt(v, new Date(2025, m, 7 + vIdx, 10, 15), (m * 6) + vIdx * 2 + 1));
      orders.push(createOrderAt(v, new Date(2025, m, 21 + vIdx, 15, 45), (m * 6) + vIdx * 2 + 2));
    }
  }

  // 3. YEAR 2026 Months Jan - Aug: ~48 orders
  for (let m = 0; m < 8; m++) {
    for (let vIdx = 0; vIdx < vendors.length; vIdx++) {
      const v = vendors[vIdx];
      orders.push(createOrderAt(v, new Date(2026, m, 5 + vIdx, 9, 30), (m * 6) + vIdx * 2 + 1));
      orders.push(createOrderAt(v, new Date(2026, m, 18 + vIdx, 14, 0), (m * 6) + vIdx * 2 + 2));
    }
  }

  // 4. YEAR 2026 Past 30 Days (from Aug 21 to Sep 20, 2026): rich daily orders!
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const targetDate = new Date(now.getTime() - daysAgo * 86400000);
    const dayOfMonth = targetDate.getDate();

    vendors.forEach((v, vIdx) => {
      // 1-3 orders per vendor each day
      const ordersToday = (dayOfMonth + vIdx) % 3 + 1;
      for (let o = 1; o <= ordersToday; o++) {
        const orderTime = new Date(targetDate);
        orderTime.setHours(8 + (o * 3) + vIdx, (o * 17) % 60, 0, 0);
        orders.push(createOrderAt(v, orderTime, o));
      }
    });
  }

  // Sort orders descending by createdAt
  return orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

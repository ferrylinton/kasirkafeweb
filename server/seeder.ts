import { getDB, fallbackStore } from './db';
import { hashPassword } from './auth';
import { DEFAULT_RULES } from './discounts';

export async function seedDatabase() {
  console.log('[Seeder] Starting automated database seeding...');

  const managerPassword = await hashPassword('Password123!');
  const cashierPassword = await hashPassword('Password123!');

  const initialUsers = [
    {
      email: 'manager@beverage.com',
      password: managerPassword,
      name: 'Ferry Manager',
      role: 'MANAGER',
      pin: '123456',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'cashier@beverage.com',
      password: cashierPassword,
      name: 'Sarah Barista',
      role: 'CASHIER',
      pin: '849201',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAAjgCQE0xuFbycGsf6WrsOWezNIYgI_Mgqgra6If5l-kM6PFqvc7XWy5YiF5Nz7EygG4k0H2Mtwi3YvU3QNeoo32v6smnPch82-FkkCAsKzcGQi4I6AHfwmT_EX6gLASiAhpg3Id6wKlIGsRatzjG67KlS-ijqvdQ7j0udvFAvMNaF2qsoHvAhSZgovySmbs3wEEzo0f3ygY8yk_4gbXMWCCpyHK8UOowRpDf-Wf_uDLVXJMCXtWJ8Hw',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const initialCategories = [
    { code: 'kopi', name: 'Kopi', icon: '☕', description: 'Espresso, Latte, Cold Brew pilihan biji Arabika' },
    { code: 'teh', name: 'Teh', icon: '🍵', description: 'Artisan Matcha, Jasmine, Earl Grey wangi menenangkan' },
    { code: 'jus', name: 'Jus', icon: '🍹', description: '100% Buah segar cold-pressed alami tanpa pemanis buatan' },
    { code: 'cemilan', name: 'Cemilan', icon: '🥐', description: 'Pastry renyah, kue lezat, dan finger food pendamping' }
  ];

  const initialProducts = [
    {
      name: 'Espresso Latte',
      category: 'kopi',
      price: 28000,
      stock: 28,
      description: 'Arabika Gayo, Fresh Milk',
      subCategory: 'Kopi Segar',
      tag: 'Best Seller',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtNMfSOkPEgLdVc2vKwY45wCgzwwn4srarfAclzt4f_z1t2GCXiXjKzKyLTw4Qb8HF_DbCT7aVAnSQEmWwHcfzRoFT7jXlEGDi9-Syypy9Jfw4AYn5_pfnyO7wbmT7XnhAnvqvJK8cZzK5Vv7IGXNv6tuat4pduj-j3JDy_TgWxA1oG-n8JqvJJGHe8FFYHRmRoIuEyWYwXNfISAcW7eYXrJwGpLW2jC44VdVHli4si8Q_iL9P2f3tLg',
      isAvailable: true
    },
    {
      name: 'Aren Cold Brew',
      category: 'kopi',
      price: 26000,
      stock: 19,
      description: 'Steep 16 Jam, Gula Aren Murni',
      subCategory: 'Kopi Segar',
      tag: 'Favorit Barista',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCvJdh749nH1gR2JunVywYMQZwKd2m2nffiuj2Mvs2KMwqC9BBJ49yOGr_9_JunjgM9BxcD5KR_nAPO1VF42jGfY5qhEuGwJ-gqaQi1vwD8pJlZvZIq9eBfOaUmi26UhKFA9phssHpmNM6n-B0JgNOtDATqeCk3I9xvzv0PVXhp0xgpiC68lFuRhz08JtMKVwm0mgVxahNDoLqkP0RVYozDd8OtNWaJeeeAdnrDckAcMSSOjFMVUACykA',
      isAvailable: true
    },
    {
      name: 'Caramel Macchiato Latte',
      category: 'kopi',
      price: 29000,
      stock: 20,
      description: 'Double espresso shot, madagascar vanilla, salted caramel drizzles',
      subCategory: 'Signature Espresso',
      tag: 'Best Seller',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA3nRgdjGnqjynsqzx5F2To8GoeiFzh-DW-eLq11HogGzQtZ2WKL6j2VrNlG8FGeztHN07Lunlrzb0tVO3hD2Wa0Ogc2n15NQmlOwBrUWdFGOYvR28xkISb08HbMXkYYMqiKH5Q3KwV0GSodGTQpdTzimlb7_J9qpWyHVf9hm14yI6zgyOiC5lKUWtOFSq78X7baLmSyw-13RQBCqVHMeIFTgwfI84p6knVpLuhkLG1tGIzn5dHiJHauw',
      isAvailable: true
    },
    {
      name: 'Matcha Jasmine Tea',
      category: 'teh',
      price: 30000,
      stock: 34,
      description: 'Wangi Melati, Pure Matcha Uji Asli',
      subCategory: 'Artisan Tea',
      tag: 'Matcha Uji',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyUf2Pv_hsauF8bNxe7DbZfgv8KjnRNMji6pTuhzjaaKuZQJJ8goHYZ1vwnWe7W0qb2PfiNWEpMbADXDOn6FkTmlVOnf5ijPtDH3tUl_MDNWySfMhcrwvDjWK7Qvd9ZEQ4w6OeerwlFMEvmpe9Am8t57ie6yPyFRckYlRx7Av9IjDKBIxYkpjqLzqSOIcehmbGogUhaf9E0XGBlkrOsAGpD0GbzX18XoH4v5gDtjW-5U4ZrUfu8mciBw',
      isAvailable: true
    },
    {
      name: 'Earl Grey Milk Tea',
      category: 'teh',
      price: 25000,
      stock: 15,
      description: 'Bergamot Note, Fresh Cream, Boba Lembut',
      subCategory: 'Artisan Tea',
      tag: 'Populer',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDRLFgKetXqgXN7L2j8MWsu9Q1Eb9yHwzyH6-ASIfUwawAa9Enj3XMOj3yT86b_LEmCuXDTFvluCM0F10enTo2U0OLeQqJdWeFTImS0m-nw__5a8Kmthg-b5xhuPnnPAVecNG8akkmHvu1HieuycWai8C2Zowe1OYFo5Xgu3Riec6vW3kaRaS_yvZxwYE4x3PGxUXGKVuLk3FdzMBRvjKWTPYXCwhbmsDJE-tXXL4nh8a9666-msWD1JA',
      isAvailable: true
    },
    {
      name: 'Jasmine Green Tea',
      category: 'teh',
      price: 22000,
      stock: 25,
      description: 'Daun teh hijau melati dingin segar aroma alami',
      subCategory: 'Artisan Tea',
      tag: 'Segar Alami',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEDdNAgqpFDYomBUwebjH1cUlD6u-s6RdfV_B3Zb2sErpLrfWBAlI-B4p9ghPK0MgP7u-BExqyPi0O6Fy5nc1a9JyE3lDkxO1GyavPWK6Rmk67W9jItT13snorCP72I1AEUd4jAYXNMKn2Lz44DGZ6HM9_iOY7NSczXkEJzmmMyq-3b2vxTM-puw_0iCpUshE4u_GwKW-TTggh5T670zI2UA3bRKmSkfrEPZWMX1SqFzQj0F5diM9zYQ',
      isAvailable: true
    },
    {
      name: 'Tropical Mango',
      category: 'jus',
      price: 32000,
      stock: 22,
      description: 'Mangga Harum Manis, Nata de Coco, Chia Seed',
      subCategory: 'Cold-Pressed',
      tag: '100% Buah Asli',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA214agMyoRUOTHtl6f0KAbXn_zJMECP7woU_OtmC93inU5O1qM5MclDciInpj44f0qLM8WWK1B2JHsIvFLMvLRjvrAKYlmGsw_pe959wyisWjhJbgzB4-lo35bufA_rJi8FENB_IGS5fQ8aOVuYFjCzaoBdfq9NsX0if5hyAJbwywBpXL1xb3bVw7al16zdBhF8c5Gc6KxnOlBV2-7YkAuapgkybmUh9vVVzOKUx8chHfxhEiTOpYh0A',
      isAvailable: true
    },
    {
      name: 'Dragonfruit Berry',
      category: 'jus',
      price: 35000,
      stock: 11,
      description: 'Buah Naga Merah, Strawberry Segar, Sparkling Soda',
      subCategory: 'Cold-Pressed',
      tag: 'Segar & Asam',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOVXfWtFg9LCiGW5J0ud5qjQ0jGXJMeAczCs-pbDuX3RAR6hCtNrdxaMfeEUbGqkxEsXZa2mL9kEU1UBgCQ71XrzS1oVfn0Bk9BEYOItPZZ1otsDaOWYZdTqYnbo89dHJwf8WiOMUqDDcupTXFTxIc1Vl86Ei2gMwcKXBPtYrHTGShQCjjcVeYI_4OWcFWVAr5Rx8duqgdwCpRbMOvKIpAO6bKkiQBPFI5C_XOTBE9wab0Nj86w21Y9Q',
      isAvailable: true
    },
    {
      name: 'Mango Berry Breeze',
      category: 'jus',
      price: 28000,
      stock: 18,
      description: 'Perpaduan puree mangga dan beri tropis segar',
      subCategory: 'Cold-Pressed',
      tag: 'Segar Favorit',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsJDrQVcuTN15ytH6JXl2Sy1VxvsGMvJXf-uUvj-Cb8PrNhnnWViYvbqt5iYdo5tOkmdoUOoAGQyzqygOJaIomUHbcGWh68FXlZAm7maoXw8duNaOEuU40MckVywC0bynGatT1MLvbjyce6fsgcqhT0XmnqgVCRgC3XFamT00-1Y5E2HMq6ccb5Rn4pZFXHPpPQ2D-tpTrlrRWvLghCVS3qLc3PjAKjk2kh_Vli28UF9GS_LwWvg61Zw',
      isAvailable: true
    },
    {
      name: 'Croissant Butter Gold',
      category: 'cemilan',
      price: 22000,
      stock: 15,
      description: 'Pastry Prancis lapis butter renyah dan gurih wangi',
      subCategory: 'Bakery',
      tag: 'Fresh Baked',
      image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&auto=format&fit=crop&q=80',
      isAvailable: true
    },
    {
      name: 'Choco Danish Pastry',
      category: 'cemilan',
      price: 24000,
      stock: 12,
      description: 'Pastry cokelat lumer premium khas artisan bakery',
      subCategory: 'Bakery',
      tag: 'Manis Gurih',
      image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80',
      isAvailable: true
    },
    {
      name: 'French Fries Truffle',
      category: 'cemilan',
      price: 25000,
      stock: 30,
      description: 'Kentang goreng garing dibalut minyak truffle & taburan oregano',
      subCategory: 'Finger Food',
      tag: 'Cemilan Asin',
      image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400&auto=format&fit=crop&q=80',
      isAvailable: true
    },
    {
      name: 'Singkong Keju Gurih',
      category: 'cemilan',
      price: 18000,
      stock: 20,
      lowStockThreshold: 15,
      description: 'Singkong goreng merekah lembut dengan taburan keju cheddar melimpah',
      subCategory: 'Finger Food',
      tag: 'Tradisional',
      image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=400&auto=format&fit=crop&q=80',
      isAvailable: true
    },
    {
      name: 'Red Velvet Pastry',
      category: 'cemilan',
      price: 26000,
      stock: 0,
      lowStockThreshold: 10,
      description: 'Pastry red velvet lembut dengan cream cheese leleh khas artisan',
      subCategory: 'Bakery',
      tag: 'Habis / Out of Stock',
      image: 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=400&auto=format&fit=crop&q=80',
      isAvailable: false
    }
  ];

  const initialTemplates = [
    {
      code: 'RECEIPT_EMAIL',
      name: 'Struk Transaksi Pembeli',
      description: 'Template otomatis yang dikirim ke email pelanggan setelah pesanan dibayar',
      subject: 'Struk Pembelian SipSpot POS - #{{orderNumber}}',
      bodyHtml: `
<div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px; font-family: sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.05); border: 1px solid #f0dfdb;">
  <div style="text-align: center; border-bottom: 2px dashed #f0dfdb; padding-bottom: 16px; margin-bottom: 16px;">
    <h2 style="color: #ae3115; margin: 0;">SipSpot POS</h2>
    <p style="color: #59413c; font-size: 13px; margin: 4px 0 0 0;">Kopi, Teh, Jus & Cemilan Segar</p>
    <p style="color: #8d716a; font-size: 12px; margin-top: 8px;">Order #{{orderNumber}} • {{date}}</p>
  </div>
  <p style="font-size: 14px; color: #221a18;">Halo <strong>{{customerName}}</strong>, berikut adalah rincian pembayaran pesanan Anda:</p>
  <div style="margin: 16px 0;">{{itemsTable}}</div>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px;">
    <tr><td>Subtotal:</td><td style="text-align: right;"><strong>{{subtotal}}</strong></td></tr>
    <tr><td>Diskon Promo:</td><td style="text-align: right; color: #006c49;"><strong>- {{discount}}</strong></td></tr>
    <tr><td>PB1 (10%):</td><td style="text-align: right;"><strong>{{tax}}</strong></td></tr>
    <tr style="font-size: 16px; font-weight: bold; color: #ae3115;"><td style="padding-top: 8px;">Total:</td><td style="text-align: right; padding-top: 8px;">{{total}}</td></tr>
    <tr><td>Metode:</td><td style="text-align: right;">{{paymentMethod}}</td></tr>
    <tr><td>Kembalian:</td><td style="text-align: right; color: #006c49;">{{change}}</td></tr>
  </table>
  <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #f0dfdb; font-size: 12px; color: #8d716a;">
    Terima kasih telah berbelanja di SipSpot!<br>
    Kasir: {{cashierName}}
  </div>
</div>`,
      isActive: true,
      updatedAt: new Date()
    }
  ];

  // Populate local fallback store first
  fallbackStore.users = initialUsers.map((u, i) => ({ ...u, _id: `user_${i + 1}` }));
  fallbackStore.categories = initialCategories.map((c, i) => ({ ...c, _id: `cat_${i + 1}` }));
  fallbackStore.products = initialProducts.map((p, i) => ({
    ...p,
    lowStockThreshold: typeof (p as any).lowStockThreshold === 'number' ? (p as any).lowStockThreshold : 15,
    _id: `prod_${i + 1}`
  }));
  fallbackStore.email_templates = initialTemplates.map((t, i) => ({ ...t, _id: `tmpl_${i + 1}` }));
  fallbackStore.discount_rules = DEFAULT_RULES.map((r, i) => ({ ...r, _id: `rule_${i + 1}` }));
  fallbackStore.inventory_logs = [
    {
      id: 'log_1',
      productId: 'prod_1',
      productName: 'Espresso Latte',
      previousStock: 18,
      newStock: 28,
      change: 10,
      type: 'MANUAL_RESTOCK',
      reason: 'Restock biji kopi Arabika Gayo dari roastery',
      performedBy: { id: 'user_1', name: 'Ferry Manager', role: 'MANAGER' },
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: 'log_2',
      productId: 'prod_7',
      productName: 'Dragonfruit Berry',
      previousStock: 15,
      newStock: 11,
      change: -4,
      type: 'SALE_DEDUCTION',
      reason: 'Penjualan minuman jam sibuk',
      performedBy: { id: 'user_2', name: 'Sarah Barista', role: 'CASHIER' },
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
    }
  ];

  const now = Date.now();
  const initialLoginHistory = [
    {
      sessionId: 'sess_live_mgr_01',
      userId: 'user_1',
      email: 'manager@beverage.com',
      name: 'Ferry Manager',
      role: 'MANAGER',
      loginMethod: 'PIN',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0',
      device: 'Chrome di macOS',
      status: 'ACTIVE',
      timestamp: new Date(now - 1000 * 60 * 35),
      revokeToken: 'rev_token_01',
      revokedAt: null,
      revokeReason: null
    },
    {
      sessionId: 'sess_live_csh_02',
      userId: 'user_2',
      email: 'cashier@beverage.com',
      name: 'Sarah Barista',
      role: 'CASHIER',
      loginMethod: 'PIN',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      device: 'Safari di iPadOS',
      status: 'ACTIVE',
      timestamp: new Date(now - 1000 * 60 * 90),
      revokeToken: 'rev_token_02',
      revokedAt: null,
      revokeReason: null
    },
    {
      sessionId: 'sess_csh_03',
      userId: 'user_2',
      email: 'cashier@beverage.com',
      name: 'Sarah Barista',
      role: 'CASHIER',
      loginMethod: 'PASSWORD',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',
      device: 'Chrome di Windows',
      status: 'LOGGED_OUT',
      timestamp: new Date(now - 1000 * 3600 * 8),
      revokeToken: 'rev_token_03',
      revokedAt: null,
      revokeReason: null
    },
    {
      sessionId: 'sess_mgr_04',
      userId: 'user_1',
      email: 'manager@beverage.com',
      name: 'Ferry Manager',
      role: 'MANAGER',
      loginMethod: 'PASSWORD',
      ipAddress: '182.253.112.45',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1',
      device: 'Safari di iPhone',
      status: 'REVOKED',
      timestamp: new Date(now - 1000 * 3600 * 22),
      revokeToken: 'rev_token_04',
      revokedAt: new Date(now - 1000 * 3600 * 20),
      revokeReason: 'Dikeluarkan dari sistem oleh manajer'
    },
    {
      sessionId: 'sess_csh_05',
      userId: 'user_2',
      email: 'cashier@beverage.com',
      name: 'Sarah Barista',
      role: 'CASHIER',
      loginMethod: 'PIN',
      ipAddress: '192.168.1.108',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/127.0 Mobile',
      device: 'Chrome di Android',
      status: 'LOGGED_OUT',
      timestamp: new Date(now - 1000 * 3600 * 28),
      revokeToken: 'rev_token_05',
      revokedAt: null,
      revokeReason: null
    },
    {
      sessionId: 'sess_mgr_06',
      userId: 'user_1',
      email: 'manager@beverage.com',
      name: 'Ferry Manager',
      role: 'MANAGER',
      loginMethod: 'PIN',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0',
      device: 'Chrome di macOS',
      status: 'LOGGED_OUT',
      timestamp: new Date(now - 1000 * 3600 * 32),
      revokeToken: 'rev_token_06',
      revokedAt: null,
      revokeReason: null
    },
    {
      sessionId: 'sess_csh_07',
      userId: 'user_2',
      email: 'cashier@beverage.com',
      name: 'Sarah Barista',
      role: 'CASHIER',
      loginMethod: 'PIN',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) Safari/604.1',
      device: 'Safari di iPadOS',
      status: 'LOGGED_OUT',
      timestamp: new Date(now - 1000 * 3600 * 48),
      revokeToken: 'rev_token_07',
      revokedAt: null,
      revokeReason: null
    },
    {
      sessionId: 'sess_mgr_08',
      userId: 'user_1',
      email: 'manager@beverage.com',
      name: 'Ferry Manager',
      role: 'MANAGER',
      loginMethod: 'PASSWORD',
      ipAddress: '180.252.88.19',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/127.0',
      device: 'Chrome di macOS',
      status: 'REVOKED',
      timestamp: new Date(now - 1000 * 3600 * 56),
      revokeToken: 'rev_token_08',
      revokedAt: new Date(now - 1000 * 3600 * 50),
      revokeReason: 'IP mencurigakan di luar jam operasional toko'
    },
    {
      sessionId: 'sess_csh_09',
      userId: 'user_2',
      email: 'cashier@beverage.com',
      name: 'Sarah Barista',
      role: 'CASHIER',
      loginMethod: 'PIN',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) Safari/604.1',
      device: 'Safari di iPadOS',
      status: 'LOGGED_OUT',
      timestamp: new Date(now - 1000 * 3600 * 72),
      revokeToken: 'rev_token_09',
      revokedAt: null,
      revokeReason: null
    },
    {
      sessionId: 'sess_mgr_10',
      userId: 'user_1',
      email: 'manager@beverage.com',
      name: 'Ferry Manager',
      role: 'MANAGER',
      loginMethod: 'PIN',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/127.0',
      device: 'Chrome di macOS',
      status: 'LOGGED_OUT',
      timestamp: new Date(now - 1000 * 3600 * 75),
      revokeToken: 'rev_token_10',
      revokedAt: null,
      revokeReason: null
    },
    {
      sessionId: 'sess_csh_11',
      userId: 'user_2',
      email: 'cashier@beverage.com',
      name: 'Sarah Barista',
      role: 'CASHIER',
      loginMethod: 'PASSWORD',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
      device: 'Firefox di Windows',
      status: 'LOGGED_OUT',
      timestamp: new Date(now - 1000 * 3600 * 96),
      revokeToken: 'rev_token_11',
      revokedAt: null,
      revokeReason: null
    },
    {
      sessionId: 'sess_mgr_12',
      userId: 'user_1',
      email: 'manager@beverage.com',
      name: 'Ferry Manager',
      role: 'MANAGER',
      loginMethod: 'PIN',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/127.0',
      device: 'Chrome di macOS',
      status: 'LOGGED_OUT',
      timestamp: new Date(now - 1000 * 3600 * 100),
      revokeToken: 'rev_token_12',
      revokedAt: null,
      revokeReason: null
    },
    {
      sessionId: 'sess_csh_13',
      userId: 'user_2',
      email: 'cashier@beverage.com',
      name: 'Sarah Barista',
      role: 'CASHIER',
      loginMethod: 'PIN',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) Safari/604.1',
      device: 'Safari di iPadOS',
      status: 'LOGGED_OUT',
      timestamp: new Date(now - 1000 * 3600 * 120),
      revokeToken: 'rev_token_13',
      revokedAt: null,
      revokeReason: null
    },
    {
      sessionId: 'sess_mgr_14',
      userId: 'user_1',
      email: 'manager@beverage.com',
      name: 'Ferry Manager',
      role: 'MANAGER',
      loginMethod: 'PASSWORD',
      ipAddress: '114.122.45.18',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
      device: 'Safari di macOS',
      status: 'LOGGED_OUT',
      timestamp: new Date(now - 1000 * 3600 * 124),
      revokeToken: 'rev_token_14',
      revokedAt: null,
      revokeReason: null
    }
  ];

  const initialActivityLogs = [
    {
      action: 'CREATE',
      entity: 'USER',
      entityName: 'Ferry Manager (MANAGER)',
      summary: 'Inisialisasi sistem: Mendaftarkan akun Manajer Toko Utama (manager@beverage.com)',
      performedBy: { id: 'system', name: 'Sistem POS', email: 'system@sipspot.local', role: 'SYSTEM' },
      ipAddress: '127.0.0.1',
      createdAt: new Date(now - 1000 * 3600 * 72)
    },
    {
      action: 'CREATE',
      entity: 'USER',
      entityName: 'Sarah Barista (CASHIER)',
      summary: 'Mendaftarkan akun staf kasir baru: Sarah Barista (cashier@beverage.com)',
      performedBy: { id: 'user_1', name: 'Ferry Manager', email: 'manager@beverage.com', role: 'MANAGER' },
      ipAddress: '192.168.1.101',
      createdAt: new Date(now - 1000 * 3600 * 48)
    },
    {
      action: 'CREATE',
      entity: 'DISCOUNT_RULE',
      entityName: 'Diskon Akhir Pekan (WEEKEND_VIBE)',
      summary: 'Menambahkan aturan diskon promosi akhir pekan 15%',
      performedBy: { id: 'user_1', name: 'Ferry Manager', email: 'manager@beverage.com', role: 'MANAGER' },
      ipAddress: '192.168.1.101',
      createdAt: new Date(now - 1000 * 3600 * 24)
    },
    {
      action: 'UPDATE',
      entity: 'INVENTORY',
      entityName: 'Espresso Latte',
      summary: 'Penyesuaian stok Espresso Latte: 20 -> 28 unit (+8 unit) - Restock supplier pagi',
      performedBy: { id: 'user_1', name: 'Ferry Manager', email: 'manager@beverage.com', role: 'MANAGER' },
      ipAddress: '192.168.1.101',
      createdAt: new Date(now - 1000 * 3600 * 6)
    },
    {
      action: 'UPDATE',
      entity: 'EMAIL_TEMPLATE',
      entityName: 'Struk Belanja Digital',
      summary: 'Memperbarui template email struk digital dan gaya visual',
      performedBy: { id: 'user_1', name: 'Ferry Manager', email: 'manager@beverage.com', role: 'MANAGER' },
      ipAddress: '192.168.1.101',
      createdAt: new Date(now - 1000 * 3600 * 2)
    }
  ];

  if (fallbackStore.login_history.length === 0) {
    fallbackStore.login_history = [...initialLoginHistory];
  }

  if (!fallbackStore.activity_logs || fallbackStore.activity_logs.length === 0) {
    fallbackStore.activity_logs = [...initialActivityLogs];
  }

  // Seed MongoDB if connected
  const db = getDB();
  if (db) {
    try {
      // 1. Users
      const userCount = await db.collection('users').countDocuments();
      if (userCount === 0) {
        await db.collection('users').insertMany(initialUsers);
        console.log('[Seeder] Users seeded in MongoDB successfully.');
      } else {
        // Migrate legacy 4-digit PINs to 6-digit PINs
        await db.collection('users').updateMany({ pin: '1234' }, { $set: { pin: '123456' } });
        await db.collection('users').updateMany({ pin: '8492' }, { $set: { pin: '849201' } });
      }

      // 2. Categories
      const catCount = await db.collection('categories').countDocuments();
      if (catCount === 0) {
        await db.collection('categories').insertMany(initialCategories);
        console.log('[Seeder] Categories seeded in MongoDB successfully.');
      }

      // 3. Products
      const prodCount = await db.collection('products').countDocuments();
      if (prodCount === 0) {
        await db.collection('products').insertMany(initialProducts);
        console.log('[Seeder] Products seeded in MongoDB successfully.');
      }

      // 4. Email Templates
      const tmplCount = await db.collection('email_templates').countDocuments();
      if (tmplCount === 0) {
        await db.collection('email_templates').insertMany(initialTemplates);
        console.log('[Seeder] Email templates seeded in MongoDB successfully.');
      }

      // 5. Discount Rules
      const ruleCount = await db.collection('discount_rules').countDocuments();
      if (ruleCount === 0) {
        await db.collection('discount_rules').insertMany(DEFAULT_RULES);
        console.log('[Seeder] Discount rules seeded in MongoDB successfully.');
      }

      // 6. Login History
      const historyCount = await db.collection('login_history').countDocuments();
      if (historyCount === 0) {
        await db.collection('login_history').insertMany(initialLoginHistory);
        console.log('[Seeder] Login history seeded in MongoDB successfully.');
      }

      // 7. Activity Logs
      const activityCount = await db.collection('activity_logs').countDocuments();
      if (activityCount === 0) {
        await db.collection('activity_logs').insertMany(initialActivityLogs);
        console.log('[Seeder] Activity logs seeded in MongoDB successfully.');
      }
    } catch (err: any) {
      console.warn('[Seeder] MongoDB insert warning, using initialized fallback store:', err.message);
    }
  } else {
    console.log('[Seeder] Initialized local fallback store with full mock seed data.');
  }
}

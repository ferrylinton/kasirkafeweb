import { getDB, fallbackStore } from './db';
import { hashPassword } from './auth';
import { DEFAULT_RULES } from './discounts';
import { generateHistoricalOrders } from './orderGenerator';

export async function seedDatabase() {
  console.log('[Seeder] Starting automated database seeding...');

  const managerPassword = await hashPassword('Password123!');
  const cashierPassword = await hashPassword('Password123!');

  const initialVendors = [
    {
      id: 'vnd_admin',
      name: 'Admin',
      code: 'ADMIN',
      status: 'ACTIVE',
      email: 'admin@sipspot.com',
      phone: '+628119999000',
      address: 'Headquarters / Server Central Admin',
      currency: 'IDR',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date()
    },
    {
      id: 'vnd_sipspot_central',
      name: 'SipSpot Coffee & Boba (Pusat)',
      code: 'SIPSPOT',
      status: 'ACTIVE',
      email: 'pusat@sipspot.com',
      phone: '+628123456789',
      address: 'Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan',
      currency: 'IDR',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date()
    },
    {
      id: 'vnd_kopi_kulo_kemang',
      name: 'Kopi Kulo & Toast (Kemang)',
      code: 'KULO',
      status: 'ACTIVE',
      email: 'kemang@kopikulo.co.id',
      phone: '+628219876543',
      address: 'Jl. Kemang Raya No. 12B, Jakarta Selatan',
      currency: 'IDR',
      createdAt: new Date('2026-02-15'),
      updatedAt: new Date()
    },
    {
      id: 'vnd_tehpoci_nusantara',
      name: 'Teh Poci & Dimsum Nusantara (Bekasi)',
      code: 'TEHPOCI',
      status: 'ACTIVE',
      email: 'admin@tehpoci-nusantara.id',
      phone: '+628571234987',
      address: 'Grand Mall Bekasi Lt. Ground No. 18',
      currency: 'IDR',
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date()
    }
  ];

  const initialUsers = [
    {
      email: 'admin@sipspot.com',
      password: managerPassword,
      name: 'Radit Admin Sistem',
      role: 'ADMIN',
      vendorId: 'vnd_admin',
      pin: '999999',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'manager@beverage.com',
      password: managerPassword,
      name: 'Ferry Manager',
      role: 'MANAGER',
      vendorId: 'vnd_sipspot_central',
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
      vendorId: 'vnd_sipspot_central',
      pin: '849201',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAAjgCQE0xuFbycGsf6WrsOWezNIYgI_Mgqgra6If5l-kM6PFqvc7XWy5YiF5Nz7EygG4k0H2Mtwi3YvU3QNeoo32v6smnPch82-FkkCAsKzcGQi4I6AHfwmT_EX6gLASiAhpg3Id6wKlIGsRatzjG67KlS-ijqvdQ7j0udvFAvMNaF2qsoHvAhSZgovySmbs3wEEzo0f3ygY8yk_4gbXMWCCpyHK8UOowRpDf-Wf_uDLVXJMCXtWJ8Hw',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'kulo.manager@beverage.com',
      password: managerPassword,
      name: 'Budi Manager (Kulo)',
      role: 'MANAGER',
      vendorId: 'vnd_kopi_kulo_kemang',
      pin: '223344',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'kulo.cashier@beverage.com',
      password: cashierPassword,
      name: 'Dewi Kasir (Kulo)',
      role: 'CASHIER',
      vendorId: 'vnd_kopi_kulo_kemang',
      pin: '556677',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'poci.manager@beverage.com',
      password: managerPassword,
      name: 'Hendra Manager (Teh Poci)',
      role: 'MANAGER',
      vendorId: 'vnd_tehpoci_nusantara',
      pin: '334455',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'poci.cashier@beverage.com',
      password: cashierPassword,
      name: 'Rina Kasir (Teh Poci)',
      role: 'CASHIER',
      vendorId: 'vnd_tehpoci_nusantara',
      pin: '667788',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const initialCategories = [
    { code: 'kopi', name: 'Kopi', icon: '☕', description: 'Espresso, Latte, Cold Brew pilihan biji Arabika', vendorId: 'vnd_sipspot_central' },
    { code: 'teh', name: 'Teh', icon: '🍵', description: 'Artisan Matcha, Jasmine, Earl Grey wangi menenangkan', vendorId: 'vnd_sipspot_central' },
    { code: 'jus', name: 'Jus', icon: '🍹', description: '100% Buah segar cold-pressed alami tanpa pemanis buatan', vendorId: 'vnd_sipspot_central' },
    { code: 'cemilan', name: 'Cemilan', icon: '🥐', description: 'Pastry renyah, kue lezat, dan finger food pendamping', vendorId: 'vnd_sipspot_central' },
    { code: 'kopi', name: 'Kopi', icon: '☕', description: 'Signature Kulo Es Kopi Susu & Avocatto', vendorId: 'vnd_kopi_kulo_kemang' },
    { code: 'cemilan', name: 'Cemilan', icon: '🥐', description: 'Cemilan roti bakar dan snack pendamping', vendorId: 'vnd_kopi_kulo_kemang' },
    { code: 'teh', name: 'Teh', icon: '🍵', description: 'Teh Poci Melati Asli Seduh Tradisional', vendorId: 'vnd_tehpoci_nusantara' },
    { code: 'cemilan', name: 'Cemilan', icon: '🥟', description: 'Dimsum kukus dan goreng spesial', vendorId: 'vnd_tehpoci_nusantara' }
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
      isAvailable: true,
      vendorId: 'vnd_sipspot_central'
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
      isAvailable: false,
      vendorId: 'vnd_sipspot_central'
    },
    // Vendor 2: Kopi Kulo (Kemang)
    {
      name: 'Kulo Avocatto Chocolate',
      category: 'kopi',
      price: 32000,
      stock: 35,
      lowStockThreshold: 10,
      description: 'Signature Jus alpukat murni berpadu espresso mantap dengan topping es krim cokelat lezat',
      subCategory: 'Signature Kulo',
      tag: 'Best Seller',
      image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: 'vnd_kopi_kulo_kemang'
    },
    {
      name: 'Kulo Baileys Cream Latte',
      category: 'kopi',
      price: 30000,
      stock: 25,
      lowStockThreshold: 8,
      description: 'Espresso double shot harum berpadu sirup Baileys non-alkohol dan krim susu gurih',
      subCategory: 'Spesial Kopi',
      tag: 'Artisan',
      image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: 'vnd_kopi_kulo_kemang'
    },
    {
      name: 'Kopi Kulo Gula Aren',
      category: 'kopi',
      price: 24000,
      stock: 45,
      lowStockThreshold: 12,
      description: 'Perpaduan biji kopi pilihan, susu segar creamy dan gula aren organik murni',
      subCategory: 'Kopi Favorit',
      tag: 'Favorit Pelanggan',
      image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: 'vnd_kopi_kulo_kemang'
    },
    {
      name: 'Toast Keju Melted Spesial',
      category: 'cemilan',
      price: 26000,
      stock: 20,
      lowStockThreshold: 5,
      description: 'Roti bakar tebal panggang renyah dengan lelehan keju mozarella & cheddar gurih',
      subCategory: 'Kulo Toast',
      tag: 'Cemilan Hangat',
      image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: 'vnd_kopi_kulo_kemang'
    },
    {
      name: 'Croffle Gula Palem Karamel',
      category: 'cemilan',
      price: 28000,
      stock: 18,
      lowStockThreshold: 5,
      description: 'Croissant waffle renyah di luar lembut di dalam dengan taburan karamel wangi',
      subCategory: 'Kulo Bakery',
      tag: 'Manis Gurih',
      image: 'https://images.unsplash.com/photo-1588685912170-07e0c7e2b7e5?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: 'vnd_kopi_kulo_kemang'
    },
    // Vendor 3: Teh Poci & Dimsum (Bekasi)
    {
      name: 'Teh Poci Seduh Gula Batu Asli',
      category: 'teh',
      price: 15000,
      stock: 50,
      lowStockThreshold: 15,
      description: 'Teh melati wangi sepat legit khas seduh tanah liat dengan bongkahan gula batu asli',
      subCategory: 'Teh Tradisional',
      tag: 'Khas Poci',
      image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: 'vnd_tehpoci_nusantara'
    },
    {
      name: 'Es Teh Melati Jumbo Segar',
      category: 'teh',
      price: 10000,
      stock: 80,
      lowStockThreshold: 20,
      description: 'Es teh melati jumbo 22oz segar pelepas dahaga harum alami',
      subCategory: 'Teh Dingin',
      tag: 'Super Segar',
      image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: 'vnd_tehpoci_nusantara'
    },
    {
      name: 'Dimsum Hakau Udang Kukus (4 Pcs)',
      category: 'cemilan',
      price: 25000,
      stock: 30,
      lowStockThreshold: 8,
      description: 'Dimsum kulit transparan dengan isian udang utuh segar kenyal manis gurih',
      subCategory: 'Dimsum Kukus',
      tag: 'Chef Choice',
      image: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: 'vnd_tehpoci_nusantara'
    },
    {
      name: 'Siomay Dimsum Ayam Udang (4 Pcs)',
      category: 'cemilan',
      price: 22000,
      stock: 40,
      lowStockThreshold: 10,
      description: 'Siomay daging ayam dan udang padat dengan saus cocolan cabai merah gurih pedas',
      subCategory: 'Dimsum Kukus',
      tag: 'Terlaris',
      image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: 'vnd_tehpoci_nusantara'
    }
  ];

  const initialTemplates = [
    {
      code: 'RECEIPT_EMAIL',
      vendorId: 'vnd_sipspot_central',
      name: 'Struk Transaksi Pembeli - SipSpot Central',
      description: 'Template otomatis yang dikirim ke email pelanggan setelah pesanan dibayar',
      subject: 'Struk Pembelian SipSpot POS - #{{orderNumber}}',
      bodyHtml: `
<div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px; font-family: sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.05); border: 1px solid #f0dfdb;">
  <div style="text-align: center; border-bottom: 2px dashed #f0dfdb; padding-bottom: 16px; margin-bottom: 16px;">
    <h2 style="color: #ae3115; margin: 0;">SipSpot Central</h2>
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
    Terima kasih telah berbelanja di SipSpot Central!<br>
    Kasir: {{cashierName}}
  </div>
</div>`,
      isActive: true,
      updatedAt: new Date()
    },
    {
      code: 'RECEIPT_EMAIL',
      vendorId: 'vnd_kopi_kulo_kemang',
      name: 'Struk Transaksi - Kopi Kulo Kemang',
      description: 'Template otomatis struk email khas Kopi Kulo Kemang',
      subject: 'Struk Transaksi Kopi Kulo Kemang - #{{orderNumber}}',
      bodyHtml: `
<div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px; font-family: sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.05); border: 1px solid #e7dfd8;">
  <div style="text-align: center; border-bottom: 2px dashed #e7dfd8; padding-bottom: 16px; margin-bottom: 16px;">
    <h2 style="color: #654321; margin: 0;">Kopi Kulo Kemang</h2>
    <p style="color: #59413c; font-size: 13px; margin: 4px 0 0 0;">Spesialis Es Kopi Susu & Avocatto</p>
    <p style="color: #8d716a; font-size: 12px; margin-top: 8px;">Order #{{orderNumber}} • {{date}}</p>
  </div>
  <p style="font-size: 14px; color: #221a18;">Halo <strong>{{customerName}}</strong>, nikmati kesegaran racikan Kopi Kulo:</p>
  <div style="margin: 16px 0;">{{itemsTable}}</div>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px;">
    <tr><td>Subtotal:</td><td style="text-align: right;"><strong>{{subtotal}}</strong></td></tr>
    <tr><td>Diskon Promo:</td><td style="text-align: right; color: #006c49;"><strong>- {{discount}}</strong></td></tr>
    <tr><td>PB1 (10%):</td><td style="text-align: right;"><strong>{{tax}}</strong></td></tr>
    <tr style="font-size: 16px; font-weight: bold; color: #654321;"><td style="padding-top: 8px;">Total:</td><td style="text-align: right; padding-top: 8px;">{{total}}</td></tr>
    <tr><td>Metode:</td><td style="text-align: right;">{{paymentMethod}}</td></tr>
    <tr><td>Kembalian:</td><td style="text-align: right; color: #006c49;">{{change}}</td></tr>
  </table>
  <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e7dfd8; font-size: 12px; color: #8d716a;">
    Terima kasih telah singgah di Kopi Kulo Kemang!<br>
    Kasir: {{cashierName}}
  </div>
</div>`,
      isActive: true,
      updatedAt: new Date()
    },
    {
      code: 'RECEIPT_EMAIL',
      vendorId: 'vnd_tehpoci_nusantara',
      name: 'Struk Transaksi - Teh Poci Nusantara',
      description: 'Template otomatis struk email khas Teh Poci Nusantara & Dimsum',
      subject: 'Struk Pembelian Teh Poci Nusantara - #{{orderNumber}}',
      bodyHtml: `
<div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px; font-family: sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.05); border: 1px solid #dce8db;">
  <div style="text-align: center; border-bottom: 2px dashed #dce8db; padding-bottom: 16px; margin-bottom: 16px;">
    <h2 style="color: #1b4332; margin: 0;">Teh Poci Nusantara</h2>
    <p style="color: #2d6a4f; font-size: 13px; margin: 4px 0 0 0;">Teh Melati Asli Gula Batu & Dimsum Segar</p>
    <p style="color: #52b788; font-size: 12px; margin-top: 8px;">Order #{{orderNumber}} • {{date}}</p>
  </div>
  <p style="font-size: 14px; color: #221a18;">Halo <strong>{{customerName}}</strong>, terima kasih telah menikmati sajian kami:</p>
  <div style="margin: 16px 0;">{{itemsTable}}</div>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px;">
    <tr><td>Subtotal:</td><td style="text-align: right;"><strong>{{subtotal}}</strong></td></tr>
    <tr><td>Diskon Promo:</td><td style="text-align: right; color: #006c49;"><strong>- {{discount}}</strong></td></tr>
    <tr><td>PB1 (10%):</td><td style="text-align: right;"><strong>{{tax}}</strong></td></tr>
    <tr style="font-size: 16px; font-weight: bold; color: #1b4332;"><td style="padding-top: 8px;">Total:</td><td style="text-align: right; padding-top: 8px;">{{total}}</td></tr>
    <tr><td>Metode:</td><td style="text-align: right;">{{paymentMethod}}</td></tr>
    <tr><td>Kembalian:</td><td style="text-align: right; color: #006c49;">{{change}}</td></tr>
  </table>
  <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #dce8db; font-size: 12px; color: #8d716a;">
    Terima kasih telah mampir di Teh Poci Nusantara!<br>
    Kasir: {{cashierName}}
  </div>
</div>`,
      isActive: true,
      updatedAt: new Date()
    }
  ];

  // Populate local fallback store first
  fallbackStore.vendors = initialVendors.map(v => ({ ...v }));
  fallbackStore.users = initialUsers.map((u, i) => ({ ...u, _id: `user_${i + 1}` }));
  fallbackStore.categories = initialCategories.map((c, i) => ({ ...c, _id: `cat_${i + 1}` }));
  fallbackStore.products = initialProducts.map((p, i) => ({
    ...p,
    vendorId: (p as any).vendorId || 'vnd_sipspot_central',
    lowStockThreshold: typeof (p as any).lowStockThreshold === 'number' ? (p as any).lowStockThreshold : 15,
    _id: `prod_${i + 1}`
  }));
  fallbackStore.email_templates = initialTemplates.map((t, i) => ({ ...t, _id: `tmpl_${i + 1}` }));
  fallbackStore.discount_rules = DEFAULT_RULES.map((r, i) => ({ ...r, _id: `rule_${i + 1}` }));
  fallbackStore.inventory_logs = [
    {
      id: 'log_1',
      vendorId: 'vnd_sipspot_central',
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
      vendorId: 'vnd_sipspot_central',
      productId: 'prod_7',
      productName: 'Dragonfruit Berry',
      previousStock: 15,
      newStock: 11,
      change: -4,
      type: 'SALE_DEDUCTION',
      reason: 'Penjualan minuman jam sibuk',
      performedBy: { id: 'user_2', name: 'Sarah Barista', role: 'CASHIER' },
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'log_3',
      vendorId: 'vnd_kopi_kulo_kemang',
      productId: 'kulo_prod_1',
      productName: 'Es Kopi Kulo (Signature)',
      previousStock: 30,
      newStock: 50,
      change: 20,
      type: 'MANUAL_RESTOCK',
      reason: 'Penyetokan susu segar dan konsentrat espresso',
      performedBy: { id: 'user_kulo_1', name: 'Rian Manager Kulo', role: 'MANAGER' },
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 'log_4',
      vendorId: 'vnd_tehpoci_nusantara',
      productId: 'poci_prod_1',
      productName: 'Teh Poci Melati Jumbo',
      previousStock: 25,
      newStock: 60,
      change: 35,
      type: 'MANUAL_RESTOCK',
      reason: 'Penerimaan daun teh poci wangi dari Tegal',
      performedBy: { id: 'user_poci_1', name: 'Dewi Manager Poci', role: 'MANAGER' },
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
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
    fallbackStore.login_history = initialLoginHistory.map(h => ({
      vendorId: (h as any).vendorId || 'vnd_sipspot_central',
      ...h
    }));
  }

  if (!fallbackStore.activity_logs || fallbackStore.activity_logs.length === 0) {
    fallbackStore.activity_logs = initialActivityLogs.map(a => ({
      vendorId: (a as any).vendorId || 'vnd_sipspot_central',
      ...a
    }));
  }

  // Populate historical multi-vendor orders for rich analytics and dashboard
  const historicalOrders = generateHistoricalOrders();
  if (!fallbackStore.orders || fallbackStore.orders.length === 0) {
    fallbackStore.orders = historicalOrders.map(o => ({ ...o }));
  }

  // Seed MongoDB if connected
  const db = getDB();
  if (db) {
    try {
      // 0. Vendors - ensure all initial vendors including vnd_admin are present
      for (const v of initialVendors) {
        await db.collection('vendors').updateOne(
          { id: v.id },
          { $setOnInsert: v },
          { upsert: true }
        );
      }
      // Strip any legacy clientId and clientSecret fields from vendors collection
      await db.collection('vendors').updateMany(
        {},
        { $unset: { clientId: "", clientSecret: "" } }
      );
      console.log('[Seeder] Vendors seeded and synced in MongoDB successfully.');

      // 1. Users - upsert each by email so all vendors have their staff accounts
      for (const u of initialUsers) {
        await db.collection('users').updateOne(
          { email: u.email },
          { $setOnInsert: u },
          { upsert: true }
        );
      }
      // Explicitly sync Admin user to role ADMIN and vnd_admin vendor
      await db.collection('users').updateOne(
        { email: 'admin@sipspot.com' },
        {
          $set: {
            role: 'ADMIN',
            vendorId: 'vnd_admin',
            pin: '999999',
            name: 'Radit Admin Sistem'
          }
        }
      );
      // Migrate legacy 4-digit PINs to 6-digit PINs
      await db.collection('users').updateMany({ pin: '1234' }, { $set: { pin: '123456' } });
      await db.collection('users').updateMany({ pin: '8492' }, { $set: { pin: '849201' } });
      // Ensure vendorId is set on legacy users
      await db.collection('users').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      console.log('[Seeder] Users verified and synced in MongoDB.');

      // 2. Categories
      const catCount = await db.collection('categories').countDocuments();
      if (catCount === 0) {
        await db.collection('categories').insertMany(initialCategories);
        console.log('[Seeder] Categories seeded in MongoDB successfully.');
      }

      // 3. Products - ensure all vendor products are present
      for (const p of initialProducts) {
        await db.collection('products').updateOne(
          { name: p.name, vendorId: p.vendorId },
          { $setOnInsert: p },
          { upsert: true }
        );
      }
      await db.collection('products').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      console.log('[Seeder] Products verified and synced in MongoDB.');

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
        await db.collection('login_history').insertMany(initialLoginHistory.map(h => ({
          vendorId: (h as any).vendorId || 'vnd_sipspot_central',
          ...h
        })));
        console.log('[Seeder] Login history seeded in MongoDB successfully.');
      }

      // 7. Activity Logs
      const activityCount = await db.collection('activity_logs').countDocuments();
      if (activityCount === 0) {
        await db.collection('activity_logs').insertMany(initialActivityLogs.map(a => ({
          vendorId: (a as any).vendorId || 'vnd_sipspot_central',
          ...a
        })));
        console.log('[Seeder] Activity logs seeded in MongoDB successfully.');
      }

      // 8. Historical Orders for Multi-Vendor Dashboard
      const orderCount = await db.collection('orders').countDocuments();
      if (orderCount < 20) {
        await db.collection('orders').insertMany(historicalOrders.map(o => ({ ...o })));
        console.log('[Seeder] Historical multi-vendor orders seeded in MongoDB successfully.');
      }

      // 9. Universal Vendor Partition Migration across all collections
      await db.collection('activity_logs').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      await db.collection('categories').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      await db.collection('daily_counters').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      await db.collection('discount_rules').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      await db.collection('email_logs').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      await db.collection('email_templates').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      await db.collection('inventory_logs').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      await db.collection('login_history').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      await db.collection('orders').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      await db.collection('products').updateMany({ vendorId: { $exists: false } }, { $set: { vendorId: 'vnd_sipspot_central' } });
      console.log('[Seeder] All 10 data collections verified and updated with vendorId partition.');
    } catch (err: any) {
      console.warn('[Seeder] MongoDB insert warning, using initialized fallback store:', err.message);
    }
  } else {
    console.log('[Seeder] Initialized local fallback store with full mock seed data.');
  }
}

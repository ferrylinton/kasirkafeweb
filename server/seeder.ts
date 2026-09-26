import { getDB } from './db';
import { hashPassword } from './auth';
import { DEFAULT_RULES } from './discounts';
import { generateHistoricalOrders } from './orderGenerator';
import { ObjectId } from 'mongodb';

export async function seedDatabase() {
  console.log('[Seeder] Starting automated database seeding...');

  const managerPassword = await hashPassword('Password123!');
  const cashierPassword = await hashPassword('Password123!');

  const ADMIN_VENDOR_OID = new ObjectId('6ab58389b2a71518d2beb886');
  const CENTRAL_VENDOR_OID = new ObjectId('6ab58389b2a71518d2beb887');
  const KULO_VENDOR_OID = new ObjectId('6ab58389b2a71518d2beb888');
  const POCI_VENDOR_OID = new ObjectId('6ab58389b2a71518d2beb889');

  const initialVendors = [
    {
      _id: ADMIN_VENDOR_OID,
      name: 'Admin',
      status: 'ACTIVE',
      currency: 'IDR',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date()
    },
    {
      _id: CENTRAL_VENDOR_OID,
      name: 'KasirKafe Coffee & Boba (Pusat)',
      status: 'ACTIVE',
      currency: 'IDR',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date()
    },
    {
      _id: KULO_VENDOR_OID,
      name: 'Kopi Kulo & Toast (Kemang)',
      status: 'ACTIVE',
      currency: 'IDR',
      createdAt: new Date('2026-02-15'),
      updatedAt: new Date()
    },
    {
      _id: POCI_VENDOR_OID,
      name: 'Teh Poci & Dimsum Nusantara (Bekasi)',
      status: 'ACTIVE',
      currency: 'IDR',
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date()
    }
  ];

  const initialUsers = [
    {
      email: 'admin@kasirkafe.com',
      password: managerPassword,
      name: 'Radit Admin Sistem',
      role: 'ADMIN',
      vendorId: ADMIN_VENDOR_OID,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'manager@beverage.com',
      password: managerPassword,
      name: 'Ferry Manager',
      role: 'MANAGER',
      vendorId: CENTRAL_VENDOR_OID,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'cashier@beverage.com',
      password: cashierPassword,
      name: 'Sarah Barista',
      role: 'CASHIER',
      vendorId: CENTRAL_VENDOR_OID,
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAAjgCQE0xuFbycGsf6WrsOWezNIYgI_Mgqgra6If5l-kM6PFqvc7XWy5YiF5Nz7EygG4k0H2Mtwi3YvU3QNeoo32v6smnPch82-FkkCAsKzcGQi4I6AHfwmT_EX6gLASiAhpg3Id6wKlIGsRatzjG67KlS-ijqvdQ7j0udvFAvMNaF2qsoHvAhSZgovySmbs3wEEzo0f3ygY8yk_4gbXMWCCpyHK8UOowRpDf-Wf_uDLVXJMCXtWJ8Hw',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'kulo.manager@beverage.com',
      password: managerPassword,
      name: 'Budi Manager (Kulo)',
      role: 'MANAGER',
      vendorId: KULO_VENDOR_OID,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'kulo.cashier@beverage.com',
      password: cashierPassword,
      name: 'Dewi Kasir (Kulo)',
      role: 'CASHIER',
      vendorId: KULO_VENDOR_OID,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'poci.manager@beverage.com',
      password: managerPassword,
      name: 'Hendra Manager (Teh Poci)',
      role: 'MANAGER',
      vendorId: POCI_VENDOR_OID,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      email: 'poci.cashier@beverage.com',
      password: cashierPassword,
      name: 'Rina Kasir (Teh Poci)',
      role: 'CASHIER',
      vendorId: POCI_VENDOR_OID,
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const standardDrinkSizeVariation = {
    id: new ObjectId('6ab5838bb2a71518d2beb871'),
    name: 'Ukuran Cup',
    type: 'SINGLE_SELECT',
    required: true,
    vendorId: CENTRAL_VENDOR_OID,
    options: [
      { id: 'opt_reg', name: 'Regular 12oz', extraPrice: 0, isDefault: true },
      { id: 'opt_large', name: 'Large 16oz', extraPrice: 5000 },
      { id: 'opt_jumbo', name: 'Jumbo 22oz', extraPrice: 9000 }
    ]
  };

  const standardIceVariation = {
    id: new ObjectId('6ab5838bb2a71518d2beb872'),
    name: 'Level Es',
    type: 'SINGLE_SELECT',
    required: false,
    vendorId: CENTRAL_VENDOR_OID,
    options: [
      { id: 'opt_normal_ice', name: 'Normal Ice', extraPrice: 0, isDefault: true },
      { id: 'opt_less_ice', name: 'Less Ice', extraPrice: 0 },
      { id: 'opt_no_ice', name: 'No Ice', extraPrice: 0 }
    ]
  };

  const standardSugarVariation = {
    id: new ObjectId('6ab5838bb2a71518d2beb873'),
    name: 'Tingkat Gula',
    type: 'SINGLE_SELECT',
    required: false,
    vendorId: CENTRAL_VENDOR_OID,
    options: [
      { id: 'opt_normal_sugar', name: '100% Normal', extraPrice: 0, isDefault: true },
      { id: 'opt_less_sugar', name: '50% Less Sugar', extraPrice: 0 },
      { id: 'opt_no_sugar', name: '0% No Sugar', extraPrice: 0 }
    ]
  };

  const standardShotVariation = {
    id: new ObjectId('6ab5838bb2a71518d2beb874'),
    name: 'Espresso Shot',
    type: 'SINGLE_SELECT',
    required: false,
    vendorId: CENTRAL_VENDOR_OID,
    options: [
      { id: 'opt_normal_shot', name: 'Normal (1 Shot)', extraPrice: 0, isDefault: true },
      { id: 'opt_extra1_shot', name: '+1 Extra Shot', extraPrice: 5000 },
      { id: 'opt_extra2_shot', name: '+2 Extra Shot', extraPrice: 10000 }
    ]
  };

  const kuloDrinkSizeVariation = {
    id: new ObjectId('6ab5838bb2a71518d2beb875'),
    name: 'Ukuran Cup',
    type: 'SINGLE_SELECT',
    required: true,
    vendorId: KULO_VENDOR_OID,
    options: [
      { id: 'opt_kulo_reg', name: 'Regular Cup', extraPrice: 0, isDefault: true },
      { id: 'opt_kulo_large', name: 'Large Cup', extraPrice: 5000 }
    ]
  };

  const kuloIceVariation = {
    id: new ObjectId('6ab5838bb2a71518d2beb876'),
    name: 'Level Es',
    type: 'SINGLE_SELECT',
    required: false,
    vendorId: KULO_VENDOR_OID,
    options: [
      { id: 'opt_kulo_norm_ice', name: 'Normal Ice', extraPrice: 0, isDefault: true },
      { id: 'opt_kulo_less_ice', name: 'Less Ice', extraPrice: 0 }
    ]
  };

  const kuloSugarVariation = {
    id: new ObjectId('6ab5838bb2a71518d2beb877'),
    name: 'Tingkat Gula',
    type: 'SINGLE_SELECT',
    required: false,
    vendorId: KULO_VENDOR_OID,
    options: [
      { id: 'opt_kulo_norm_sug', name: 'Normal Aren', extraPrice: 0, isDefault: true },
      { id: 'opt_kulo_less_sug', name: 'Less Aren', extraPrice: 0 }
    ]
  };

  const kuloShotVariation = {
    id: new ObjectId('6ab5838bb2a71518d2beb878'),
    name: 'Espresso Shot',
    type: 'SINGLE_SELECT',
    required: false,
    vendorId: KULO_VENDOR_OID,
    options: [
      { id: 'opt_kulo_norm_shot', name: 'Normal (1 Shot)', extraPrice: 0, isDefault: true },
      { id: 'opt_kulo_extra_shot', name: '+1 Extra Shot', extraPrice: 5000 }
    ]
  };

  const tehPociDrinkSizeVariation = {
    id: new ObjectId('6ab5838bb2a71518d2beb879'),
    name: 'Ukuran Gelas',
    type: 'SINGLE_SELECT',
    required: true,
    vendorId: POCI_VENDOR_OID,
    options: [
      { id: 'opt_poci_cup_m', name: 'Cup Sedang (16oz)', extraPrice: 0, isDefault: true },
      { id: 'opt_poci_cup_l', name: 'Cup Jumbo (22oz)', extraPrice: 3000 }
    ]
  };

  const tehPociIceVariation = {
    id: new ObjectId('6ab5838bb2a71518d2beb87a'),
    name: 'Penyajian Es',
    type: 'SINGLE_SELECT',
    required: false,
    vendorId: POCI_VENDOR_OID,
    options: [
      { id: 'opt_poci_ice_norm', name: 'Dingin Es Segar', extraPrice: 0, isDefault: true },
      { id: 'opt_poci_ice_less', name: 'Sedikit Es', extraPrice: 0 },
      { id: 'opt_poci_warm', name: 'Hangat', extraPrice: 0 }
    ]
  };

  const tehPociSugarVariation = {
    id: new ObjectId('6ab5838bb2a71518d2beb87b'),
    name: 'Tingkat Manis',
    type: 'SINGLE_SELECT',
    required: false,
    vendorId: POCI_VENDOR_OID,
    options: [
      { id: 'opt_poci_sug_norm', name: 'Manis Pas', extraPrice: 0, isDefault: true },
      { id: 'opt_poci_sug_less', name: 'Kurang Manis', extraPrice: 0 },
      { id: 'opt_poci_tawar', name: 'Tawar (Tanpa Gula)', extraPrice: 0 }
    ]
  };

  const initialCategoryVariations = [
    standardDrinkSizeVariation,
    standardIceVariation,
    standardSugarVariation,
    standardShotVariation,
    kuloDrinkSizeVariation,
    kuloIceVariation,
    kuloSugarVariation,
    kuloShotVariation,
    tehPociDrinkSizeVariation,
    tehPociIceVariation,
    tehPociSugarVariation
  ];

  const initialCategories = [
    {
      id: new ObjectId('6ab5838bb2a71518d2beb881'),
      name: 'Kopi',
      description: 'Espresso, Latte, Cold Brew pilihan biji Arabika',
      vendorId: CENTRAL_VENDOR_OID,
      categoryVariationIds: [
        standardDrinkSizeVariation.id,
        standardIceVariation.id,
        standardSugarVariation.id,
        standardShotVariation.id
      ],
      variationIds: [
        standardDrinkSizeVariation.id,
        standardIceVariation.id,
        standardSugarVariation.id,
        standardShotVariation.id
      ],
      categoryVariationId: standardDrinkSizeVariation.id
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb882'),
      name: 'Teh',
      description: 'Artisan Matcha, Jasmine, Earl Grey wangi menenangkan',
      vendorId: CENTRAL_VENDOR_OID,
      categoryVariationIds: [
        standardDrinkSizeVariation.id,
        standardIceVariation.id,
        standardSugarVariation.id
      ],
      variationIds: [
        standardDrinkSizeVariation.id,
        standardIceVariation.id,
        standardSugarVariation.id
      ],
      categoryVariationId: standardDrinkSizeVariation.id
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb883'),
      name: 'Jus',
      description: '100% Buah segar cold-pressed alami tanpa pemanis buatan',
      vendorId: CENTRAL_VENDOR_OID,
      categoryVariationIds: [
        standardDrinkSizeVariation.id,
        standardIceVariation.id,
        standardSugarVariation.id
      ],
      variationIds: [
        standardDrinkSizeVariation.id,
        standardIceVariation.id,
        standardSugarVariation.id
      ],
      categoryVariationId: standardDrinkSizeVariation.id
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb884'),
      name: 'Cemilan',
      description: 'Pastry renyah, kue lezat, dan finger food pendamping',
      vendorId: CENTRAL_VENDOR_OID,
      categoryVariationIds: [],
      variationIds: [],
      categoryVariationId: null
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb885'),
      name: 'Kopi',
      description: 'Signature Kulo Es Kopi Susu & Avocatto',
      vendorId: KULO_VENDOR_OID,
      categoryVariationIds: [
        kuloDrinkSizeVariation.id,
        kuloIceVariation.id,
        kuloSugarVariation.id,
        kuloShotVariation.id
      ],
      variationIds: [
        kuloDrinkSizeVariation.id,
        kuloIceVariation.id,
        kuloSugarVariation.id,
        kuloShotVariation.id
      ],
      categoryVariationId: kuloDrinkSizeVariation.id
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb886'),
      name: 'Cemilan',
      description: 'Cemilan roti bakar dan snack pendamping',
      vendorId: KULO_VENDOR_OID,
      categoryVariationIds: [],
      variationIds: [],
      categoryVariationId: null
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb887'),
      name: 'Teh',
      description: 'Teh Poci Melati Asli Seduh Tradisional',
      vendorId: POCI_VENDOR_OID,
      categoryVariationIds: [
        tehPociDrinkSizeVariation.id,
        tehPociIceVariation.id,
        tehPociSugarVariation.id
      ],
      variationIds: [
        tehPociDrinkSizeVariation.id,
        tehPociIceVariation.id,
        tehPociSugarVariation.id
      ],
      categoryVariationId: tehPociDrinkSizeVariation.id
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb888'),
      name: 'Cemilan',
      description: 'Dimsum kukus dan goreng spesial',
      vendorId: POCI_VENDOR_OID,
      categoryVariationIds: [],
      variationIds: [],
      categoryVariationId: null
    }
  ];

  const initialProducts = [
    {
      id: new ObjectId('6ab5838bb2a71518d2beb899'),
      name: 'Espresso Latte',
      category: 'kopi',
      price: 28000,
      description: 'Arabika Gayo, Fresh Milk',
      tag: 'Best Seller',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtNMfSOkPEgLdVc2vKwY45wCgzwwn4srarfAclzt4f_z1t2GCXiXjKzKyLTw4Qb8HF_DbCT7aVAnSQEmWwHcfzRoFT7jXlEGDi9-Syypy9Jfw4AYn5_pfnyO7wbmT7XnhAnvqvJK8cZzK5Vv7IGXNv6tuat4pduj-j3JDy_TgWxA1oG-n8JqvJJGHe8FFYHRmRoIuEyWYwXNfISAcW7eYXrJwGpLW2jC44VdVHli4si8Q_iL9P2f3tLg',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb89a'),
      name: 'Aren Cold Brew',
      category: 'kopi',
      price: 26000,
      description: 'Steep 16 Jam, Gula Aren Murni',
      tag: 'Favorit Barista',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCvJdh749nH1gR2JunVywYMQZwKd2m2nffiuj2Mvs2KMwqC9BBJ49yOGr_9_JunjgM9BxcD5KR_nAPO1VF42jGfY5qhEuGwJ-gqaQi1vwD8pJlZvZIq9eBfOaUmi26UhKFA9phssHpmNM6n-B0JgNOtDATqeCk3I9xvzv0PVXhp0xgpiC68lFuRhz08JtMKVwm0mgVxahNDoLqkP0RVYozDd8OtNWaJeeeAdnrDckAcMSSOjFMVUACykA',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb89b'),
      name: 'Caramel Macchiato Latte',
      category: 'kopi',
      price: 29000,
      description: 'Double espresso shot, madagascar vanilla, salted caramel drizzles',
      tag: 'Best Seller',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA3nRgdjGnqjynsqzx5F2To8GoeiFzh-DW-eLq11HogGzQtZ2WKL6j2VrNlG8FGeztHN07Lunlrzb0tVO3hD2Wa0Ogc2n15NQmlOwBrUWdFGOYvR28xkISb08HbMXkYYMqiKH5Q3KwV0GSodGTQpdTzimlb7_J9qpWyHVf9hm14yI6zgyOiC5lKUWtOFSq78X7baLmSyw-13RQBCqVHMeIFTgwfI84p6knVpLuhkLG1tGIzn5dHiJHauw',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb89c'),
      name: 'Matcha Jasmine Tea',
      category: 'teh',
      price: 30000,
      description: 'Wangi Melati, Pure Matcha Uji Asli',
      tag: 'Matcha Uji',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyUf2Pv_hsauF8bNxe7DbZfgv8KjnRNMji6pTuhzjaaKuZQJJ8goHYZ1vwnWe7W0qb2PfiNWEpMbADXDOn6FkTmlVOnf5ijPtDH3tUl_MDNWySfMhcrwvDjWK7Qvd9ZEQ4w6OeerwlFMEvmpe9Am8t57ie6yPyFRckYlRx7Av9IjDKBIxYkpjqLzqSOIcehmbGogUhaf9E0XGBlkrOsAGpD0GbzX18XoH4v5gDtjW-5U4ZrUfu8mciBw',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb89d'),
      name: 'Earl Grey Milk Tea',
      category: 'teh',
      price: 25000,
      description: 'Bergamot Note, Fresh Cream, Boba Lembut',
      tag: 'Populer',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDRLFgKetXqgXN7L2j8MWsu9Q1Eb9yHwzyH6-ASIfUwawAa9Enj3XMOj3yT86b_LEmCuXDTFvluCM0F10enTo2U0OLeQqJdWeFTImS0m-nw__5a8Kmthg-b5xhuPnnPAVecNG8akkmHvu1HieuycWai8C2Zowe1OYFo5Xgu3Riec6vW3kaRaS_yvZxwYE4x3PGxUXGKVuLk3FdzMBRvjKWTPYXCwhbmsDJE-tXXL4nh8a9666-msWD1JA',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb89e'),
      name: 'Jasmine Green Tea',
      category: 'teh',
      price: 22000,
      description: 'Daun teh hijau melati dingin segar aroma alami',
      tag: 'Segar Alami',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEDdNAgqpFDYomBUwebjH1cUlD6u-s6RdfV_B3Zb2sErpLrfWBAlI-B4p9ghPK0MgP7u-BExqyPi0O6Fy5nc1a9JyE3lDkxO1GyavPWK6Rmk67W9jItT13snorCP72I1AEUd4jAYXNMKn2Lz44DGZ6HM9_iOY7NSczXkEJzmmMyq-3b2vxTM-puw_0iCpUshE4u_GwKW-TTggh5T670zI2UA3bRKmSkfrEPZWMX1SqFzQj0F5diM9zYQ',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb89f'),
      name: 'Tropical Mango',
      category: 'jus',
      price: 32000,
      description: 'Mangga Harum Manis, Nata de Coco, Chia Seed',
      tag: '100% Buah Asli',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA214agMyoRUOTHtl6f0KAbXn_zJMECP7woU_OtmC93inU5O1qM5MclDciInpj44f0qLM8WWK1B2JHsIvFLMvLRjvrAKYlmGsw_pe959wyisWjhJbgzB4-lo35bufA_rJi8FENB_IGS5fQ8aOVuYFjCzaoBdfq9NsX0if5hyAJbwywBpXL1xb3bVw7al16zdBhF8c5Gc6KxnOlBV2-7YkAuapgkybmUh9vVVzOKUx8chHfxhEiTOpYh0A',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb8a0'),
      name: 'Dragonfruit Berry',
      category: 'jus',
      price: 35000,
      description: 'Buah Naga Merah, Strawberry Segar, Sparkling Soda',
      tag: 'Segar & Asam',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOVXfWtFg9LCiGW5J0ud5qjQ0jGXJMeAczCs-pbDuX3RAR6hCtNrdxaMfeEUbGqkxEsXZa2mL9kEU1UBgCQ71XrzS1oVfn0Bk9BEYOItPZZ1otsDaOWYZdTqYnbo89dHJwf8WiOMUqDDcupTXFTxIc1Vl86Ei2gMwcKXBPtYrHTGShQCjjcVeYI_4OWcFWVAr5Rx8duqgdwCpRbMOvKIpAO6bKkiQBPFI5C_XOTBE9wab0Nj86w21Y9Q',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb8a1'),
      name: 'Mango Berry Breeze',
      category: 'jus',
      price: 28000,
      description: 'Perpaduan puree mangga dan beri tropis segar',
      tag: 'Segar Favorit',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsJDrQVcuTN15ytH6JXl2Sy1VxvsGMvJXf-uUvj-Cb8PrNhnnWViYvbqt5iYdo5tOkmdoUOoAGQyzqygOJaIomUHbcGWh68FXlZAm7maoXw8duNaOEuU40MckVywC0bynGatT1MLvbjyce6fsgcqhT0XmnqgVCRgC3XFamT00-1Y5E2HMq6ccb5Rn4pZFXHPpPQ2D-tpTrlrRWvLghCVS3qLc3PjAKjk2kh_Vli28UF9GS_LwWvg61Zw',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838bb2a71518d2beb8a2'),
      name: 'Croissant Butter Gold',
      category: 'cemilan',
      price: 22000,
      description: 'Pastry Prancis lapis butter renyah dan gurih wangi',
      tag: 'Fresh Baked',
      image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838cb2a71518d2beb8a3'),
      name: 'Choco Danish Pastry',
      category: 'cemilan',
      price: 24000,
      description: 'Pastry cokelat lumer premium khas artisan bakery',
      tag: 'Manis Gurih',
      image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838cb2a71518d2beb8a4'),
      name: 'French Fries Truffle',
      category: 'cemilan',
      price: 25000,
      description: 'Kentang goreng garing dibalut minyak truffle & taburan oregano',
      tag: 'Cemilan Asin',
      image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838cb2a71518d2beb8a5'),
      name: 'Singkong Keju Gurih',
      category: 'cemilan',
      price: 18000,
      description: 'Singkong goreng merekah lembut dengan taburan keju cheddar melimpah',
      tag: 'Tradisional',
      image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: CENTRAL_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838cb2a71518d2beb8a6'),
      name: 'Red Velvet Pastry',
      category: 'cemilan',
      price: 26000,
      description: 'Pastry red velvet lembut dengan cream cheese leleh khas artisan',
      tag: 'Habis / Out of Stock',
      image: 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=400&auto=format&fit=crop&q=80',
      isAvailable: false,
      vendorId: CENTRAL_VENDOR_OID
    },
    // Vendor 2: Kopi Kulo (Kemang)
    {
      id: new ObjectId('6ab5838cb2a71518d2beb8a7'),
      name: 'Kulo Avocatto Chocolate',
      category: 'kopi',
      price: 32000,
      description: 'Signature Jus alpukat murni berpadu espresso mantap dengan topping es krim cokelat lezat',
      tag: 'Best Seller',
      image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: KULO_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838cb2a71518d2beb8a8'),
      name: 'Kulo Baileys Cream Latte',
      category: 'kopi',
      price: 30000,
      description: 'Espresso double shot harum berpadu sirup Baileys non-alkohol dan krim susu gurih',
      tag: 'Artisan',
      image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: KULO_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838cb2a71518d2beb8a9'),
      name: 'Kopi Kulo Gula Aren',
      category: 'kopi',
      price: 24000,
      description: 'Perpaduan biji kopi pilihan, susu segar creamy dan gula aren organik murni',
      tag: 'Favorit Pelanggan',
      image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: KULO_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838cb2a71518d2beb8aa'),
      name: 'Toast Keju Melted Spesial',
      category: 'cemilan',
      price: 26000,
      description: 'Roti bakar tebal panggang renyah dengan lelehan keju mozarella & cheddar gurih',
      tag: 'Cemilan Hangat',
      image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: KULO_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838cb2a71518d2beb8ab'),
      name: 'Croffle Gula Palem Karamel',
      category: 'cemilan',
      price: 28000,
      description: 'Croissant waffle renyah di luar lembut di dalam dengan taburan karamel wangi',
      tag: 'Manis Gurih',
      image: 'https://images.unsplash.com/photo-1588685912170-07e0c7e2b7e5?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: KULO_VENDOR_OID
    },
    // Vendor 3: Teh Poci & Dimsum (Bekasi)
    {
      id: new ObjectId('6ab5838cb2a71518d2beb8ac'),
      name: 'Teh Poci Seduh Gula Batu Asli',
      category: 'teh',
      price: 15000,
      description: 'Teh melati wangi sepat legit khas seduh tanah liat dengan bongkahan gula batu asli',
      tag: 'Khas Poci',
      image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: POCI_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838db2a71518d2beb8ad'),
      name: 'Es Teh Melati Jumbo Segar',
      category: 'teh',
      price: 10000,
      description: 'Es teh melati jumbo 22oz segar pelepas dahaga harum alami',
      tag: 'Super Segar',
      image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: POCI_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838db2a71518d2beb8ae'),
      name: 'Dimsum Hakau Udang Kukus (4 Pcs)',
      category: 'cemilan',
      price: 25000,
      description: 'Dimsum kulit transparan dengan isian udang utuh segar kenyal manis gurih',
      tag: 'Chef Choice',
      image: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: POCI_VENDOR_OID
    },
    {
      id: new ObjectId('6ab5838db2a71518d2beb8af'),
      name: 'Siomay Dimsum Ayam Udang (4 Pcs)',
      category: 'cemilan',
      price: 22000,
      description: 'Siomay daging ayam dan udang padat dengan saus cocolan cabai merah gurih pedas',
      tag: 'Terlaris',
      image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=400&auto=format&fit=crop&q=80',
      isAvailable: true,
      vendorId: POCI_VENDOR_OID
    }
  ];

  // Product Stock references the Product id (on table use '_id', on node js code use 'id')
  const initialProductStocks = [
    {
      id: new ObjectId('6ab64f3eb2a71518d2bec662'),
      productId: new ObjectId('6ab5838bb2a71518d2beb899'), // reference Espresso Latte id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 28,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3eb2a71518d2bec663'),
      productId: new ObjectId('6ab5838bb2a71518d2beb89a'), // reference Aren Cold Brew id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 19,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3eb2a71518d2bec664'),
      productId: new ObjectId('6ab5838bb2a71518d2beb89b'), // reference Caramel Macchiato Latte id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 20,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3eb2a71518d2bec665'),
      productId: new ObjectId('6ab5838bb2a71518d2beb89c'), // reference Matcha Jasmine Tea id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 34,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3eb2a71518d2bec666'),
      productId: new ObjectId('6ab5838bb2a71518d2beb89d'), // reference Earl Grey Milk Tea id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 15,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3eb2a71518d2bec667'),
      productId: new ObjectId('6ab5838bb2a71518d2beb89e'), // reference Jasmine Green Tea id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 25,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3eb2a71518d2beb89f'),
      productId: new ObjectId('6ab5838bb2a71518d2beb89f'), // reference Tropical Mango id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 22,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3eb2a71518d2bec669'),
      productId: new ObjectId('6ab5838bb2a71518d2beb8a0'), // reference Dragonfruit Berry id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 11,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec66a'),
      productId: new ObjectId('6ab5838bb2a71518d2beb8a1'), // reference Mango Berry Breeze id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 18,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec66b'),
      productId: new ObjectId('6ab5838bb2a71518d2beb8a2'), // reference Croissant Butter Gold id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 15,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec66c'),
      productId: new ObjectId('6ab5838cb2a71518d2beb8a3'), // reference Choco Danish Pastry id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 12,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec66d'),
      productId: new ObjectId('6ab5838cb2a71518d2beb8a4'), // reference French Fries Truffle id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 30,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec66e'),
      productId: new ObjectId('6ab5838cb2a71518d2beb8a5'), // reference Singkong Keju Gurih id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 20,
      lowStockThreshold: 15,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec66f'),
      productId: new ObjectId('6ab5838cb2a71518d2beb8a6'), // reference Red Velvet Pastry id
      vendorId: CENTRAL_VENDOR_OID,
      stock: 0,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec670'),
      productId: new ObjectId('6ab5838cb2a71518d2beb8a7'), // reference Kulo Avocatto Chocolate id
      vendorId: KULO_VENDOR_OID,
      stock: 35,
      lowStockThreshold: 10,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec671'),
      productId: new ObjectId('6ab5838cb2a71518d2beb8a8'), // reference Kulo Baileys Cream Latte id
      vendorId: KULO_VENDOR_OID,
      stock: 25,
      lowStockThreshold: 8,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec672'),
      productId: new ObjectId('6ab5838cb2a71518d2beb8a9'), // reference Kopi Kulo Gula Aren id
      vendorId: KULO_VENDOR_OID,
      stock: 45,
      lowStockThreshold: 12,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec673'),
      productId: new ObjectId('6ab5838cb2a71518d2beb8aa'), // reference Toast Keju Melted Spesial id
      vendorId: KULO_VENDOR_OID,
      stock: 20,
      lowStockThreshold: 5,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec674'),
      productId: new ObjectId('6ab5838cb2a71518d2beb8ab'), // reference Croffle Gula Palem Karamel id
      vendorId: KULO_VENDOR_OID,
      stock: 18,
      lowStockThreshold: 5,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec675'),
      productId: new ObjectId('6ab5838cb2a71518d2beb8ac'), // reference Teh Poci Seduh Gula Batu Asli id
      vendorId: POCI_VENDOR_OID,
      stock: 50,
      lowStockThreshold: 15,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f3fb2a71518d2bec676'),
      productId: new ObjectId('6ab5838db2a71518d2beb8ad'), // reference Es Teh Melati Jumbo Segar id
      vendorId: POCI_VENDOR_OID,
      stock: 80,
      lowStockThreshold: 20,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f40b2a71518d2bec677'),
      productId: new ObjectId('6ab5838db2a71518d2beb8ae'), // reference Dimsum Hakau Udang Kukus (4 Pcs) id
      vendorId: POCI_VENDOR_OID,
      stock: 30,
      lowStockThreshold: 8,
      updatedAt: new Date()
    },
    {
      id: new ObjectId('6ab64f40b2a71518d2bec678'),
      productId: new ObjectId('6ab5838db2a71518d2beb8af'), // reference Siomay Dimsum Ayam Udang (4 Pcs) id
      vendorId: POCI_VENDOR_OID,
      stock: 40,
      lowStockThreshold: 10,
      updatedAt: new Date()
    }
  ];

  const initialTemplates = [
    {
      code: 'RECEIPT_EMAIL',
      vendorId: CENTRAL_VENDOR_OID,
      name: 'Struk Transaksi Pembeli - KasirKafe Central',
      description: 'Template otomatis yang dikirim ke email pelanggan setelah pesanan dibayar',
      subject: 'Struk Pembelian KasirKafe POS - #{{orderNumber}}',
      bodyHtml: `
<div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px; font-family: sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.05); border: 1px solid #f0dfdb;">
  <div style="text-align: center; border-bottom: 2px dashed #f0dfdb; padding-bottom: 16px; margin-bottom: 16px;">
    <h2 style="color: #ae3115; margin: 0;">KasirKafe Central</h2>
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
    Terima kasih telah berbelanja di KasirKafe Central!<br>
    Kasir: {{cashierName}}
  </div>
</div>`,
      isActive: true,
      updatedAt: new Date()
    },
    {
      code: 'RECEIPT_EMAIL',
      vendorId: KULO_VENDOR_OID,
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
      vendorId: POCI_VENDOR_OID,
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

  // Initial Inventory Logs
  const initialInventoryLogs = [
    {
      id: 'log_1',
      vendorId: CENTRAL_VENDOR_OID,
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
      vendorId: CENTRAL_VENDOR_OID,
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
      vendorId: KULO_VENDOR_OID,
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
      vendorId: POCI_VENDOR_OID,
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
      loginMethod: 'PASSWORD',
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
      loginMethod: 'PASSWORD',
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
      loginMethod: 'PASSWORD',
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
      loginMethod: 'PASSWORD',
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
      loginMethod: 'PASSWORD',
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
      loginMethod: 'PASSWORD',
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
      loginMethod: 'PASSWORD',
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
      loginMethod: 'PASSWORD',
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
      loginMethod: 'PASSWORD',
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
      performedBy: { id: 'system', name: 'Sistem POS', email: 'system@kasirkafe.local', role: 'SYSTEM' },
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

  // Populate historical multi-vendor orders for rich analytics and dashboard
  const historicalOrders = generateHistoricalOrders();

  const initialSavedOrders = [
    {
      id: 'hold_001',
      vendorId: CENTRAL_VENDOR_OID,
      draftNumber: 'HOLD-014',
      tableNameOrNote: 'Pesanan Doni Pratama',
      items: [
        {
          cartItemId: 'item-hold-1',
          productId: 'prod_1',
          name: 'Caramel Macchiato',
          category: 'kopi',
          price: 29000,
          quantity: 2,
          modifier: {
            size: 'Large',
            sizeExtra: 5000,
            ice: 'Less Ice',
            sugar: '100% Normal',
            milk: 'Oat Milk',
            milkExtra: 0,
            toppings: [],
            toppingsExtra: 0,
            notes: 'Minta ekstra caramel drizzle'
          },
          itemTotal: 68000,
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpnFKC-H8k2sIAtGjjoSN2DS0T72TbyE9qtMuouOhOVn4amQitM2rWQGwj9X-40uEr2_2wLzgI82o2efWjBfmREvC-HsB5c3ObP_cngIHeGLBQ2X3wxkNDUQJ97Yl1lOG6MFMiHogt9l19rqyri0J19DmJTn5B1B2gdz8a3811zG15uverHerHc9KEvy7j1nUNFfPegRU4dI3V4gBa75uvEderned9-rn5YGHhdLOa-9d7LLqEtebbow'
        },
        {
          cartItemId: 'item-hold-2',
          productId: 'prod_6',
          name: 'Jasmine Green Tea',
          category: 'teh',
          price: 22000,
          quantity: 1,
          modifier: {
            size: 'Regular',
            sizeExtra: 0,
            ice: 'Normal Ice',
            sugar: '50% Less',
            milk: 'Fresh Milk',
            milkExtra: 0,
            toppings: [],
            toppingsExtra: 0,
            notes: ''
          },
          itemTotal: 22000,
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEDdNAgqpFDYomBUwebjH1cUlD6u-s6RdfV_B3Zb2sErpLrfWBAlI-B4p9ghPK0MgP7u-BExqyPi0O6Fy5nc1a9JyE3lDkxO1GyavPWK6Rmk67W9jItT13snorCP72I1AEUd4jAYXNMKn2Lz44DGZ6HM9_iOY7NSczXkEJzmmMyq-3b2vxTM-puw_0iCpUshE4u_GwKW-TTggh5T670zI2UA3bRKmSkfrEPZWMX1SqFzQj0F5diM9zYQ'
        }
      ],
      discountItem: null,
      selectedDiscountCode: null,
      subtotal: 90000,
      discountAmount: 0,
      pb1Tax: 9000,
      totalAmount: 99000,
      totalItemsCount: 3,
      customer: {
        name: 'Kak Doni',
        email: 'doni.pratama@gmail.com',
        phone: '081298765432'
      },
      cashier: {
        id: 'usr_cashier_central',
        name: 'Sarah Barista'
      },
      status: 'HOLD',
      createdAt: new Date(Date.now() - 25 * 60 * 1000),
      updatedAt: new Date(Date.now() - 25 * 60 * 1000)
    }
  ];

  // Seed MongoDB if connected
  const db = getDB();
  if (db) {
    try {
      // 0. Vendors - ensure all initial vendors use _id (ObjectId) and remove code & id
      for (const v of initialVendors) {
        await db.collection('vendors').updateOne(
          { _id: v._id },
          { 
            $set: { name: v.name, status: v.status, currency: v.currency, updatedAt: v.updatedAt },
            $setOnInsert: { _id: v._id, createdAt: v.createdAt },
            $unset: { code: '', id: '' }
          },
          { upsert: true }
        );
      }
      // Ensure all vendor documents remove code and id
      await db.collection('vendors').updateMany({}, { $unset: { code: '', id: '' } });
      console.log('[Seeder] Vendors seeded and synced in MongoDB successfully.');

      // 1. Users - upsert each by email so all vendors have their staff accounts with Vendor ObjectId
      for (const u of initialUsers) {
        await db.collection('users').updateOne(
          { email: u.email },
          {
            $set: {
              name: u.name,
              role: u.role,
              vendorId: u.vendorId, // ObjectId
              avatar: u.avatar,
              updatedAt: new Date()
            },
            $setOnInsert: {
              email: u.email,
              password: u.password,
              createdAt: u.createdAt
            }
          },
          { upsert: true }
        );
      }
      // Explicitly sync Admin user to role ADMIN and Admin Vendor ObjectId
      await db.collection('users').updateOne(
        { email: 'admin@kasirkafe.com' },
        {
          $set: {
            role: 'ADMIN',
            vendorId: new ObjectId('6ab58389b2a71518d2beb886'),
            name: 'Radit Admin Sistem'
          }
        }
      );

      // Migrate any legacy users in MongoDB that still have string vendorId to Vendor ObjectId
      const legacyVendorMapping: Record<string, ObjectId> = {
        'vnd_admin': new ObjectId('6ab58389b2a71518d2beb886'),
        '6ab58389b2a71518d2beb886': new ObjectId('6ab58389b2a71518d2beb886'),
        'vnd_kasirkafe_central': new ObjectId('6ab58389b2a71518d2beb887'),
        '6ab58389b2a71518d2beb887': new ObjectId('6ab58389b2a71518d2beb887'),
        'vnd_kopi_kulo_kemang': new ObjectId('6ab58389b2a71518d2beb888'),
        '6ab58389b2a71518d2beb888': new ObjectId('6ab58389b2a71518d2beb888'),
        'vnd_tehpoci_nusantara': new ObjectId('6ab58389b2a71518d2beb889'),
        '6ab58389b2a71518d2beb889': new ObjectId('6ab58389b2a71518d2beb889')
      };

      for (const [legacyId, targetOid] of Object.entries(legacyVendorMapping)) {
        await db.collection('users').updateMany(
          { vendorId: legacyId },
          { $set: { vendorId: targetOid } }
        );
      }

      // Convert any remaining string ObjectId vendorId to real ObjectId
      const allUsers = await db.collection('users').find({}).toArray();
      for (const u of allUsers) {
        if (typeof u.vendorId === 'string') {
          if (ObjectId.isValid(u.vendorId)) {
            await db.collection('users').updateOne(
              { _id: u._id },
              { $set: { vendorId: new ObjectId(u.vendorId) } }
            );
          } else {
            await db.collection('users').updateOne(
              { _id: u._id },
              { $set: { vendorId: new ObjectId('6ab58389b2a71518d2beb887') } }
            );
          }
        } else if (!u.vendorId) {
          await db.collection('users').updateOne(
            { _id: u._id },
            { $set: { vendorId: new ObjectId('6ab58389b2a71518d2beb887') } }
          );
        }
      }
      console.log('[Seeder] Users verified and synced in MongoDB with Vendor ObjectId.');

      // 2a. Category Variations (on table use '_id', on node js code use 'id')
      for (const v of initialCategoryVariations) {
        const { id, ...cleanVar } = v;
        await db.collection('category_variations').updateOne(
          { _id: id },
          {
            $set: {
              ...cleanVar,
              updatedAt: new Date()
            },
            $setOnInsert: {
              _id: id,
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
      }
      console.log('[Seeder] Category Variations synced in category_variations table successfully.');

      // 2b. Categories (on table use '_id', on node js code use 'id' and reference Category Variation id)
      for (const cat of initialCategories) {
        const { id, ...cleanCat } = cat;
        await db.collection('categories').updateOne(
          { _id: id },
          {
            $set: {
              ...cleanCat,
              updatedAt: new Date()
            },
            $setOnInsert: {
              _id: id,
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
      }
      // Migrate any legacy categories in MongoDB that have embedded variations or missing variationIds
      const legacyCats = await db.collection('categories').find({}).toArray();
      for (const lc of legacyCats) {
        if (!lc.categoryVariationIds || lc.categoryVariationIds.length === 0) {
          if (Array.isArray(lc.variations) && lc.variations.length > 0) {
            const varIds: ObjectId[] = [];
            for (const v of lc.variations) {
              const varOid = ObjectId.isValid(v.id) ? new ObjectId(v.id) : new ObjectId();
              await db.collection('category_variations').updateOne(
                { _id: varOid },
                {
                  $set: {
                    name: v.name,
                    type: v.type || 'SINGLE_SELECT',
                    required: !!v.required,
                    options: v.options || [],
                    vendorId: lc.vendorId || 'vnd_kasirkafe_central',
                    updatedAt: new Date()
                  },
                  $setOnInsert: {
                    _id: varOid,
                    createdAt: new Date()
                  }
                },
                { upsert: true }
              );
              varIds.push(varOid);
            }
            await db.collection('categories').updateOne(
              { _id: lc._id },
              {
                $set: {
                  categoryVariationIds: varIds,
                  variationIds: varIds,
                  categoryVariationId: varIds[0] || null
                }
              }
            );
          }
        }
      }
      // Clean up legacy fields: code, icon, and embedded variations from categories
      await db.collection('categories').updateMany({}, { $unset: { code: '', icon: '', variations: '' } });
      console.log('[Seeder] Categories synced and referencing Category Variations in MongoDB successfully.');

      // 3. Products (on table use '_id', on node js code use 'id')
      for (const p of initialProducts) {
        const vOid = p.vendorId instanceof ObjectId ? p.vendorId : (legacyVendorMapping[p.vendorId] || CENTRAL_VENDOR_OID);
        const { id, ...prodCleanData } = p;
        await db.collection('products').updateOne(
          { _id: id },
          {
            $set: {
              ...prodCleanData,
              vendorId: vOid,
              updatedAt: new Date()
            },
            $setOnInsert: {
              _id: id,
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
      }
      // Ensure stock is removed from product table, stored in new product_stocks table
      await db.collection('products').updateMany({}, { $unset: { stock: '', lowStockThreshold: '' } });
      console.log('[Seeder] Products verified and synced in MongoDB with Vendor ObjectId.');

      // 4. Product Stocks (on table use '_id', on node js code use 'id', referencing Product id)
      for (const s of initialProductStocks) {
        const { id, productId, vendorId, ...stockData } = s;
        const vOid = vendorId instanceof ObjectId ? vendorId : (legacyVendorMapping[vendorId] || CENTRAL_VENDOR_OID);
        await db.collection('product_stocks').updateOne(
          { _id: id },
          {
            $set: {
              productId: productId.toString(),
              vendorId: vOid,
              ...stockData,
              updatedAt: new Date()
            },
            $setOnInsert: {
              _id: id
            }
          },
          { upsert: true }
        );
      }
      console.log('[Seeder] Product stocks synced referencing Product id with Vendor ObjectId.');

      // 5. Email Templates
      const tmplCount = await db.collection('email_templates').countDocuments();
      if (tmplCount === 0) {
        await db.collection('email_templates').insertMany(initialTemplates);
        console.log('[Seeder] Email templates seeded in MongoDB successfully.');
      }

      // 6. Discount Rules
      const ruleCount = await db.collection('discount_rules').countDocuments();
      if (ruleCount === 0) {
        await db.collection('discount_rules').insertMany(DEFAULT_RULES);
        console.log('[Seeder] Discount rules seeded in MongoDB successfully.');
      }

      // 7. Login History
      const historyCount = await db.collection('login_history').countDocuments();
      if (historyCount === 0) {
        await db.collection('login_history').insertMany(initialLoginHistory.map(h => ({
          ...h,
          vendorId: h.vendorId instanceof ObjectId ? h.vendorId : (legacyVendorMapping[(h as any).vendorId] || CENTRAL_VENDOR_OID)
        })));
        console.log('[Seeder] Login history seeded in MongoDB successfully.');
      }

      // 8. Activity Logs
      const activityCount = await db.collection('activity_logs').countDocuments();
      if (activityCount === 0) {
        await db.collection('activity_logs').insertMany(initialActivityLogs.map(a => ({
          ...a,
          vendorId: a.vendorId instanceof ObjectId ? a.vendorId : (legacyVendorMapping[(a as any).vendorId] || CENTRAL_VENDOR_OID)
        })));
        console.log('[Seeder] Activity logs seeded in MongoDB successfully.');
      }

      // 9. Historical Orders for Multi-Vendor Dashboard
      const orderCount = await db.collection('orders').countDocuments();
      if (orderCount < 20) {
        await db.collection('orders').insertMany(historicalOrders.map(o => ({
          ...o,
          vendorId: legacyVendorMapping[o.vendorId] || CENTRAL_VENDOR_OID
        })));
        console.log('[Seeder] Historical multi-vendor orders seeded in MongoDB successfully.');
      }

      // 10. Saved / Hold Orders
      const savedCount = await db.collection('saved_orders').countDocuments();
      if (savedCount === 0) {
        await db.collection('saved_orders').insertMany(initialSavedOrders.map(s => ({
          ...s,
          vendorId: s.vendorId instanceof ObjectId ? s.vendorId : (legacyVendorMapping[(s as any).vendorId] || CENTRAL_VENDOR_OID)
        })));
        console.log('[Seeder] Saved/hold orders seeded in MongoDB successfully.');
      }

      // 11. Universal Vendor Partition Migration across all collections:
      // Migrate all collections so vendorId is always an ObjectId from table Vendor
      const collectionsToMigrate = [
        'products',
        'product_stocks',
        'categories',
        'category_variations',
        'orders',
        'saved_orders',
        'users',
        'activity_logs',
        'inventory_logs',
        'daily_counters',
        'discount_rules',
        'email_logs',
        'email_templates',
        'login_history'
      ];

      for (const col of collectionsToMigrate) {
        for (const [legacyId, targetOid] of Object.entries(legacyVendorMapping)) {
          await db.collection(col).updateMany(
            { vendorId: legacyId },
            { $set: { vendorId: targetOid } }
          );
        }
        await db.collection(col).updateMany(
          { $or: [{ vendorId: { $exists: false } }, { vendorId: null }, { vendorId: '' }] },
          { $set: { vendorId: CENTRAL_VENDOR_OID } }
        );
      }
      console.log('[Seeder] All collections verified and updated with Vendor ObjectId partition.');
    } catch (err: any) {
      console.warn('[Seeder] MongoDB insert warning, using initialized fallback store:', err.message);
    }
  } else {
    console.log('[Seeder] Initialized local fallback store with full mock seed data.');
  }
}

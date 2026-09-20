import { getDB, fallbackStore } from './db';

export interface DiscountRule {
  _id?: any;
  vendorId?: string;
  code: string;
  name: string;
  description: string;
  type: 'QUANTITY_THRESHOLD' | 'MIN_SPEND' | 'BIRTHDAY' | 'CUSTOM';
  threshold?: number;
  rewardType: 'FREE_SNACK' | 'FREE_DRINK_OR_SNACK' | 'PERCENTAGE' | 'FIXED_AMOUNT';
  rewardValue?: number;
  isActive: boolean;
}

export interface OrderItemInput {
  productId: string;
  name: string;
  category: string; // 'kopi' | 'teh' | 'jus' | 'cemilan'
  price: number;
  quantity: number;
}

export interface AppliedDiscount {
  ruleCode: string;
  ruleName: string;
  description: string;
  discountAmount: number;
  rewardItemName?: string;
}

export interface DiscountCalculationResult {
  appliedDiscounts: AppliedDiscount[];
  totalDiscount: number;
  freeItemsSummary: string[];
}

export interface EvaluatedDiscountRule {
  id?: string;
  vendorId?: string;
  code: string;
  name: string;
  description: string;
  type: 'QUANTITY_THRESHOLD' | 'MIN_SPEND' | 'BIRTHDAY' | 'CUSTOM';
  threshold?: number;
  rewardType: 'FREE_SNACK' | 'FREE_DRINK_OR_SNACK' | 'PERCENTAGE' | 'FIXED_AMOUNT';
  rewardValue?: number;
  isEligible: boolean;
  missingRequirement?: string;
  eligibleCategories: string[];
}

export function calculateItemDiscountPrice(
  price: number,
  rewardType: 'FREE_SNACK' | 'FREE_DRINK_OR_SNACK' | 'PERCENTAGE' | 'FIXED_AMOUNT',
  rewardValue?: number
): { discountAmount: number; discountedPrice: number } {
  let discountAmount = 0;
  if (rewardType === 'FREE_SNACK' || rewardType === 'FREE_DRINK_OR_SNACK') {
    const maxVal = rewardValue && rewardValue > 0 ? rewardValue : price;
    discountAmount = Math.min(price, maxVal);
  } else if (rewardType === 'PERCENTAGE') {
    const pct = Math.min(100, Math.max(1, rewardValue || 10));
    discountAmount = Math.round((price * pct) / 100);
  } else if (rewardType === 'FIXED_AMOUNT') {
    const val = rewardValue || 10000;
    discountAmount = Math.min(price, val);
  }
  const discountedPrice = Math.max(0, price - discountAmount);
  return { discountAmount, discountedPrice };
}

export async function evaluateDiscountsForOrder(
  items: OrderItemInput[],
  subtotal: number,
  vendorId?: string
): Promise<{ eligibleDiscounts: EvaluatedDiscountRule[]; allRules: EvaluatedDiscountRule[] }> {
  const rules = await getActiveDiscountRules(vendorId);
  const totalDrinks = items
    .filter(i => ['kopi', 'teh', 'jus'].includes(i.category.toLowerCase()))
    .reduce((sum, i) => sum + i.quantity, 0);
  const totalItemsCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const evaluated: EvaluatedDiscountRule[] = rules.map(rule => {
    let isEligible = false;
    let missingRequirement: string | undefined = undefined;

    // Categories eligible to be chosen as discount item
    let eligibleCategories: string[] = ['kopi', 'teh', 'jus', 'cemilan'];
    if (rule.rewardType === 'FREE_SNACK') {
      eligibleCategories = ['cemilan'];
    } else if (rule.rewardType === 'FREE_DRINK_OR_SNACK') {
      eligibleCategories = ['kopi', 'teh', 'jus', 'cemilan'];
    }

    if (rule.type === 'QUANTITY_THRESHOLD') {
      const threshold = rule.threshold || 1;
      const isDrinkBased =
        rule.code.includes('DRINK') ||
        rule.code.includes('BUY_') ||
        rule.description.toLowerCase().includes('minuman');
      const currentCount = isDrinkBased ? totalDrinks : totalItemsCount;
      const unitName = isDrinkBased ? 'minuman' : 'item';

      if (currentCount >= threshold) {
        isEligible = true;
      } else {
        const diff = threshold - currentCount;
        missingRequirement = `Kurang ${diff} ${unitName} lagi (saat ini ${currentCount}/${threshold})`;
      }
    } else if (rule.type === 'MIN_SPEND') {
      const threshold = rule.threshold || 0;
      if (subtotal >= threshold) {
        isEligible = true;
      } else {
        const diff = threshold - subtotal;
        missingRequirement = `Kurang belanja Rp ${diff.toLocaleString('id-ID')} lagi (min. Rp ${threshold.toLocaleString('id-ID')})`;
      }
    } else if (rule.type === 'CUSTOM') {
      const threshold = rule.threshold || 0;
      if (threshold > 0) {
        if (subtotal >= threshold || totalItemsCount >= threshold) {
          isEligible = true;
        } else {
          missingRequirement = `Minimal belanja Rp ${threshold.toLocaleString('id-ID')} atau ${threshold} item`;
        }
      } else {
        isEligible = subtotal > 0;
      }
    } else if (rule.type === 'BIRTHDAY' || rule.code === 'BIRTHDAY_REWARD') {
      // Diskon Ulang Tahun Pembeli harus selalu aktif karena selalu ada kemungkinan pembeli ulang tahun di Applicable Discounts
      isEligible = true;
      missingRequirement = undefined;
    }

    return {
      id: rule._id ? rule._id.toString() : rule.code,
      vendorId: rule.vendorId || vendorId || 'vnd_sipspot_central',
      code: rule.code,
      name: rule.name,
      description: rule.description,
      type: rule.type,
      threshold: rule.threshold,
      rewardType: rule.rewardType,
      rewardValue: rule.rewardValue,
      isEligible,
      missingRequirement,
      eligibleCategories
    };
  });

  const eligibleDiscounts = evaluated.filter(r => r.isEligible);

  return {
    eligibleDiscounts,
    allRules: evaluated
  };
}

export const DEFAULT_RULES: DiscountRule[] = [
  // SipSpot Central HQ Rules
  {
    vendorId: 'vnd_sipspot_central',
    code: 'BUY_5_FREE_1_SNACK',
    name: 'Beli 5 Gratis 1 Snek',
    description: 'Beli minimal 5 minuman apa saja, dapatkan 1 snek gratis (senilai hingga Rp 20.000).',
    type: 'QUANTITY_THRESHOLD',
    threshold: 5,
    rewardType: 'FREE_SNACK',
    rewardValue: 20000,
    isActive: true
  },
  {
    vendorId: 'vnd_sipspot_central',
    code: 'BUY_10_FREE_1_DRINK_OR_SNACK',
    name: 'Beli 10 Gratis 1 Kopi / Snack',
    description: 'Beli minimal 10 minuman apa saja, dapatkan 1 kopi atau 1 snack gratis (senilai hingga Rp 28.000).',
    type: 'QUANTITY_THRESHOLD',
    threshold: 10,
    rewardType: 'FREE_DRINK_OR_SNACK',
    rewardValue: 28000,
    isActive: true
  },
  {
    vendorId: 'vnd_sipspot_central',
    code: 'SPEND_100K_FREE_ITEM',
    name: 'Belanja Min. Rp 100.000 Gratis 1 Kopi / Snack',
    description: 'Belanja total minimal Rp 100.000, dapatkan 1 kopi atau 1 snack gratis (senilai hingga Rp 28.000).',
    type: 'MIN_SPEND',
    threshold: 100000,
    rewardType: 'FREE_DRINK_OR_SNACK',
    rewardValue: 28000,
    isActive: true
  },
  {
    vendorId: 'vnd_sipspot_central',
    code: 'BIRTHDAY_REWARD',
    name: 'Diskon Ulang Tahun Pembeli',
    description: 'Promo hari ulang tahun pembeli: Dapatkan 1 minuman atau 1 snack gratis (senilai hingga Rp 28.000).',
    type: 'BIRTHDAY',
    rewardType: 'FREE_DRINK_OR_SNACK',
    rewardValue: 28000,
    isActive: true
  },

  // Kopi Kulo (Kemang) Rules
  {
    vendorId: 'vnd_kopi_kulo_kemang',
    code: 'KULO_BUY_3_FREE_1',
    name: 'Beli 3 Kulo Gratis 1 Toast',
    description: 'Beli 3 cup Kopi Kulo / Avocatto dapat 1 Roti Toast Keju gratis',
    type: 'QUANTITY_THRESHOLD',
    threshold: 3,
    rewardType: 'FREE_SNACK',
    rewardValue: 18000,
    isActive: true
  },
  {
    vendorId: 'vnd_kopi_kulo_kemang',
    code: 'KULO_SPEND_75K_DEAL',
    name: 'Hemat Belanja Rp 75.000 (Potongan Rp 15.000)',
    description: 'Beli menu Kulo minimal Rp 75.000 dapat potongan langsung Rp 15.000',
    type: 'MIN_SPEND',
    threshold: 75000,
    rewardType: 'FIXED_AMOUNT',
    rewardValue: 15000,
    isActive: true
  },

  // Teh Poci Nusantara (Bekasi) Rules
  {
    vendorId: 'vnd_tehpoci_nusantara',
    code: 'POCI_BUY_5_FREE_DIMSUM',
    name: 'Beli 5 Teh Poci Gratis 1 Dimsum Hakau',
    description: 'Beli 5 cup Teh Poci jumbo dapatkan 1 porsi Dimsum kukus gratis',
    type: 'QUANTITY_THRESHOLD',
    threshold: 5,
    rewardType: 'FREE_SNACK',
    rewardValue: 16000,
    isActive: true
  }
];

export async function getActiveDiscountRules(vendorId?: string): Promise<DiscountRule[]> {
  const activeVendorId = vendorId || 'vnd_sipspot_central';
  const birthdayRule: DiscountRule = {
    vendorId: activeVendorId,
    code: 'BIRTHDAY_REWARD',
    name: 'Diskon Ulang Tahun Pembeli',
    description: 'Promo hari ulang tahun pembeli: Dapatkan 1 minuman atau 1 snack gratis (senilai hingga Rp 28.000).',
    type: 'BIRTHDAY',
    rewardType: 'FREE_DRINK_OR_SNACK',
    rewardValue: 28000,
    isActive: true
  };

  const db = getDB();
  if (db) {
    try {
      const query: any = {
        isActive: true,
        $or: [
          { vendorId: activeVendorId },
          ...(activeVendorId === 'vnd_sipspot_central' ? [{ vendorId: { $exists: false } }, { vendorId: null }] : [])
        ]
      };
      const rules: DiscountRule[] = await db.collection<DiscountRule>('discount_rules').find(query).toArray();
      if (rules.length > 0) return rules;
    } catch (e) {
      // Fallback
    }
  }

  const source = fallbackStore.discount_rules.length > 0 ? fallbackStore.discount_rules : DEFAULT_RULES;
  let rules = source.filter(r => {
    if (!r.isActive) return false;
    const rVendor = r.vendorId || 'vnd_sipspot_central';
    return rVendor === activeVendorId;
  });

  if (rules.length === 0) {
    rules = DEFAULT_RULES.filter(r => (r.vendorId || 'vnd_sipspot_central') === activeVendorId);
  }

  if (rules.length === 0) {
    rules = [birthdayRule];
  }

  return rules;
}

export function isCustomerBirthday(birthDateStr?: string): boolean {
  if (!birthDateStr) return false;
  try {
    const parts = birthDateStr.split('-');
    if (parts.length >= 2) {
      // Formats: YYYY-MM-DD or MM-DD
      const month = parseInt(parts[parts.length - 2], 10);
      const day = parseInt(parts[parts.length - 1], 10);
      const today = new Date();
      return today.getMonth() + 1 === month && today.getDate() === day;
    }
  } catch (e) {
    return false;
  }
  return false;
}

export async function calculateDiscounts(
  items: OrderItemInput[],
  subtotal: number,
  customerBirthDate?: string,
  isBirthdayClaimed?: boolean,
  vendorId?: string
): Promise<DiscountCalculationResult> {
  const rules = await getActiveDiscountRules(vendorId);
  const appliedDiscounts: AppliedDiscount[] = [];
  const freeItemsSummary: string[] = [];

  // Count drinks vs snacks
  const totalDrinks = items
    .filter(i => ['kopi', 'teh', 'jus'].includes(i.category.toLowerCase()))
    .reduce((sum, i) => sum + i.quantity, 0);

  const snacks = items.filter(i => i.category.toLowerCase() === 'cemilan');
  const drinks = items.filter(i => ['kopi', 'teh', 'jus'].includes(i.category.toLowerCase()));

  // 1. Birthday rule
  const birthdayRule = rules.find(r => r.code === 'BIRTHDAY_REWARD' && r.isActive);
  const isBirthday = isCustomerBirthday(customerBirthDate) || isBirthdayClaimed;

  if (birthdayRule && isBirthday) {
    // Check if customer ordered a snack or drink to make free
    const eligibleItem = [...snacks, ...drinks].sort((a, b) => b.price - a.price)[0];
    const discountVal = eligibleItem ? Math.min(eligibleItem.price, birthdayRule.rewardValue || 28000) : (birthdayRule.rewardValue || 28000);
    appliedDiscounts.push({
      ruleCode: birthdayRule.code,
      ruleName: birthdayRule.name,
      description: 'Selamat Ulang Tahun! 1 Minuman/Snack Gratis',
      discountAmount: discountVal,
      rewardItemName: eligibleItem ? eligibleItem.name : 'Gratis 1 Kopi / Snack Pilihan'
    });
    freeItemsSummary.push(`🎂 Ulang Tahun: Gratis 1 Kopi/Snack (${eligibleItem ? eligibleItem.name : 'Voucher Free Drink/Snack'})`);
  }

  // 2. Buy 10 Free 1 Drink or Snack
  const buy10Rule = rules.find(r => r.code === 'BUY_10_FREE_1_DRINK_OR_SNACK' && r.isActive);
  if (buy10Rule && totalDrinks >= (buy10Rule.threshold || 10)) {
    const eligibleItem = [...drinks, ...snacks].sort((a, b) => b.price - a.price)[0];
    const discountVal = eligibleItem ? Math.min(eligibleItem.price, buy10Rule.rewardValue || 28000) : (buy10Rule.rewardValue || 28000);
    appliedDiscounts.push({
      ruleCode: buy10Rule.code,
      ruleName: buy10Rule.name,
      description: `Beli ${totalDrinks} Minuman: Gratis 1 Kopi/Snack`,
      discountAmount: discountVal,
      rewardItemName: eligibleItem ? eligibleItem.name : '1 Kopi atau Snack Gratis'
    });
    freeItemsSummary.push(`☕ Beli 10: Gratis 1 Kopi/Snack (${eligibleItem ? eligibleItem.name : 'Free Item'})`);
  }
  // 3. Buy 5 Free 1 Snack (If not already getting the buy 10, or as cumulative)
  else {
    const buy5Rule = rules.find(r => r.code === 'BUY_5_FREE_1_SNACK' && r.isActive);
    if (buy5Rule && totalDrinks >= (buy5Rule.threshold || 5)) {
      const snackItem = snacks[0];
      const discountVal = snackItem ? Math.min(snackItem.price, buy5Rule.rewardValue || 20000) : (buy5Rule.rewardValue || 20000);
      appliedDiscounts.push({
        ruleCode: buy5Rule.code,
        ruleName: buy5Rule.name,
        description: `Beli ${totalDrinks} Minuman: Gratis 1 Snek`,
        discountAmount: discountVal,
        rewardItemName: snackItem ? snackItem.name : '1 Snek Gratis'
      });
      freeItemsSummary.push(`🥐 Beli 5: Gratis 1 Snek (${snackItem ? snackItem.name : 'Free Snack'})`);
    }
  }

  // 4. Min Spend 100K
  const spendRule = rules.find(r => r.code === 'SPEND_100K_FREE_ITEM' && r.isActive);
  if (spendRule && subtotal >= (spendRule.threshold || 100000)) {
    // Only apply if not already getting a free drink/snack from spend to keep promo fair, or add as promo discount
    const alreadyHasSpendGift = appliedDiscounts.some(d => d.ruleCode === 'SPEND_100K_FREE_ITEM');
    if (!alreadyHasSpendGift) {
      const eligibleItem = [...drinks, ...snacks].sort((a, b) => a.price - b.price)[0];
      const discountVal = eligibleItem ? Math.min(eligibleItem.price, spendRule.rewardValue || 28000) : (spendRule.rewardValue || 28000);
      appliedDiscounts.push({
        ruleCode: spendRule.code,
        ruleName: spendRule.name,
        description: 'Belanja Min. Rp 100.000: Gratis 1 Kopi / Snack',
        discountAmount: discountVal,
        rewardItemName: eligibleItem ? eligibleItem.name : 'Gratis 1 Kopi / Snack'
      });
      freeItemsSummary.push(`🎁 Belanja > 100K: Gratis 1 Kopi/Snack (${eligibleItem ? eligibleItem.name : 'Free Item'})`);
    }
  }

  // 5. Evaluate custom and dynamically created rules
  const defaultCodes = ['BIRTHDAY_REWARD', 'BUY_10_FREE_1_DRINK_OR_SNACK', 'BUY_5_FREE_1_SNACK', 'SPEND_100K_FREE_ITEM'];
  const customRules = rules.filter(r => r.isActive && !defaultCodes.includes(r.code));

  for (const rule of customRules) {
    // Check if threshold condition met
    let conditionMet = false;

    if (rule.type === 'MIN_SPEND') {
      conditionMet = subtotal >= (rule.threshold || 0);
    } else if (rule.type === 'QUANTITY_THRESHOLD') {
      conditionMet = totalDrinks >= (rule.threshold || 0);
    } else if (rule.type === 'BIRTHDAY') {
      conditionMet = isCustomerBirthday(customerBirthDate) || Boolean(isBirthdayClaimed);
    } else if (rule.type === 'CUSTOM') {
      // Custom applies if either no threshold or subtotal/drinks threshold met
      if ((rule.threshold || 0) > 0) {
        conditionMet = subtotal >= (rule.threshold || 0) || totalDrinks >= (rule.threshold || 0);
      } else {
        conditionMet = true;
      }
    }

    if (conditionMet) {
      let discountVal = 0;
      let rewardName: string | undefined = undefined;

      if (rule.rewardType === 'PERCENTAGE') {
        const pct = Math.min(100, Math.max(1, rule.rewardValue || 10));
        discountVal = Math.round((subtotal * pct) / 100);
        appliedDiscounts.push({
          ruleCode: rule.code,
          ruleName: rule.name,
          description: `${rule.description} (Diskon ${pct}%)`,
          discountAmount: discountVal
        });
        freeItemsSummary.push(`🏷️ ${rule.name}: Diskon ${pct}% (-Rp ${discountVal.toLocaleString('id-ID')})`);
      } else if (rule.rewardType === 'FIXED_AMOUNT') {
        discountVal = Math.min(subtotal, rule.rewardValue || 10000);
        appliedDiscounts.push({
          ruleCode: rule.code,
          ruleName: rule.name,
          description: rule.description,
          discountAmount: discountVal
        });
        freeItemsSummary.push(`🏷️ ${rule.name}: Potongan Rp ${discountVal.toLocaleString('id-ID')}`);
      } else if (rule.rewardType === 'FREE_SNACK') {
        const eligible = snacks[0];
        discountVal = eligible ? Math.min(eligible.price, rule.rewardValue || 20000) : (rule.rewardValue || 20000);
        rewardName = eligible ? eligible.name : '1 Snack Gratis';
        appliedDiscounts.push({
          ruleCode: rule.code,
          ruleName: rule.name,
          description: rule.description,
          discountAmount: discountVal,
          rewardItemName: rewardName
        });
        freeItemsSummary.push(`🥐 ${rule.name} (${rewardName})`);
      } else if (rule.rewardType === 'FREE_DRINK_OR_SNACK') {
        const eligible = [...drinks, ...snacks].sort((a, b) => b.price - a.price)[0];
        discountVal = eligible ? Math.min(eligible.price, rule.rewardValue || 28000) : (rule.rewardValue || 28000);
        rewardName = eligible ? eligible.name : '1 Minuman/Snack Gratis';
        appliedDiscounts.push({
          ruleCode: rule.code,
          ruleName: rule.name,
          description: rule.description,
          discountAmount: discountVal,
          rewardItemName: rewardName
        });
        freeItemsSummary.push(`🎁 ${rule.name} (${rewardName})`);
      }
    }
  }

  // Calculate total discount deduction
  // Ensure discount does not exceed subtotal
  const totalDiscount = Math.min(subtotal, appliedDiscounts.reduce((sum, d) => sum + d.discountAmount, 0));

  return {
    appliedDiscounts,
    totalDiscount,
    freeItemsSummary
  };
}

import { Product, Category } from '../types';

interface CachedItem<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 menit

// In-memory runtime cache for 0ms latency during active session
const memoryCache = new Map<string, CachedItem<any>>();

// Helper to safely access localStorage with fallback
const storage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage full or disabled
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
};

/**
 * Generates consistent cache key for products query
 */
export function getProductCacheKey(params: {
  vendorId?: string;
  category?: string;
  search?: string;
  allVendors?: boolean;
}): string {
  const v = params.allVendors ? 'all' : (params.vendorId || 'current');
  const c = (params.category || 'all').toLowerCase().trim();
  const s = (params.search || '').toLowerCase().trim();
  return `kasirkafe_cache_prods_${v}_${c}_${s}`;
}

/**
 * Generates consistent cache key for categories
 */
export function getCategoryCacheKey(vendorId?: string): string {
  const v = vendorId || 'current';
  return `kasirkafe_cache_cats_${v}`;
}

/**
 * Get cached categories
 */
export function getCachedCategories(vendorId?: string): { categories: Category[]; ageMs: number; isStale: boolean } | null {
  const key = getCategoryCacheKey(vendorId);

  // 1. Check in-memory first
  let item = memoryCache.get(key);

  // 2. If not in memory, check localStorage
  if (!item) {
    const raw = storage.getItem(key);
    if (raw) {
      try {
        item = JSON.parse(raw);
        if (item && item.data) {
          memoryCache.set(key, item);
        }
      } catch {
        storage.removeItem(key);
      }
    }
  }

  if (!item || !Array.isArray(item.data)) {
    return null;
  }

  const now = Date.now();
  const ageMs = now - item.timestamp;
  const isStale = ageMs > (item.ttlMs || DEFAULT_CACHE_TTL);

  return {
    categories: item.data,
    ageMs,
    isStale
  };
}

/**
 * Save categories to cache
 */
export function setCachedCategories(categories: Category[], vendorId?: string, ttlMs = DEFAULT_CACHE_TTL): void {
  const key = getCategoryCacheKey(vendorId);
  const payload: CachedItem<Category[]> = {
    data: categories,
    timestamp: Date.now(),
    ttlMs
  };

  memoryCache.set(key, payload);
  storage.setItem(key, JSON.stringify(payload));
}

/**
 * Get cached products
 */
export function getCachedProducts(params: {
  vendorId?: string;
  category?: string;
  search?: string;
  allVendors?: boolean;
}): { products: Product[]; ageMs: number; isStale: boolean } | null {
  const key = getProductCacheKey(params);

  // 1. Check in-memory first
  let item = memoryCache.get(key);

  // 2. Check localStorage
  if (!item) {
    const raw = storage.getItem(key);
    if (raw) {
      try {
        item = JSON.parse(raw);
        if (item && item.data) {
          memoryCache.set(key, item);
        }
      } catch {
        storage.removeItem(key);
      }
    }
  }

  if (!item || !Array.isArray(item.data)) {
    return null;
  }

  const now = Date.now();
  const ageMs = now - item.timestamp;
  const isStale = ageMs > (item.ttlMs || DEFAULT_CACHE_TTL);

  return {
    products: item.data,
    ageMs,
    isStale
  };
}

/**
 * Save products to cache
 */
export function setCachedProducts(
  products: Product[],
  params: {
    vendorId?: string;
    category?: string;
    search?: string;
    allVendors?: boolean;
  },
  ttlMs = DEFAULT_CACHE_TTL
): void {
  const key = getProductCacheKey(params);
  const payload: CachedItem<Product[]> = {
    data: products,
    timestamp: Date.now(),
    ttlMs
  };

  memoryCache.set(key, payload);
  storage.setItem(key, JSON.stringify(payload));
}

/**
 * Clear all product and category caches on client side
 */
export function clearClientCatalogCache(): void {
  memoryCache.clear();

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('kasirkafe_cache_prods_') || k.startsWith('kasirkafe_cache_cats_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}

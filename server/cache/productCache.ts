/**
 * In-Memory Server Cache Manager for Products and Categories
 * Provides high-speed retrieval, TTL expiration, and tag-based invalidation.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
  createdAt: number;
}

class ProductCacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private hits: number = 0;
  private misses: number = 0;

  // Default TTL: 5 minutes (300,000 ms)
  private readonly DEFAULT_TTL = 5 * 60 * 1000;

  /**
   * Get an entry from cache if it exists and hasn't expired.
   */
  get<T>(key: string): { data: T; isCached: boolean; ageMs: number } | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return {
      data: entry.value as T,
      isCached: true,
      ageMs: now - entry.createdAt
    };
  }

  /**
   * Set an entry in cache with TTL and tagging.
   */
  set<T>(key: string, value: T, ttlMs: number = this.DEFAULT_TTL, tags: string[] = []): void {
    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + ttlMs,
      tags,
      createdAt: now
    });
  }

  /**
   * Delete an explicit key.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate entries matching a tag (e.g. 'vendor:vnd_123', 'type:category', 'type:product')
   */
  invalidateByTag(tag: string): number {
    let deletedCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Invalidate all products cache for a vendor (or all vendors)
   */
  invalidateProducts(vendorId?: string): number {
    let count = 0;
    if (vendorId && vendorId !== 'all') {
      count += this.invalidateByTag(`vendor:${vendorId}`);
      count += this.invalidateByTag('type:all_vendors');
    } else {
      count += this.invalidateByTag('type:product');
      count += this.invalidateByTag('type:all_vendors');
    }
    return count;
  }

  /**
   * Invalidate categories cache for a vendor (or all)
   */
  invalidateCategories(vendorId?: string): number {
    let count = 0;
    if (vendorId && vendorId !== 'all') {
      count += this.invalidateByTag(`cat_vendor:${vendorId}`);
      count += this.invalidateByTag('type:all_categories');
    } else {
      count += this.invalidateByTag('type:category');
      count += this.invalidateByTag('type:all_categories');
    }
    return count;
  }

  /**
   * Clear entire cache.
   */
  clearAll(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get stats for debugging or monitoring
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: string;
    keys: string[];
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : '0%';
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const serverProductCache = new ProductCacheManager();

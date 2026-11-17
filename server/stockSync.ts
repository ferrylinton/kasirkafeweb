import { Db, ObjectId } from 'mongodb';
import {
  buildVendorQuery,
  findVendorById,
  resolveVendorId,
  StockManagementMode
} from './vendorMiddleware';
import { serverProductCache } from './cache/productCache';

export interface ComputedRawMaterialStockResult {
  stock: number;
  maxServingsPossible: number;
  rawMaterialAvailable: boolean;
  rawMaterialReason: string;
}

/**
 * Reads the configured stock management mode for a vendor.
 * Defaults to 'PRODUCT_STOCK' when not explicitly configured.
 */
export async function getVendorStockMode(db: Db, vendorId?: string): Promise<StockManagementMode> {
  const resolved = resolveVendorId(vendorId);
  const vendor = await findVendorById(resolved);
  if (vendor?.stockManagementMode === 'RAW_MATERIAL') {
    return 'RAW_MATERIAL';
  }
  if (vendor?.stockManagementMode === 'PRODUCT_STOCK') {
    return 'PRODUCT_STOCK';
  }
  try {
    const query = ObjectId.isValid(resolved) && resolved.length === 24
      ? { _id: new ObjectId(resolved) }
      : { _id: resolved as any };
    const doc = await db.collection('vendors').findOne(query);
    if (doc?.stockManagementMode === 'RAW_MATERIAL') {
      return 'RAW_MATERIAL';
    }
  } catch (e) {}
  return 'PRODUCT_STOCK';
}

/**
 * Builds lookup maps for recipes and raw materials for a vendor.
 */
export async function loadVendorRecipeAndMaterialMaps(db: Db, vendorId?: string) {
  const vQuery = buildVendorQuery(vendorId);
  const [recipes, rawMaterials] = await Promise.all([
    db.collection('product_recipes').find(vQuery).toArray(),
    db.collection('raw_materials').find(vQuery).toArray()
  ]);

  const recipeMap = new Map<string, any>();
  recipes.forEach(r => {
    if (r.productId) recipeMap.set(String(r.productId), r);
    if (r.productName) recipeMap.set(String(r.productName).toLowerCase().trim(), r);
  });

  const rawMaterialMap = new Map<string, any>();
  rawMaterials.forEach(m => {
    if (m._id) rawMaterialMap.set(m._id.toString(), m);
    if (m.id) rawMaterialMap.set(String(m.id), m);
    if (m.name) rawMaterialMap.set(String(m.name).toLowerCase().trim(), m);
  });

  return { recipes, rawMaterials, recipeMap, rawMaterialMap };
}

/**
 * Computes product stock & availability strictly from raw material stocks for a recipe.
 * If ANY required ingredient is depleted (<= 0 or < quantityNeeded), stock is 0 (out of stock).
 */
export function computeRawMaterialProductStock(
  recipe: any,
  rawMaterialMap: Map<string, any>
): ComputedRawMaterialStockResult {
  if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    return {
      stock: 0,
      maxServingsPossible: 0,
      rawMaterialAvailable: true,
      rawMaterialReason: ''
    };
  }

  let minServings = Infinity;
  const depletedIngredients: string[] = [];

  for (const ing of recipe.ingredients) {
    const mat =
      rawMaterialMap.get(String(ing.materialId || '')) ||
      rawMaterialMap.get(String(ing.materialName || '').toLowerCase().trim());

    const currentMatStock = mat ? (typeof mat.stock === 'number' ? mat.stock : 0) : 0;
    const requiredQty = Number(ing.quantityNeeded) > 0 ? Number(ing.quantityNeeded) : 1;

    if (currentMatStock <= 0 || currentMatStock < requiredQty) {
      depletedIngredients.push(`${ing.materialName} (tersisa ${currentMatStock} ${ing.unit || ''})`.trim());
    }

    const servingsForThisIng = Math.max(0, Math.floor(currentMatStock / requiredQty));
    if (servingsForThisIng < minServings) {
      minServings = servingsForThisIng;
    }
  }

  if (depletedIngredients.length > 0 || minServings === Infinity || minServings <= 0) {
    return {
      stock: 0,
      maxServingsPossible: 0,
      rawMaterialAvailable: false,
      rawMaterialReason: `Bahan baku habis/kurang: ${depletedIngredients.join(', ')}`
    };
  }

  return {
    stock: minServings,
    maxServingsPossible: minServings,
    rawMaterialAvailable: true,
    rawMaterialReason: ''
  };
}

/**
 * Synchronizes product_stocks documents with computed raw-material capacities
 * when the vendor is configured to manage stock via RawMaterialStockScreen ('RAW_MATERIAL').
 */
export async function syncProductStocksFromRawMaterials(
  db: Db,
  vendorId?: string,
  options?: {
    logChanges?: boolean;
    reason?: string;
    performedBy?: { id: string; name: string; role: string };
  }
): Promise<{ syncedCount: number; mode: StockManagementMode }> {
  const resolvedVendorId = resolveVendorId(vendorId);
  const mode = await getVendorStockMode(db, resolvedVendorId);

  if (mode !== 'RAW_MATERIAL') {
    serverProductCache.invalidateProducts(resolvedVendorId);
    return { syncedCount: 0, mode };
  }

  const vQuery = buildVendorQuery(resolvedVendorId);
  const [products, { recipeMap, rawMaterialMap }] = await Promise.all([
    db.collection('products').find(vQuery).toArray(),
    loadVendorRecipeAndMaterialMaps(db, resolvedVendorId)
  ]);

  const productIds = products.map(p => (p._id ? p._id.toString() : p.id));
  const stockDocs = await db.collection('product_stocks').find({
    productId: { $in: productIds }
  }).toArray();
  const stockMap = new Map<string, any>();
  stockDocs.forEach(s => stockMap.set(String(s.productId), s));

  let syncedCount = 0;
  const now = new Date();

  for (const prod of products) {
    const prodIdStr = prod._id ? prod._id.toString() : String(prod.id);
    const recipe =
      recipeMap.get(prodIdStr) ||
      recipeMap.get(String(prod.name || '').toLowerCase().trim());

    if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      continue;
    }

    const computed = computeRawMaterialProductStock(recipe, rawMaterialMap);
    const existingStockDoc = stockMap.get(prodIdStr);
    const prevStock = existingStockDoc && typeof existingStockDoc.stock === 'number' ? existingStockDoc.stock : 0;

    await db.collection('product_stocks').updateOne(
      { productId: prodIdStr },
      {
        $set: {
          stock: computed.stock,
          stockSource: 'RAW_MATERIAL',
          updatedAt: now
        },
        $setOnInsert: {
          vendorId: prod.vendorId || resolvedVendorId,
          lowStockThreshold: typeof prod.lowStockThreshold === 'number' ? prod.lowStockThreshold : 10
        }
      },
      { upsert: true }
    );

    if (options?.logChanges && prevStock !== computed.stock) {
      const diff = computed.stock - prevStock;
      try {
        await db.collection('inventory_logs').insertOne({
          vendorId: prod.vendorId || resolvedVendorId,
          productId: prodIdStr,
          productName: prod.name,
          previousStock: prevStock,
          newStock: computed.stock,
          change: diff,
          type: diff > 0 ? 'MANUAL_RESTOCK' : 'MANUAL_ADJUSTMENT',
          reason: options.reason || 'Sinkronisasi otomatis dari Stok Bahan Baku',
          performedBy: options.performedBy || {
            id: 'system',
            name: 'Sistem Bahan Baku',
            role: 'SYSTEM'
          },
          createdAt: now
        });
      } catch (e) {}
    }

    syncedCount++;
  }

  serverProductCache.invalidateProducts(resolvedVendorId);
  return { syncedCount, mode };
}

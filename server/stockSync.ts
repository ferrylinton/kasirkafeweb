import { Db, ObjectId } from 'mongodb';
import {
  buildVendorQuery,
  findVendorById,
  resolveVendorId,
  StockManagementMode
} from './vendorMiddleware';
import { serverProductCache } from './cache/productCache';

export interface LowStockIngredientWarning {
  materialId: string;
  materialName: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  quantityNeeded: number;
  unit: string;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK';
}

export interface RecipeIngredientBreakdown {
  materialId: string;
  materialName: string;
  category: string;
  quantityNeeded: number;
  currentStock: number;
  minimumStock: number;
  unit: string;
  possibleServings: number;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'HEALTHY';
}

export interface ComputedRawMaterialStockResult {
  stock: number;
  maxServingsPossible: number;
  rawMaterialAvailable: boolean;
  rawMaterialReason: string;
  hasLowStockIngredient: boolean;
  lowStockIngredients: LowStockIngredientWarning[];
  ingredientBreakdown: RecipeIngredientBreakdown[];
}

/**
 * Reads the configured stock management mode for a vendor.
 * Defaults to 'RAW_MATERIAL' (Stock by Recipe) when not explicitly set to 'PRODUCT_STOCK'.
 */
export async function getVendorStockMode(db: Db, vendorId?: string): Promise<StockManagementMode> {
  const resolved = resolveVendorId(vendorId);
  const vendor = await findVendorById(resolved);
  if (vendor?.stockManagementMode === 'PRODUCT_STOCK') {
    return 'PRODUCT_STOCK';
  }
  if (vendor?.stockManagementMode === 'RAW_MATERIAL') {
    return 'RAW_MATERIAL';
  }
  try {
    const query = ObjectId.isValid(resolved) && resolved.length === 24
      ? { _id: new ObjectId(resolved) }
      : { _id: resolved as any };
    const doc = await db.collection('vendors').findOne(query);
    if (doc?.stockManagementMode === 'PRODUCT_STOCK') {
      return 'PRODUCT_STOCK';
    }
  } catch (e) {}
  return 'RAW_MATERIAL';
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
 * Computes product stock, availability, and low-stock ingredient/supply warnings strictly from recipe materials.
 * If ANY required ingredient or supply is depleted (<= 0 or < quantityNeeded), stock is 0 (out of stock).
 * If ANY required ingredient or supply is at or below minimumStock (> 0 && <= minimumStock), hasLowStockIngredient is true.
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
      rawMaterialReason: '',
      hasLowStockIngredient: false,
      lowStockIngredients: [],
      ingredientBreakdown: []
    };
  }

  let minServings = Infinity;
  const depletedIngredients: string[] = [];
  const lowStockIngredients: LowStockIngredientWarning[] = [];
  const ingredientBreakdown: RecipeIngredientBreakdown[] = [];

  for (const ing of recipe.ingredients) {
    const mat =
      rawMaterialMap.get(String(ing.materialId || '')) ||
      rawMaterialMap.get(String(ing.materialName || '').toLowerCase().trim());

    const currentMatStock = mat ? (typeof mat.stock === 'number' ? mat.stock : 0) : 0;
    const minMatStock = mat ? (typeof mat.minimumStock === 'number' ? mat.minimumStock : 100) : 0;
    const requiredQty = Number(ing.quantityNeeded) > 0 ? Number(ing.quantityNeeded) : 1;
    const matId = mat?._id ? mat._id.toString() : String(ing.materialId || '');
    const matName = mat?.name || ing.materialName || 'Bahan';
    const matCategory = mat?.category || 'LAINNYA';
    const matUnit = mat?.unit || ing.unit || 'unit';

    const servingsForThisIng = Math.max(0, Math.floor(currentMatStock / requiredQty));
    if (servingsForThisIng < minServings) {
      minServings = servingsForThisIng;
    }

    const isOut = currentMatStock <= 0 || currentMatStock < requiredQty;
    const isLow = !isOut && currentMatStock <= minMatStock;
    const status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'HEALTHY' = isOut
      ? 'OUT_OF_STOCK'
      : isLow
      ? 'LOW_STOCK'
      : 'HEALTHY';

    ingredientBreakdown.push({
      materialId: matId,
      materialName: matName,
      category: matCategory,
      quantityNeeded: requiredQty,
      currentStock: currentMatStock,
      minimumStock: minMatStock,
      unit: matUnit,
      possibleServings: servingsForThisIng,
      status
    });

    if (isOut) {
      depletedIngredients.push(`${matName} (tersisa ${currentMatStock} ${matUnit})`.trim());
      lowStockIngredients.push({
        materialId: matId,
        materialName: matName,
        category: matCategory,
        currentStock: currentMatStock,
        minimumStock: minMatStock,
        quantityNeeded: requiredQty,
        unit: matUnit,
        status: 'OUT_OF_STOCK'
      });
    } else if (isLow) {
      lowStockIngredients.push({
        materialId: matId,
        materialName: matName,
        category: matCategory,
        currentStock: currentMatStock,
        minimumStock: minMatStock,
        quantityNeeded: requiredQty,
        unit: matUnit,
        status: 'LOW_STOCK'
      });
    }
  }

  if (depletedIngredients.length > 0 || minServings === Infinity || minServings <= 0) {
    return {
      stock: 0,
      maxServingsPossible: 0,
      rawMaterialAvailable: false,
      rawMaterialReason: `Bahan/perlengkapan habis: ${depletedIngredients.join(', ')}`,
      hasLowStockIngredient: lowStockIngredients.length > 0,
      lowStockIngredients,
      ingredientBreakdown
    };
  }

  return {
    stock: minServings,
    maxServingsPossible: minServings,
    rawMaterialAvailable: true,
    rawMaterialReason: '',
    hasLowStockIngredient: lowStockIngredients.length > 0,
    lowStockIngredients,
    ingredientBreakdown
  };
}

/**
 * Synchronizes product_stocks documents with computed raw-material capacities
 * when the vendor is configured to manage stock via Recipe / Raw Materials ('RAW_MATERIAL').
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
          reason: options.reason || 'Sinkronisasi otomatis dari Stok Bahan Baku & Resep',
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

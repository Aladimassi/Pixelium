import { MOCK_CATALOG, setActiveCatalog, withProductImage } from '@pixelium/shared';
import { createProductStore } from './factory.js';
let productStore = null;
export async function initCatalog() {
    if (productStore) {
        await refreshActiveCatalog();
        return productStore;
    }
    productStore = await createProductStore();
    await productStore.ensureSchema();
    if (typeof productStore.backfillProductImages === 'function') {
        const filled = await productStore.backfillProductImages();
        if (filled > 0)
            console.log(`   ${filled} product images assigned`);
    }
    await productStore.seedIfEmpty();
    await productStore.upsertDemoProducts([...MOCK_CATALOG]);
    await refreshActiveCatalog();
    const count = productStore ? await productStore.count() : 0;
    console.log(`   ${count} products loaded (${productStore.kind})`);
    return productStore;
}
export async function refreshActiveCatalog() {
    if (!productStore)
        return;
    const products = (await productStore.listAll()).map((p) => withProductImage(p));
    setActiveCatalog(products);
}
export function getProductStore() {
    if (!productStore) {
        throw new Error('Catalog not initialized — call initCatalog() first');
    }
    return productStore;
}
export { createProductStore } from './factory.js';
export { loadCsvFile, loadBundledSeedProducts, parseKaggleCsv } from './kaggle-import.js';
export { mysqlConfigFromEnv } from './types.js';
//# sourceMappingURL=index.js.map
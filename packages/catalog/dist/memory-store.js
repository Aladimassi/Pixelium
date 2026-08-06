export class MemoryProductStore {
    kind = 'memory';
    products = [];
    async ensureSchema() { }
    async count() {
        return this.products.length;
    }
    async listAll() {
        return [...this.products];
    }
    async getBySku(sku) {
        return this.products.find((p) => p.sku === sku);
    }
    async upsertProducts(products) {
        const bySku = new Map(this.products.map((p) => [p.sku, p]));
        for (const p of products)
            bySku.set(p.sku, p);
        this.products = [...bySku.values()].sort((a, b) => a.name.localeCompare(b.name));
        return products.length;
    }
    async upsertDemoProducts(products) {
        await this.upsertProducts(products);
    }
    async seedIfEmpty() {
        if (this.products.length > 0)
            return 0;
        const { loadBundledSeedProducts } = await import('./kaggle-import.js');
        const seed = loadBundledSeedProducts(500);
        if (seed.length === 0)
            return 0;
        return this.upsertProducts(seed);
    }
    load(products) {
        this.products = [...products];
    }
}
//# sourceMappingURL=memory-store.js.map
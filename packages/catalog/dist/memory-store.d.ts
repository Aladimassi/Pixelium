import type { Product } from '@pixelium/shared';
import type { IProductStore } from './types.js';
export declare class MemoryProductStore implements IProductStore {
    readonly kind: "memory";
    private products;
    ensureSchema(): Promise<void>;
    count(): Promise<number>;
    listAll(): Promise<Product[]>;
    getBySku(sku: string): Promise<Product | undefined>;
    upsertProducts(products: Product[]): Promise<number>;
    upsertDemoProducts(products: Product[]): Promise<void>;
    seedIfEmpty(): Promise<number>;
    load(products: Product[]): void;
}

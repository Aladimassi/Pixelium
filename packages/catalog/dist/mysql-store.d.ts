import type { Product } from '@pixelium/shared';
import type { IProductStore, MySqlConfig } from './types.js';
export declare class MySqlProductStore implements IProductStore {
    readonly kind: "mysql";
    private pool;
    private constructor();
    static create(config: MySqlConfig): Promise<MySqlProductStore>;
    ensureSchema(): Promise<void>;
    count(): Promise<number>;
    listAll(): Promise<Product[]>;
    getBySku(sku: string): Promise<Product | undefined>;
    upsertProducts(products: Product[], source?: string): Promise<number>;
    upsertDemoProducts(products: Product[]): Promise<void>;
    seedIfEmpty(): Promise<number>;
}

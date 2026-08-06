import type { Product } from '@pixelium/shared';
export interface MySqlConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}
export interface IProductStore {
    readonly kind: 'mysql' | 'memory';
    ensureSchema(): Promise<void>;
    seedIfEmpty(): Promise<number>;
    upsertDemoProducts(products: Product[]): Promise<void>;
    upsertProducts(products: Product[], source?: string): Promise<number>;
    count(): Promise<number>;
    listAll(): Promise<Product[]>;
    getBySku(sku: string): Promise<Product | undefined>;
}
export declare function mysqlConfigFromEnv(): MySqlConfig;

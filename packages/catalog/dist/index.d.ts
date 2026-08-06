import type { IProductStore } from './types.js';
export declare function initCatalog(): Promise<IProductStore>;
export declare function refreshActiveCatalog(): Promise<void>;
export declare function getProductStore(): IProductStore;
export { createProductStore } from './factory.js';
export { loadCsvFile, loadBundledSeedProducts, parseKaggleCsv } from './kaggle-import.js';
export type { IProductStore, MySqlConfig } from './types.js';
export { mysqlConfigFromEnv } from './types.js';

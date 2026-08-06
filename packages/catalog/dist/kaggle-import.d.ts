import type { Product } from '@pixelium/shared';
/** Parse Amazon.co.uk price strings like "£3.42" or garbled UTF-8 variants */
export declare function parseAmazonPrice(raw: string): number;
export declare function parseAmazonStock(raw: string): number;
export declare function categoryFromAmazonPath(path: string): string;
export declare function skuFromUniqId(uniqId: string): string;
export declare function truncate(text: string, max: number): string;
/** Minimal CSV row parser — handles quoted fields with embedded newlines */
export declare function parseCsvRows(content: string): string[][];
export interface KaggleAmazonRow {
    uniq_id: string;
    product_name: string;
    manufacturer: string;
    price: string;
    number_available_in_stock: string;
    amazon_category_and_sub_category: string;
    description: string;
}
export declare function rowToProduct(cells: string[]): Product | null;
export declare function parseKaggleCsv(content: string, maxRows?: number): Product[];
export declare function bundledSeedJsonPath(): string;
export declare function loadBundledSeedProducts(maxRows?: number): Product[];
export declare function bundledSeedCsvPath(): string;
export declare function loadCsvFile(path: string, maxRows?: number): Product[];

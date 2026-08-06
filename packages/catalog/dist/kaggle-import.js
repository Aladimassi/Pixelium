import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
/** Parse Amazon.co.uk price strings like "£3.42" or garbled UTF-8 variants */
export function parseAmazonPrice(raw) {
    const digits = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    const pounds = parseFloat(digits);
    if (Number.isNaN(pounds) || pounds <= 0)
        return 999;
    return Math.round(pounds * 100);
}
export function parseAmazonStock(raw) {
    const match = raw.match(/(\d+)/);
    if (!match)
        return 5;
    return Math.max(1, Math.min(parseInt(match[1], 10), 999));
}
export function categoryFromAmazonPath(path) {
    const top = path.split('>')[0]?.trim().toLowerCase() ?? 'general';
    return top.replace(/\s+/g, '-').slice(0, 64) || 'general';
}
export function skuFromUniqId(uniqId) {
    return `AMZ-${uniqId.slice(0, 8).toUpperCase()}`;
}
export function truncate(text, max) {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= max)
        return cleaned;
    return `${cleaned.slice(0, max - 1)}…`;
}
/** Minimal CSV row parser — handles quoted fields with embedded newlines */
export function parseCsvRows(content) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        const next = content[i + 1];
        if (inQuotes) {
            if (ch === '"' && next === '"') {
                field += '"';
                i++;
            }
            else if (ch === '"') {
                inQuotes = false;
            }
            else {
                field += ch;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
        }
        else if (ch === ',') {
            row.push(field);
            field = '';
        }
        else if (ch === '\n' || (ch === '\r' && next === '\n')) {
            row.push(field);
            field = '';
            if (row.some((c) => c.length > 0))
                rows.push(row);
            row = [];
            if (ch === '\r')
                i++;
        }
        else if (ch !== '\r') {
            field += ch;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        if (row.some((c) => c.length > 0))
            rows.push(row);
    }
    return rows;
}
const KAGGLE_COLUMNS = [
    'uniq_id',
    'product_name',
    'manufacturer',
    'price',
    'number_available_in_stock',
    'number_of_reviews',
    'number_of_answered_questions',
    'average_review_rating',
    'amazon_category_and_sub_category',
    'customers_who_bought_this_item_also_bought',
    'description',
    'product_information',
    'product_description',
    'items_customers_buy_after_viewing_this_item',
    'customer_questions_and_answers',
    'customer_reviews',
    'sellers',
];
export function rowToProduct(cells) {
    if (cells.length < 11)
        return null;
    const record = {};
    for (let i = 0; i < KAGGLE_COLUMNS.length && i < cells.length; i++) {
        record[KAGGLE_COLUMNS[i]] = cells[i] ?? '';
    }
    const uniqId = record.uniq_id?.trim();
    const name = record.product_name?.trim();
    if (!uniqId || !name)
        return null;
    const description = truncate(record.description?.trim() ||
        record.product_description?.trim() ||
        record.product_information?.trim() ||
        name, 500);
    return {
        sku: skuFromUniqId(uniqId),
        name: truncate(name, 200),
        category: categoryFromAmazonPath(record.amazon_category_and_sub_category ?? ''),
        priceCents: parseAmazonPrice(record.price ?? ''),
        description,
        refundable: true,
        inStock: parseAmazonStock(record.number_available_in_stock ?? ''),
    };
}
export function parseKaggleCsv(content, maxRows = 0) {
    const rows = parseCsvRows(content);
    if (rows.length < 2)
        return [];
    const products = [];
    const seen = new Set();
    for (let i = 1; i < rows.length; i++) {
        if (maxRows > 0 && products.length >= maxRows)
            break;
        const product = rowToProduct(rows[i]);
        if (!product || seen.has(product.sku))
            continue;
        seen.add(product.sku);
        products.push(product);
    }
    return products;
}
export function bundledSeedJsonPath() {
    return join(__dirname, '..', 'data', 'products-seed.json');
}
export function loadBundledSeedProducts(maxRows = 500) {
    try {
        const jsonPath = bundledSeedJsonPath();
        const raw = readFileSync(jsonPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return maxRows > 0 ? parsed.slice(0, maxRows) : parsed;
    }
    catch {
        try {
            const csv = readFileSync(bundledSeedCsvPath(), 'utf8');
            return parseKaggleCsv(csv, maxRows);
        }
        catch {
            return [];
        }
    }
}
export function bundledSeedCsvPath() {
    return join(__dirname, '..', 'data', 'amazon_co-ecommerce_sample-head.csv');
}
export function loadCsvFile(path, maxRows = 0) {
    const csv = readFileSync(path, 'utf8');
    return parseKaggleCsv(csv, maxRows);
}
//# sourceMappingURL=kaggle-import.js.map
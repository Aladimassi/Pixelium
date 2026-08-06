import mysql from 'mysql2/promise';
import { resolveProductImageUrl } from '@pixelium/shared';
function rowToProduct(row) {
    const base = {
        sku: row.sku,
        name: row.name,
        category: row.category,
        priceCents: row.price_cents,
        description: row.description,
        refundable: Boolean(row.refundable),
        inStock: row.in_stock,
    };
    return {
        ...base,
        imageUrl: resolveProductImageUrl({ ...base, imageUrl: row.image_url }),
    };
}
export class MySqlProductStore {
    kind = 'mysql';
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    static async create(config) {
        const bootstrap = mysql.createPool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            waitForConnections: true,
            connectionLimit: 5,
        });
        await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await bootstrap.end();
        const pool = mysql.createPool({
            ...config,
            waitForConnections: true,
            connectionLimit: 10,
        });
        const store = new MySqlProductStore(pool);
        await store.ensureSchema();
        return store;
    }
    async ensureSchema() {
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        sku VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(512) NOT NULL,
        category VARCHAR(128) NOT NULL,
        price_cents INT NOT NULL,
        description TEXT NOT NULL,
        refundable TINYINT(1) NOT NULL DEFAULT 1,
        in_stock INT NOT NULL DEFAULT 10,
        source VARCHAR(32) NULL,
        external_id VARCHAR(64) NULL,
        brand VARCHAR(128) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX idx_products_category (category),
        INDEX idx_products_source (source),
        INDEX idx_products_price (price_cents)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        try {
            await this.pool.query(`ALTER TABLE products ADD COLUMN image_url VARCHAR(1024) NULL AFTER brand`);
        }
        catch (err) {
            if (err?.code !== 'ER_DUP_FIELDNAME')
                throw err;
        }
    }
    async backfillProductImages() {
        const [rows] = await this.pool.query('SELECT sku, name, category, description, image_url FROM products');
        if (!rows.length)
            return 0;
        let count = 0;
        for (const row of rows) {
            const url = resolveProductImageUrl({
                sku: row.sku,
                name: row.name,
                category: row.category,
                description: row.description,
                imageUrl: row.image_url,
            });
            if (row.image_url === url)
                continue;
            await this.pool.query('UPDATE products SET image_url = ? WHERE sku = ?', [url, row.sku]);
            count++;
        }
        return count;
    }
    async count() {
        const [rows] = await this.pool.query('SELECT COUNT(*) AS cnt FROM products');
        return Number(rows[0]?.cnt ?? 0);
    }
    async listAll() {
        const [rows] = await this.pool.query('SELECT sku, name, category, price_cents, description, refundable, in_stock, source, external_id, brand, image_url FROM products ORDER BY name');
        return rows.map(rowToProduct);
    }
    async getBySku(sku) {
        const [rows] = await this.pool.query('SELECT sku, name, category, price_cents, description, refundable, in_stock, source, external_id, brand, image_url FROM products WHERE sku = ? LIMIT 1', [sku]);
        return rows[0] ? rowToProduct(rows[0]) : undefined;
    }
    async upsertProducts(products, source = 'kaggle') {
        if (products.length === 0)
            return 0;
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            let count = 0;
            for (const p of products) {
                const imageUrl = p.imageUrl ?? resolveProductImageUrl(p);
                await conn.query(`INSERT INTO products (sku, name, category, price_cents, description, refundable, in_stock, source, external_id, brand, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             category = VALUES(category),
             price_cents = VALUES(price_cents),
             description = VALUES(description),
             in_stock = VALUES(in_stock),
             source = VALUES(source),
             image_url = VALUES(image_url)`, [
                    p.sku,
                    p.name,
                    p.category,
                    p.priceCents,
                    p.description,
                    p.refundable ? 1 : 0,
                    p.inStock,
                    source,
                    p.sku.startsWith('AMZ-') ? p.sku.slice(4) : null,
                    null,
                    imageUrl,
                ]);
                count++;
            }
            await conn.commit();
            return count;
        }
        catch (err) {
            await conn.rollback();
            throw err;
        }
        finally {
            conn.release();
        }
    }
    async upsertDemoProducts(products) {
        await this.upsertProducts(products, 'demo');
    }
    async seedIfEmpty() {
        const existing = await this.count();
        if (existing > 0)
            return 0;
        const { loadBundledSeedProducts } = await import('./kaggle-import.js');
        const seed = loadBundledSeedProducts(500);
        if (seed.length === 0)
            return 0;
        return this.upsertProducts(seed, 'kaggle-seed');
    }
}
//# sourceMappingURL=mysql-store.js.map
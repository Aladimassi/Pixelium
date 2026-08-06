import { MemoryProductStore } from './memory-store.js';
import { MySqlProductStore } from './mysql-store.js';
import { mysqlConfigFromEnv } from './types.js';
export async function createProductStore() {
    const storeType = (process.env.CATALOG_STORE ?? process.env.AUDIT_STORE ?? 'mysql').toLowerCase();
    if (storeType === 'memory') {
        console.log('📦 Catalog store: in-memory');
        return new MemoryProductStore();
    }
    const config = mysqlConfigFromEnv();
    try {
        const store = await MySqlProductStore.create(config);
        console.log(`📦 Catalog store: MySQL (${config.user}@${config.host}:${config.port}/${config.database})`);
        return store;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`❌ Catalog MySQL failed: ${message}`);
        console.error('   Using in-memory catalog. Start XAMPP MySQL or set CATALOG_STORE=memory.');
        const memory = new MemoryProductStore();
        return memory;
    }
}
//# sourceMappingURL=factory.js.map
import { randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
const MAX_AVATAR_BYTES = 512_000;
function rowToUser(row) {
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.created_at.toISOString(),
        avatarUrl: row.avatar_data ?? undefined,
    };
}
function validateAvatar(data) {
    if (data == null || data === '')
        return;
    if (data.length > MAX_AVATAR_BYTES) {
        throw new Error('Profile photo is too large (max 500KB). Try a smaller image.');
    }
    if (!data.startsWith('data:image/')) {
        throw new Error('Profile photo must be a JPEG, PNG, or WebP image.');
    }
}
export class UserStore {
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
        await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${config.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await bootstrap.end();
        const pool = mysql.createPool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            waitForConnections: true,
            connectionLimit: 10,
        });
        const store = new UserStore(pool);
        await store.ensureSchema();
        return store;
    }
    async ensureSchema() {
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) NOT NULL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(128) NOT NULL,
        avatar_data MEDIUMTEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX idx_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        const migrations = [
            'ALTER TABLE users ADD COLUMN avatar_data MEDIUMTEXT NULL',
            'ALTER TABLE users ADD COLUMN updated_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)',
        ];
        for (const sql of migrations) {
            try {
                await this.pool.query(sql);
            }
            catch {
                /* column already exists */
            }
        }
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token_hash CHAR(64) NOT NULL PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        used_at DATETIME(3) NULL,
        INDEX idx_password_reset_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    }
    async countUsers() {
        const [rows] = await this.pool.query('SELECT COUNT(*) AS cnt FROM users');
        return Number(rows[0]?.cnt ?? 0);
    }
    async register(email, password, displayName) {
        const normalized = email.trim().toLowerCase();
        if (!normalized.includes('@')) {
            throw new Error('Invalid email address');
        }
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        if (!displayName.trim()) {
            throw new Error('Display name is required');
        }
        const [existing] = await this.pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalized]);
        if (existing.length > 0) {
            throw new Error('Email already registered');
        }
        const id = randomUUID();
        const passwordHash = await bcrypt.hash(password, 10);
        const now = new Date();
        await this.pool.query(`INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)`, [id, normalized, passwordHash, displayName.trim(), now]);
        return { id, email: normalized, displayName: displayName.trim(), createdAt: now.toISOString() };
    }
    async login(email, password) {
        const normalized = email.trim().toLowerCase();
        const [rows] = await this.pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [normalized]);
        const row = rows[0];
        if (!row)
            return null;
        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok)
            return null;
        return rowToUser(row);
    }
    async findById(id) {
        const [rows] = await this.pool.query('SELECT id, email, password_hash, display_name, avatar_data, created_at, updated_at FROM users WHERE id = ? LIMIT 1', [id]);
        return rows[0] ? rowToUser(rows[0]) : null;
    }
    async updateProfile(id, updates) {
        const user = await this.findById(id);
        if (!user)
            throw new Error('User not found');
        const fields = [];
        const values = [];
        if (updates.displayName !== undefined) {
            const name = updates.displayName.trim();
            if (!name)
                throw new Error('Display name is required');
            fields.push('display_name = ?');
            values.push(name);
        }
        if (updates.avatarUrl !== undefined) {
            validateAvatar(updates.avatarUrl);
            fields.push('avatar_data = ?');
            values.push(updates.avatarUrl || null);
        }
        if (fields.length === 0)
            return user;
        values.push(id);
        await this.pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        const updated = await this.findById(id);
        if (!updated)
            throw new Error('User not found');
        return updated;
    }
    async changePassword(id, currentPassword, newPassword) {
        if (newPassword.length < 6) {
            throw new Error('New password must be at least 6 characters');
        }
        const [rows] = await this.pool.query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [id]);
        const row = rows[0];
        if (!row)
            throw new Error('User not found');
        const ok = await bcrypt.compare(currentPassword, row.password_hash);
        if (!ok)
            throw new Error('Current password is incorrect');
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    }
    async createPasswordResetToken(email) {
        const normalized = email.trim().toLowerCase();
        const [rows] = await this.pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalized]);
        const row = rows[0];
        if (!row)
            return null;
        const token = randomUUID();
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await this.pool.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [row.id]);
        await this.pool.query(`INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)`, [tokenHash, row.id, expiresAt]);
        return token;
    }
    async resetPasswordWithToken(token, newPassword) {
        if (newPassword.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        const tokenHash = createHash('sha256').update(token.trim()).digest('hex');
        const [rows] = await this.pool.query(`SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1`, [tokenHash]);
        const row = rows[0];
        if (!row || row.used_at) {
            throw new Error('Invalid or expired reset link');
        }
        if (new Date(row.expires_at).getTime() < Date.now()) {
            throw new Error('Invalid or expired reset link');
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, row.user_id]);
        await this.pool.query('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP(3) WHERE token_hash = ?', [tokenHash]);
    }
    /** Create demo account or reset its password (deploy-safe). */
    async ensureDemoAccount(email, password, displayName) {
        const normalized = email.trim().toLowerCase();
        const passwordHash = await bcrypt.hash(password, 10);
        const [rows] = await this.pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalized]);
        if (rows.length === 0) {
            const id = randomUUID();
            const now = new Date();
            await this.pool.query(`INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)`, [id, normalized, passwordHash, displayName.trim(), now]);
            return { id, email: normalized, displayName: displayName.trim(), createdAt: now.toISOString() };
        }
        await this.pool.query('UPDATE users SET password_hash = ?, display_name = ? WHERE email = ?', [passwordHash, displayName.trim(), normalized]);
        const [updated] = await this.pool.query('SELECT id, email, display_name, created_at FROM users WHERE email = ? LIMIT 1', [normalized]);
        const row = updated[0];
        return rowToUser(row);
    }
    async close() {
        await this.pool.end();
    }
}
export function mysqlConfigFromEnv() {
    return {
        host: process.env.MYSQL_HOST ?? '127.0.0.1',
        port: Number(process.env.MYSQL_PORT ?? 3306),
        user: process.env.MYSQL_USER ?? 'root',
        password: process.env.MYSQL_PASSWORD ?? '',
        database: process.env.MYSQL_DATABASE ?? 'pixelium_consent',
    };
}
//# sourceMappingURL=user-store.js.map
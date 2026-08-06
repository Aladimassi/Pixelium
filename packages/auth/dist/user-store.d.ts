import type { ProfileUpdate, User } from './types.js';
export interface MySqlConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}
export declare class UserStore {
    private pool;
    private constructor();
    static create(config: MySqlConfig): Promise<UserStore>;
    private ensureSchema;
    countUsers(): Promise<number>;
    register(email: string, password: string, displayName: string): Promise<User>;
    login(email: string, password: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    updateProfile(id: string, updates: ProfileUpdate): Promise<User>;
    changePassword(id: string, currentPassword: string, newPassword: string): Promise<void>;
    close(): Promise<void>;
}
export declare function mysqlConfigFromEnv(): MySqlConfig;

import { UserStore } from './user-store.js';
import type { User } from './types.js';
export { signToken, verifyToken } from './jwt.js';
export { UserStore, mysqlConfigFromEnv } from './user-store.js';
export { createAuthMiddleware, optionalAuth, type AuthRequest } from './middleware.js';
export type { User, AuthTokenPayload } from './types.js';
export declare function initAuth(): Promise<UserStore>;
export declare function getUserStore(): UserStore;
export declare function isAuthReady(): boolean;
export declare function registerUser(email: string, password: string, displayName: string): Promise<{
    user: User;
    token: string;
}>;
export declare function loginUser(email: string, password: string): Promise<{
    user: User;
    token: string;
} | null>;
export declare function updateUserProfile(userId: string, updates: {
    displayName?: string;
    avatarUrl?: string | null;
}): Promise<{
    user: User;
    token: string;
}>;
export declare function changeUserPassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;

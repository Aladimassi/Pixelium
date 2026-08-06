import { signToken } from './jwt.js';
import { UserStore, mysqlConfigFromEnv } from './user-store.js';
export { signToken, verifyToken } from './jwt.js';
export { UserStore, mysqlConfigFromEnv } from './user-store.js';
export { createAuthMiddleware, optionalAuth } from './middleware.js';
let userStore = null;
export async function initAuth() {
    if (userStore)
        return userStore;
    userStore = await UserStore.create(mysqlConfigFromEnv());
    console.log(`👤 User store: MySQL (${mysqlConfigFromEnv().database})`);
    const demo = await userStore.ensureDemoAccount('demo@pixelium.com', 'demo123', 'Demo User');
    console.log(`   Demo account ready: ${demo.email} / demo123`);
    return userStore;
}
export function getUserStore() {
    if (!userStore) {
        throw new Error('Auth not initialized — call initAuth() first');
    }
    return userStore;
}
export function isAuthReady() {
    return userStore !== null;
}
export async function registerUser(email, password, displayName) {
    const store = getUserStore();
    const user = await store.register(email, password, displayName);
    return { user, token: signToken(user) };
}
export async function loginUser(email, password) {
    const store = getUserStore();
    const user = await store.login(email, password);
    if (!user)
        return null;
    return { user, token: signToken(user) };
}
export async function updateUserProfile(userId, updates) {
    const store = getUserStore();
    const user = await store.updateProfile(userId, updates);
    return { user, token: signToken(user) };
}
export async function changeUserPassword(userId, currentPassword, newPassword) {
    const store = getUserStore();
    await store.changePassword(userId, currentPassword, newPassword);
}
//# sourceMappingURL=index.js.map
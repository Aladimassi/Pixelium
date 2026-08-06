import { verifyToken } from './jwt.js';
export function createAuthMiddleware(userStore) {
    return async function requireAuth(req, res, next) {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Login required' });
        }
        const token = header.slice(7);
        const payload = verifyToken(token);
        if (!payload) {
            return res.status(401).json({ error: 'Session expired — please log in again' });
        }
        const user = await userStore.findById(payload.sub);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        req.user = user;
        next();
    };
}
export function optionalAuth(userStore) {
    return async function (req, _res, next) {
        const header = req.headers.authorization;
        if (header?.startsWith('Bearer ')) {
            const payload = verifyToken(header.slice(7));
            if (payload) {
                req.user = (await userStore.findById(payload.sub)) ?? undefined;
            }
        }
        next();
    };
}
//# sourceMappingURL=middleware.js.map
import jwt from 'jsonwebtoken';
const DEFAULT_SECRET = 'pixelium-dev-jwt-secret-change-in-production';
function secret() {
    return process.env.JWT_SECRET ?? DEFAULT_SECRET;
}
export function signToken(user) {
    const payload = {
        sub: user.id,
        email: user.email,
        name: user.displayName,
    };
    return jwt.sign(payload, secret(), { expiresIn: '7d' });
}
export function verifyToken(token) {
    try {
        return jwt.verify(token, secret());
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=jwt.js.map
import type { AuthTokenPayload, User } from './types.js';
export declare function signToken(user: User): string;
export declare function verifyToken(token: string): AuthTokenPayload | null;

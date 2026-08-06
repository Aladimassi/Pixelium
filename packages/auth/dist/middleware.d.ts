import type { Request, Response, NextFunction } from 'express';
import type { UserStore } from './user-store.js';
import type { User } from './types.js';
export interface AuthRequest extends Request {
    user?: User;
}
export declare function createAuthMiddleware(userStore: UserStore): (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare function optionalAuth(userStore: UserStore): (req: AuthRequest, _res: Response, next: NextFunction) => Promise<void>;

export interface User {
    id: string;
    email: string;
    displayName: string;
    createdAt: string;
    avatarUrl?: string;
}
export interface ProfileUpdate {
    displayName?: string;
    avatarUrl?: string | null;
}
export interface AuthTokenPayload {
    sub: string;
    email: string;
    name: string;
}
export interface AuthenticatedRequest {
    user?: User;
}

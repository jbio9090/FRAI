export type User = {
    id: number;
    name: string;
    email: string;
    profile?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    role: string;
    [key: string]: unknown; 
    deleted_at?: string | null;
};

export type Auth = {
    user: User;
};

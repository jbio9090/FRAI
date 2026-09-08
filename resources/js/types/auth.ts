export type User = {
    id: number;
    name: string;
    email: string;
    profile?: string;
    position?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    role: string;
    roles?: string[];
    [key: string]: unknown; 
    deleted_at?: string | null;
};

export type UserDetail = User & {
    is_active: boolean;
    created_at: string;
    deleted_at?: string | null;
};

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
};

export type AuditLog = {
    id: number;
    user?: { name?: string; profile?: string };
    created_at: string;
    description?: string;
    event: string;
    properties?: Record<string, unknown>;
};

import type { Request } from './request';

export type AccountsDetailProps = {
    user: UserDetail;
    audit_logs: Paginated<AuditLog>;
    requests: Paginated<Request>;
    audit_events: { value: string; label: string }[];
    request_statuses: { value: string; label: string }[];
    can_edit_own: boolean;
};

export type Auth = {
    user: User;
};

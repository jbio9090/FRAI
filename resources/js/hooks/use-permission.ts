import { usePage } from '@inertiajs/react';

interface AuthUser {
    id: number;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
}

interface PageProps {
    auth: {
        user: AuthUser | null;
    };
}

export function usePermission() {
    const { auth } = usePage<PageProps>().props;

    const hasPermission = (permission: string): boolean => {
        return auth.user?.permissions?.includes(permission) ?? false;
    };

    const hasRole = (role: string): boolean => {
        return auth.user?.roles?.includes(role) ?? false;
    };

    const hasAnyPermission = (permissions: string[]): boolean => {
        return permissions.some(permission => hasPermission(permission));
    };

    const hasAllPermissions = (permissions: string[]): boolean => {
        return permissions.every(permission => hasPermission(permission));
    };

    return {
        user: auth.user,
        hasPermission,
        hasRole,
        hasAnyPermission,
        hasAllPermissions,
    };
}
"use client";

import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  roles: Array<string | { name?: string }>;
  position?: string | null;
  variant?: "sm" | "default" | "lg";
  className?: string;
}

const variantStyles = {
  sm: "px-1.5 py-0.5 text-[11px]",
  default: "px-2 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
} as const;

function formatRole(role: string | { name?: string }): string | null {
  const roleStr = typeof role === 'string' ? role : role?.name ?? '';
  if (!roleStr) return null;
  return roleStr.charAt(0).toUpperCase() + roleStr.slice(1).toLowerCase();
}

export function RoleBadge({ roles, position, variant = "default", className }: RoleBadgeProps) {
  if (!roles?.length) return null;

  const trimmedPosition = position?.trim();

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {roles.map((role, idx) => {
        const displayRole = formatRole(role);
        if (!displayRole) return null;
        const displayText = idx === 0 && trimmedPosition ? `${displayRole} - ${trimmedPosition}` : displayRole;
        return (
          <span
            key={`${displayRole}-${idx}`}
            className={cn(
              "inline-flex items-center rounded-[4px] font-semibold whitespace-nowrap bg-[var(--ads-neutral-bg)] text-[var(--ads-neutral)]",
              variantStyles[variant],
            )}
          >
            {displayText}
          </span>
        );
      })}
    </div>
  );
}
"use client";

import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  roles: string[];
  variant?: "sm" | "default" | "lg";
  className?: string;
}

const variantStyles = {
  sm: "px-1.5 py-0.5 text-[11px]",
  default: "px-2 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
} as const;

export function RoleBadge({ roles, variant = "default", className }: RoleBadgeProps) {
  if (!roles?.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {roles.map((role, idx) => {
        const roleStr = typeof role === 'string' ? role : String((role as any)?.name || role || '');
        if (!roleStr) return null;
        return (
          <span
            key={`${roleStr}-${idx}`}
            className={cn(
              "inline-flex items-center rounded-[4px] font-semibold whitespace-nowrap bg-[var(--ads-neutral-bg)] text-[var(--ads-neutral)]",
              variantStyles[variant],
            )}
          >
            {roleStr.charAt(0).toUpperCase() + roleStr.slice(1).toLowerCase()}
          </span>
        );
      })}
    </div>
  );
}
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatTileProps {
    label: string;
    value: number | string;
    sub?: string;
    icon: LucideIcon;
    variant?: 'default' | 'accent' | 'warning';
    className?: string;
}

const variantStyles = {
    default: 'border-border bg-card text-foreground',
    accent: 'border-primary bg-primary text-primary-foreground dark:text-foreground',
    warning: 'border-[var(--ads-amber)]/50 bg-[var(--ads-amber-bg)] text-[var(--ads-amber)]',
} as const;

const iconStyles = {
    default: 'bg-muted text-muted-foreground',
    accent: 'bg-primary-foreground/15 text-primary-foreground dark:bg-foreground/15 dark:text-foreground',
    warning: 'bg-[var(--ads-amber)]/15 text-[var(--ads-amber)]',
} as const;

const subStyles = {
    default: 'text-muted-foreground',
    accent: 'text-primary-foreground/80 dark:text-foreground/80',
    warning: 'text-[var(--ads-amber)]/80',
} as const;

export default function StatTile({
    label,
    value,
    sub,
    icon: Icon,
    variant = 'default',
    className,
}: StatTileProps) {
    return (
        <div className={cn('flex items-center gap-3 rounded-lg border p-4', variantStyles[variant], className)}>
            <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', iconStyles[variant])}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-xs font-medium leading-tight opacity-90">{label}</span>
                <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-semibold leading-none tabular-nums">{value}</span>
                    {sub && (
                        <span className={cn('truncate text-xs leading-tight', subStyles[variant])}>{sub}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

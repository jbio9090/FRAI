import { cn } from '@/lib/utils';

export type StatusTone = 'ok' | 'amber' | 'danger' | 'neutral';

export const STATUS_TONES: Record<string, StatusTone> = {
    approved: 'ok',
    conditionally_approved: 'ok',
    partially_approved: 'amber',
    for_reschedule: 'amber',
    pending: 'neutral',
    denied: 'danger',
    on_hold: 'danger',
};

export function toneForStatus(status: string): StatusTone {
    const key = status
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
    return STATUS_TONES[key] ?? 'neutral';
}

interface StatusBadgeProps {
    status: string;
    className?: string;
    dot?: boolean;
}

/**
 * Single tokenized status badge. Colors come from the scoped blueprint
 * tokens (`--bp-*`) so they adapt to light/dark automatically.
 */
export default function StatusBadge({ status, className, dot = true }: StatusBadgeProps) {
    const tone = toneForStatus(status);
    const style = {
        color: `var(--bp-${tone})`,
        background: `var(--bp-${tone}-bg)`,
        borderColor: `color-mix(in oklab, var(--bp-${tone}) 45%, transparent)`,
    } as React.CSSProperties;

    return (
        <span
            style={style}
            className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider',
                className,
            )}
        >
            {dot && <span className="size-1.5 rounded-full" style={{ background: 'currentColor' }} />}
            <span>{status}</span>
        </span>
    );
}

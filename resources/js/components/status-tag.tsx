import { cn } from '@/lib/utils';

interface StatusTagProps {
    requestStatus: string;
    variant?: 'default' | 'small' | 'large';
}

const STATUS_TONES: Record<string, 'ok' | 'amber' | 'danger' | 'neutral'> = {
    Approved: 'ok',
    'Conditionally Approved': 'ok',
    Pending: 'neutral',
    Denied: 'danger',
    'On Hold': 'danger',
    'For Reschedule': 'amber',
    'Partially Approved': 'amber',
};

const toneStyles = {
    ok: 'bg-[var(--ads-ok-bg)] text-[var(--ads-ok)]',
    amber: 'bg-[var(--ads-amber-bg)] text-[var(--ads-amber)]',
    danger: 'bg-[var(--ads-danger-bg)] text-[var(--ads-danger)]',
    neutral: 'bg-[var(--ads-neutral-bg)] text-[var(--ads-neutral)]',
} as const;

export default function StatusTag({ requestStatus, variant = 'default' }: StatusTagProps) {
    const tone = STATUS_TONES[requestStatus] ?? 'neutral';

    return (
        <span
            className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-[4px] font-semibold whitespace-nowrap',
                toneStyles[tone],
                variant === 'small'
                    ? 'px-1.5 py-0.5 text-[11px]'
                    : variant === 'large'
                      ? 'px-3 py-1 text-sm'
                      : 'px-2 py-0.5 text-xs',
            )}
        >
            <span className="size-1.5 shrink-0 rounded-full bg-current" />
            {requestStatus}
        </span>
    );
}

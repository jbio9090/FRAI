import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusTagProps {
    requestStatus: string;
    variant?: 'default' | 'small' | 'large';
}

const STATUS_TONES: Record<string, 'ok' | 'amber' | 'danger' | 'neutral' | 'expired'> = {
    Approved: 'ok',
    'Conditionally Approved': 'ok',
    Pending: 'neutral',
    Denied: 'danger',
    'On Hold': 'danger',
    'For Reschedule': 'amber',
    'Partially Approved': 'amber',
    Expired: 'expired',
};

const toneStyles = {
    ok: 'bg-[var(--ads-ok-bg)] text-[var(--ads-ok)]',
    amber: 'bg-[var(--ads-amber-bg)] text-[var(--ads-amber)]',
    danger: 'bg-[var(--ads-danger-bg)] text-[var(--ads-danger)]',
    neutral: 'bg-[var(--ads-neutral-bg)] text-[var(--ads-neutral)]',
    expired: 'bg-[var(--ads-expired-bg)] text-[var(--ads-expired)]',
} as const;

export default function StatusTag({ requestStatus, variant = 'default' }: StatusTagProps) {
    const tone = STATUS_TONES[requestStatus] ?? 'neutral';

    return (
        <span
            className={cn(
                'inline-flex w-fit max-w-full min-w-0 shrink items-center gap-1.5 overflow-hidden rounded-[4px] font-semibold text-ellipsis whitespace-nowrap',
                toneStyles[tone],
                variant === 'small' ? 'px-1.5 py-0.5 text-[11px]' : variant === 'large' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs',
            )}
        >
            {tone === 'expired' ? <X className="size-2 shrink-0" /> : <span className="size-1.5 shrink-0 rounded-full bg-current" />}
            {requestStatus}
        </span>
    );
}

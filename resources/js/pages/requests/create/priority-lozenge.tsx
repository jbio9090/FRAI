import { cn } from '@/lib/utils';
import { PRIORITY_ACCENT, PRIORITY_LABELS } from '@/types/request';

export function PriorityLozenge({ priority, className }: { priority: number; className?: string }) {
    const accent = PRIORITY_ACCENT[priority] ?? PRIORITY_ACCENT[0];
    return (
        <span
            className={cn('inline-flex w-fit items-center rounded-[4px] px-2 py-0.5 text-xs font-semibold whitespace-nowrap', className)}
            style={{ backgroundColor: accent.fill, color: accent.ink }}
        >
            {PRIORITY_LABELS[priority as 0 | 1 | 2 | 3]}
        </span>
    );
}

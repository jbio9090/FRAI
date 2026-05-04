import { cn } from '@/lib/utils';

interface StatusTagProps {
    requestStatus: string;
    variant?: 'default' | 'small';
}

export default function StatusTag({ requestStatus, variant = 'default' }: StatusTagProps) {
    const wtc = (status: string) => {
        let statusColor;
        switch (status) {
            case 'Approved':
                statusColor = 'bg-primary/20 border-primary text-primary dark:bg-blue-400/15 dark:border-blue-400 dark:text-blue-300';
                break;
            case 'Pending':
                statusColor = 'border-foreground bg-gray-100/20';
                break;
            case 'Denied':
                statusColor = 'bg-destructive/20 border-destructive text-destructive';
                break;
            case 'Conditionally Approved':
                statusColor = 'bg-primary/20 border-primary/70 text-primary dark:bg-blue-400/10 dark:border-blue-400/60 dark:text-blue-300';
                break;
            case 'For Reschedule':
                statusColor = 'bg-slate-500/20 border-slate-500 text-slate-600 dark:text-slate-400';
                break;
            case 'Partially Approved':
                statusColor = 'bg-slate-500/20 border-slate-500 text-slate-600 dark:text-slate-400';
                break;
        }
        return statusColor;
    };

    return (
        <div
            className={cn(
                'flex w-fit gap-1 rounded-full border font-semibold',
                variant === 'small' ? 'px-1 text-xs' : 'px-2 py-1 text-xs',
                wtc(requestStatus),
            )}
        >
            <span>{requestStatus}</span>
        </div>
    );
}
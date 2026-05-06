import { Calendar, Clock, Sparkles } from 'lucide-react';
import moment from 'moment';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import StatusTag from '../status-tag';
import type { Request } from '@/types/request';

interface RecommendationPanelProps {
    request: Request;
    isLoading: boolean;
    variant?: 'card' | 'page';
}

const ACTION_COLORS: Record<string, string> = {
    Approved: 'text-primary dark:text-blue-300',
    'Conditionally Approved': 'text-primary/70 dark:text-blue-300/70',
    Denied: 'text-destructive',
    'For Reschedule': 'text-slate-600 dark:text-slate-400',
    'Partially Approved': 'text-slate-600 dark:text-slate-400',
};

function formatDate(date: string) {
    return moment(date, ['YYYY-MM-DD', moment.ISO_8601]).format('MMM D, YYYY');
}

function formatTime(time: string) {
    return moment(time, 'HH:mm:ss').format('h:mm A');
}

export function RecommendationPanel({ request, isLoading, variant = 'card' }: RecommendationPanelProps) {
    const verdictColor = ACTION_COLORS[request.recommended_action ?? ''] ?? 'text-foreground';

    return (
        <div className={cn('flex flex-col gap-3', variant === 'page' && '')}>
            {/* Overall verdict card */}
            <div className="rounded-xl border border-dashed p-5">
                {isLoading ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                            <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                        </div>
                        <div className="mx-auto h-8 w-48 animate-pulse rounded bg-muted" />
                        <div className="flex flex-col items-center gap-1.5 px-2">
                            <div className="h-3 w-full animate-pulse rounded bg-muted" />
                            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                        </div>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="flex flex-col gap-2"
                    >
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Sparkles size={15} />
                            <span className="text-sm">Overall Recommendation</span>
                        </div>
                        <p className={cn('text-center text-2xl font-bold', verdictColor)}>{request.recommended_action ?? '—'}</p>
                        {request.recommended_action_reason && (
                            <p className="px-2 text-center text-sm leading-relaxed text-muted-foreground">{request.recommended_action_reason}</p>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Per-facility breakdown */}
            {request.request_facilities?.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Per-Facility Breakdown</p>
                    <div className={cn('flex flex-col gap-2', variant === 'page' && 'grid-cols-2 md:grid')}>
                        {request.request_facilities.map((rf) => {
                            const facility = request.facilities.find((f) => f.id === rf.facility_id);
                            const facilityName = facility?.name ?? `Facility #${rf.facility_id}`;
                            const rfStatus = rf.ai_recommended_status;
                            const rfReason = rf.ai_recommendation_reason;

                            return (
                                <div key={rf.id} className="rounded-lg border bg-muted/30 px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <span className="truncate text-sm font-semibold">{facilityName}</span>
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Calendar size={11} />
                                                {formatDate(rf.date_requested)}
                                                <Clock size={11} className="ml-1" />
                                                {formatTime(rf.time_start)} – {formatTime(rf.time_end)}
                                            </span>
                                        </div>
                                        {isLoading || !rfStatus ? (
                                            <div className="h-5 w-24 shrink-0 animate-pulse rounded-full bg-muted" />
                                        ) : (
                                            <StatusTag requestStatus={rfStatus} variant="small" />
                                        )}
                                    </div>
                                    {isLoading ? (
                                        <div className="mt-1.5 h-3 w-3/4 animate-pulse rounded bg-muted" />
                                    ) : rfReason ? (
                                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{rfReason}</p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
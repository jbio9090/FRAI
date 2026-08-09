import { Calendar, Clock, Sparkles } from 'lucide-react';
import moment from 'moment';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { Request } from '@/types/request';
import StatusTag from '../status-tag';

interface RecommendationPanelProps {
    request: Request;
    isLoading: boolean;
    variant?: 'card' | 'page';
}

function formatDate(date: string) {
    return moment(date, ['YYYY-MM-DD', moment.ISO_8601]).format('MMM D, YYYY');
}

function formatTime(time: string) {
    return moment(time, 'HH:mm:ss').format('h:mm A');
}

export function RecommendationPanel({ request, isLoading, variant = 'card' }: RecommendationPanelProps) {
    return (
        <div className="flex flex-col gap-3">
            {/* Overall verdict card */}
            <div className="ads-card flex flex-col gap-3 p-5">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--ads-ok)]" />
                    <span className="ads-eyebrow">Overall recommendation</span>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center gap-3 py-1">
                        <div className="h-8 w-52 animate-pulse rounded-[4px] bg-muted" />
                        <div className="h-3 w-full max-w-md animate-pulse rounded bg-muted" />
                        <div className="h-3 w-4/5 max-w-sm animate-pulse rounded bg-muted" />
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="flex flex-col items-center gap-2 py-1"
                    >
                        <StatusTag requestStatus={request.recommended_action ?? 'Pending'} variant="large" />
                        {request.recommended_action_reason && (
                            <p className="max-w-lg text-center text-sm leading-relaxed text-muted-foreground">
                                {request.recommended_action_reason}
                            </p>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Per-facility breakdown */}
            {request.request_facilities?.length > 0 && (
                <div className="flex flex-col gap-2">
                    <span className="ads-eyebrow">Per-facility breakdown</span>
                    <div className={cn('flex flex-col gap-2', variant === 'page' && 'md:grid md:grid-cols-2')}>
                        {request.request_facilities.map((rf) => {
                            const facility = request.facilities.find((f) => f.id === rf.facility_id);
                            const facilityName = facility?.name ?? `Facility #${rf.facility_id}`;
                            const rfStatus = rf.ai_recommended_status;
                            const rfReason = rf.ai_recommendation_reason;

                            return (
                                <div key={rf.id} className="ads-card flex flex-col gap-1.5 p-4">
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
                                            <div className="h-5 w-24 shrink-0 animate-pulse rounded-[4px] bg-muted" />
                                        ) : (
                                            <StatusTag requestStatus={rfStatus} variant="small" />
                                        )}
                                    </div>
                                    {isLoading ? (
                                        <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-muted" />
                                    ) : rfReason ? (
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rfReason}</p>
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

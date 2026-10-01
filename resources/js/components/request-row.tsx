import { Link } from '@inertiajs/react';
import { Calendar, MessageCircle, Paperclip } from 'lucide-react';
import moment from 'moment';
import { formatBookingDate, formatBookingTimeRange } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { PRIORITY_LABELS, PRIORITY_ACCENT, type Request } from '@/types/request';
import AvatarWithInitials from './avatar-with-initials';
import StatusTag from './status-tag';

const MAX_LISTED_FACILITIES = 3;

export default function RequestRow({ request, className }: { request: Request; className?: string }) {
    const requestFacilities = request.request_facilities ?? [];
    const hiddenFacilityCount = Math.max(requestFacilities.length - MAX_LISTED_FACILITIES, 0);

    const facilityLabel =
        requestFacilities.length > 0
            ? requestFacilities
                  .slice(0, MAX_LISTED_FACILITIES)
                  .map((rf) => {
                      const facilityName = request.facilities?.find((f) => f.id === rf.facility_id)?.name ?? `Facility #${rf.facility_id}`;

                      return `${facilityName} · ${formatBookingDate(rf.date_requested)}, ${formatBookingTimeRange(rf.time_start, rf.time_end)}`;
                  })
                  .join(', ') + (hiddenFacilityCount > 0 ? ` · +${hiddenFacilityCount} more` : '')
            : 'No facility';

    const commentCount = request.comments?.length ?? 0;
    const fileCount = request.files?.length ?? 0;
    const accent = PRIORITY_ACCENT[request.priority_level] ?? PRIORITY_ACCENT[0];

    return (
        <Link
            href={route('requests.detail', request.id)}
            className={cn(
                'flex w-full max-w-full min-w-0 items-center gap-3 overflow-hidden border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/50',
                className,
            )}
        >
            <AvatarWithInitials username={request.user?.name ?? '?'} avatarSrc={request.user?.profile} size="sm" className="shrink-0" />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-foreground">{request.title}</p>

                    <span
                        className="hidden shrink-0 items-center rounded-[4px] px-2 py-0.5 text-[11px] font-semibold sm:inline-flex"
                        style={{ backgroundColor: accent.fill, color: accent.ink }}
                    >
                        {PRIORITY_LABELS[request.priority_level]}
                    </span>
                </div>

                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {request.user?.name} · {facilityLabel}
                </p>
            </div>

            <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground md:flex">
                {commentCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {commentCount}
                    </span>
                )}
                {fileCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {fileCount}
                    </span>
                )}
            </div>

            <div className="flex max-w-full min-w-0 shrink-0 items-center gap-2 sm:gap-3">
                <span className="hidden items-center gap-1 text-xs text-muted-foreground xl:inline-flex">
                    <Calendar className="h-3.5 w-3.5" />
                    submitted {moment(request.created_at).fromNow()}
                </span>
                <StatusTag requestStatus={request.status} />
            </div>
        </Link>
    );
}

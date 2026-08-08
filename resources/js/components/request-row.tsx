import { Link } from '@inertiajs/react';
import { Calendar, MessageCircle, Paperclip } from 'lucide-react';
import moment from 'moment';
import { cn } from '@/lib/utils';
import { PRIORITY_LABELS, PRIORITY_ACCENT, type Request } from '@/types/request';
import AvatarWithInitials from './avatar-with-initials';
import StatusTag from './status-tag';

export default function RequestRow({ request, className }: { request: Request; className?: string }) {
    const facilityNames = request.facilities?.map((f) => f.name).filter(Boolean) ?? [];
    const facilityLabel = facilityNames.length > 0 ? facilityNames.slice(0, 2).join(', ') : 'No facility';
    const commentCount = request.comments?.length ?? 0;
    const fileCount = request.files?.length ?? 0;
    const accent = PRIORITY_ACCENT[request.priority_level] ?? PRIORITY_ACCENT[0];

    return (
        <Link
            href={route('requests.detail', request.id)}
            className={cn('flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/50', className)}
        >
            <span
                className="hidden shrink-0 items-center rounded-[4px] px-2 py-0.5 text-[11px] font-semibold sm:inline-flex"
                style={{ backgroundColor: accent.fill, color: accent.ink }}
            >
                {PRIORITY_LABELS[request.priority_level]}
            </span>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{request.title}</p>
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

            <div className="flex shrink-0 items-center gap-3">
                <span className="hidden items-center gap-1 text-xs text-muted-foreground xl:inline-flex">
                    <Calendar className="h-3.5 w-3.5" />
                    {moment(request.created_at).fromNow()}
                </span>
                <StatusTag requestStatus={request.status} />
                <AvatarWithInitials username={request.user?.name ?? '?'} avatarSrc={request.user?.profile} size="sm" className="hidden sm:block" />
            </div>
        </Link>
    );
}

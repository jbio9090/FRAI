import { Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    BookMarked,
    Calendar,
    CirclePause,
    CirclePlus,
    GraduationCap,
    Landmark,
    MessageCircle,
    Paperclip,
    Search,
    Sparkles,
    UsersRound,
} from 'lucide-react';
import moment from 'moment';
import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChamferCard from '@/components/design/ChamferCard';
import PreviewLayout from '@/components/design/PreviewLayout';
import StatusBadge from '@/components/design/StatusBadge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import type { CarouselApi } from '@/components/ui/carousel';
import { Input } from '@/components/ui/input';
import getInitials from '@/lib/getInitials';
import { cn } from '@/lib/utils';
import type { SharedData } from '@/types';
import { PRIORITY_LABELS } from '@/types/request';

const PRIORITY_ICONS = {
    0: BookMarked,
    1: UsersRound,
    2: GraduationCap,
    3: Landmark,
} as const;

const PRIORITY_TINT = {
    0: '',
    1: 'border-[var(--border)] text-[var(--muted-foreground)]',
    2: 'text-[var(--bp-ok)] border-[var(--bp-ok)]/40 bg-[var(--bp-ok-bg)]',
    3: 'text-[var(--bp-amber)] border-[var(--bp-amber)]/40 bg-[var(--bp-amber-bg)]',
} as const;

interface SampleRequest {
    id: number;
    title: string;
    status: string;
    priority_level: 0 | 1 | 2 | 3;
    on_hold: boolean;
    conflicts: number;
    user: { name: string };
    updated_at: string;
    facilities: number;
    comments: number;
    files: number;
}

const QUEUE: SampleRequest[] = [
    {
        id: 184,
        title: 'Gamecon 2026',
        status: 'Pending',
        priority_level: 3,
        on_hold: false,
        conflicts: 0,
        user: { name: 'Maria Santos' },
        updated_at: moment().subtract(3, 'hours').toISOString(),
        facilities: 2,
        comments: 0,
        files: 1,
    },
    {
        id: 183,
        title: 'College Week Opening',
        status: 'Approved',
        priority_level: 2,
        on_hold: false,
        conflicts: 2,
        user: { name: 'Jose Ramirez' },
        updated_at: moment().subtract(1, 'days').toISOString(),
        facilities: 1,
        comments: 3,
        files: 0,
    },
    {
        id: 182,
        title: 'Faculty Seminar Booking',
        status: 'For Reschedule',
        priority_level: 1,
        on_hold: true,
        conflicts: 0,
        user: { name: 'Ana Lim' },
        updated_at: moment().subtract(2, 'days').toISOString(),
        facilities: 1,
        comments: 1,
        files: 1,
    },
    {
        id: 181,
        title: 'Orchestra Practice',
        status: 'Denied',
        priority_level: 0,
        on_hold: false,
        conflicts: 0,
        user: { name: 'Paolo Cruz' },
        updated_at: moment().subtract(3, 'days').toISOString(),
        facilities: 1,
        comments: 0,
        files: 0,
    },
];

const CHART_DATA = [
    { day: 'Sat', requests: 9 },
    { day: 'Sun', requests: 4 },
    { day: 'Mon', requests: 12 },
    { day: 'Tue', requests: 10 },
    { day: 'Wed', requests: 16 },
    { day: 'Thu', requests: 11 },
    { day: 'Fri', requests: 14 },
];

const TABLE_ROWS = [
    { id: 'R-2026-0184', title: 'Gamecon 2026', facility: 'Auditorium', date: 'Aug 12', status: 'Pending' },
    { id: 'R-2026-0183', title: 'College Week Opening', facility: 'Covered Court', date: 'Aug 10', status: 'Approved' },
    { id: 'R-2026-0182', title: 'Faculty Seminar Booking', facility: 'Room 204', date: 'Aug 14', status: 'For Reschedule' },
    { id: 'R-2026-0181', title: 'Orchestra Practice', facility: 'Music Hall', date: 'Aug 11', status: 'Denied' },
];

function StatTile({
    label,
    value,
    caption,
    accent = false,
}: {
    label: string;
    value: string;
    caption: string;
    accent?: boolean;
}) {
    return (
        <ChamferCard plain className={cn('bg-[var(--card)]', accent && 'bg-[var(--primary)]')}>
            <div className={cn('flex h-full flex-col justify-between p-5', accent ? 'text-white' : 'text-[var(--card-foreground)]')}>
                <p
                    className={cn(
                        'text-[10px] font-semibold uppercase tracking-[0.16em]',
                        accent ? 'text-white/70' : 'text-[var(--muted-foreground)]',
                    )}
                >
                    {label}
                </p>
                <p className="mt-4 font-mono text-4xl font-bold tracking-tight">{value}</p>
                <p className={cn('mt-2 text-xs', accent ? 'text-white/70' : 'text-[var(--muted-foreground)]')}>{caption}</p>
            </div>
        </ChamferCard>
    );
}

function QueueCard({ request, className }: { request: SampleRequest; className?: string }) {
    const PriorityIcon = PRIORITY_ICONS[request.priority_level];
    const priorityTint = PRIORITY_TINT[request.priority_level];
    const canApprove = request.status === 'Pending' || request.status === 'For Reschedule';

    return (
        <ChamferCard className={cn('h-full', className)}>
            <div className="flex h-full flex-col gap-4 p-6">
                {/* Row 1: title + detail link */}
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-semibold tracking-tight text-[var(--card-foreground)]">{request.title}</h3>
                    <Button variant="outline" size="xs" aria-label="Open request" className="shrink-0">
                        <ArrowUpRight className="size-3.5" />
                    </Button>
                </div>

                {/* Row 2: status + priority + on-hold + conflicts */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={request.status} />

                    {request.priority_level > 0 && (
                        <span
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                                priorityTint,
                            )}
                        >
                            <PriorityIcon className="size-3" />
                            {PRIORITY_LABELS[request.priority_level]}
                        </span>
                    )}

                    {request.on_hold && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--bp-amber)]/40 bg-[var(--bp-amber-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--bp-amber)]">
                            <CirclePause className="size-3" />
                            On Hold
                        </span>
                    )}

                    {request.conflicts > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--bp-danger)]/40 bg-[var(--bp-danger-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--bp-danger)]">
                            <AlertTriangle className="size-3" />
                            {request.conflicts} conflict{request.conflicts !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Row 3: requester */}
                <div className="flex items-center gap-2">
                    <div className="flex size-7 shrink-0 items-center justify-center bg-[var(--secondary)] text-[11px] font-semibold text-[var(--secondary-foreground)]">
                        {getInitials(request.user.name)}
                    </div>
                    <span className="text-sm text-[var(--card-foreground)]">{request.user.name}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">
                        Submitted {moment(request.updated_at).fromNow()}
                    </span>
                </div>

                {/* Row 4: meta counts */}
                <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1">
                        <Calendar className="size-3.5" />
                        {request.facilities} {request.facilities !== 1 ? 'facilities' : 'facility'}
                    </span>
                    {request.comments > 0 && (
                        <span className="flex items-center gap-1">
                            <MessageCircle className="size-3.5" />
                            {request.comments} {request.comments !== 1 ? 'comments' : 'comment'}
                        </span>
                    )}
                    {request.files > 0 && (
                        <span className="flex items-center gap-1">
                            <Paperclip className="size-3.5" />
                            {request.files} {request.files !== 1 ? 'files' : 'file'}
                        </span>
                    )}
                </div>

                {/* Row 5: actions (approvers, Pending / For Reschedule) */}
                {canApprove && (
                    <div className="mt-auto flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
                        <Button size="sm" className="h-8">
                            Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-8">
                            Deny
                        </Button>
                        <Button size="sm" variant="outline" className="h-8">
                            More
                        </Button>
                    </div>
                )}
            </div>
        </ChamferCard>
    );
}

export default function PreviewDashboard() {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const firstName = (user?.name ?? 'there').split(' ')[0];

    const [queueApi, setQueueApi] = useState<CarouselApi | null>(null);
    const [canScrollNext, setCanScrollNext] = useState(false);
    const [canScrollPrev, setCanScrollPrev] = useState(false);

    useEffect(() => {
        if (!queueApi) return;
        const update = () => {
            setCanScrollNext(queueApi.canScrollNext());
            setCanScrollPrev(queueApi.canScrollPrev());
        };
        update();
        queueApi.on('select', update);
        queueApi.on('reInit', update);
        return () => {
            queueApi.off('select', update);
            queueApi.off('reInit', update);
        };
    }, [queueApi]);

    return (
        <PreviewLayout crumb="preview">
            <div className="flex flex-col gap-10">
                {/* ── Header ─────────────────────────────────────────── */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                        <p className="bp-eyebrow">Dashboard · PLV General Services</p>
                        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                            Good {moment().format('a') === 'am' ? 'morning' : 'afternoon'}, {firstName}.
                        </h1>
                        <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                            {moment().format('dddd, MMM D · YYYY')}
                        </p>
                    </div>
                    <Link href={route('design.preview.create')}>
                        <Button className="gap-2">
                            <CirclePlus className="size-4" />
                            New Request
                        </Button>
                    </Link>
                </div>

                {/* ── Stats ──────────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-px lg:grid-cols-4">
                    <StatTile label="Pending Approvals" value="07" caption="across 5 facilities" accent />
                    <StatTile label="Approved · 7d" value="12" caption="+3 vs. last week" />
                    <StatTile label="Facilities" value="24" caption="9 buildings, 3 campuses" />
                    <StatTile label="Avg. Lead Time" value="2.3d" caption="submission → decision" />
                </div>

                {/* ── Queue ──────────────────────────────────────────── */}
                <section className="flex flex-col gap-4">
                    <Carousel
                        opts={{ align: 'start', dragFree: true, containScroll: 'trimSnaps' }}
                        className="w-full"
                        setApi={setQueueApi}
                    >
                        <div className="mb-4 flex items-end justify-between gap-4">
                            <div className="flex flex-col gap-0.5">
                                <p className="bp-eyebrow">Request Queue</p>
                                <h2 className="text-xl font-semibold tracking-tight">Attention &amp; approval queue</h2>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => queueApi?.scrollPrev()}
                                    disabled={!canScrollPrev}
                                    aria-label="Previous requests"
                                >
                                    <ArrowLeft className="size-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => queueApi?.scrollNext()}
                                    disabled={!canScrollNext}
                                    aria-label="Next requests"
                                >
                                    <ArrowRight className="size-4" />
                                </Button>
                            </div>
                        </div>

                        <CarouselContent className="-ml-4">
                            {QUEUE.map((r) => (
                                <CarouselItem key={r.id} className="pl-4 basis-auto">
                                    <QueueCard request={r} className="min-w-[400px] max-w-[400px]" />
                                </CarouselItem>
                            ))}
                            <CarouselItem className="pl-4 basis-auto">
                                <Link href={route('requests.index', { status: 'pending' })}>
                                    <div className="flex h-full min-h-[220px] w-[160px] flex-col items-center justify-center gap-2 border border-[var(--border)] text-sm font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]">
                                        <ArrowUpRight className="size-5" />
                                        <span>See All</span>
                                    </div>
                                </Link>
                            </CarouselItem>
                        </CarouselContent>
                    </Carousel>
                </section>

                {/* ── Chart + status legend ───────────────────────────── */}
                <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                    <ChamferCard size="lg">
                        <div className="flex h-full flex-col p-6">
                            <div className="flex items-baseline justify-between">
                                <div className="flex flex-col gap-0.5">
                                    <p className="bp-eyebrow">Request Volume</p>
                                    <h2 className="text-lg font-semibold tracking-tight">Last 7 days</h2>
                                </div>
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                                    <span className="size-2 bg-[var(--primary)]" />
                                    submissions
                                </span>
                            </div>
                            <div className="mt-6 h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={CHART_DATA} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                                        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
                                        <XAxis
                                            dataKey="day"
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            tick={{ fontFamily: 'JetBrains Mono', fontSize: 11, fill: 'var(--muted-foreground)' }}
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            allowDecimals={false}
                                            tick={{ fontFamily: 'JetBrains Mono', fontSize: 11, fill: 'var(--muted-foreground)' }}
                                        />
                                        <Tooltip
                                            cursor={{ stroke: 'var(--primary)', strokeWidth: 1 }}
                                            content={({ active, payload, label }) =>
                                                active && payload?.length ? (
                                                    <div className="border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-mono text-xs text-[var(--card-foreground)]">
                                                        <p className="mb-1 uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
                                                        <p>
                                                            <span className="mr-1 inline-block size-2 bg-[var(--primary)]" />
                                                            {payload[0].value} submissions
                                                        </p>
                                                    </div>
                                                ) : null
                                            }
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="requests"
                                            stroke="var(--primary)"
                                            strokeWidth={2}
                                            fill="var(--primary)"
                                            fillOpacity={0.07}
                                            dot={{ r: 2, fill: 'var(--primary)', strokeWidth: 0 }}
                                            activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </ChamferCard>

                    <ChamferCard>
                        <div className="flex h-full flex-col gap-4 p-6">
                            <div className="flex flex-col gap-0.5">
                                <p className="bp-eyebrow">Status Language</p>
                                <h2 className="text-lg font-semibold tracking-tight">One badge system</h2>
                            </div>
                            <p className="text-sm text-[var(--muted-foreground)]">
                                Every status is a tokenized badge. Approved stays in brand blue — green never appears.
                            </p>
                            <div className="flex flex-col items-start gap-2.5">
                                <StatusBadge status="Approved" />
                                <StatusBadge status="Conditionally Approved" />
                                <StatusBadge status="Pending" />
                                <StatusBadge status="For Reschedule" />
                                <StatusBadge status="Partially Approved" />
                                <StatusBadge status="Denied" />
                                <StatusBadge status="On Hold" />
                            </div>
                        </div>
                    </ChamferCard>
                </section>

                {/* ── Component showcase ──────────────────────────────── */}
                <section className="flex flex-col gap-4">
                    <div className="flex flex-col gap-0.5">
                        <p className="bp-eyebrow">Component Strip</p>
                        <h2 className="text-xl font-semibold tracking-tight">Controls on the new system</h2>
                    </div>

                    <ChamferCard size="lg">
                        <div className="flex flex-col gap-8 p-6">
                            <div className="flex flex-col gap-2">
                                <p className="bp-eyebrow">Buttons</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button>Primary</Button>
                                    <Button variant="outline">Outline</Button>
                                    <Button variant="secondary">Secondary</Button>
                                    <Button variant="ghost">Ghost</Button>
                                    <Button variant="destructive">Destructive</Button>
                                    <Button disabled>Disabled</Button>
                                    <Button size="sm">Small</Button>
                                    <Button size="xs">Tiny</Button>
                                    <Button size="icon" aria-label="Sparkles">
                                        <Sparkles className="size-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <p className="bp-eyebrow">Inputs</p>
                                <div className="grid max-w-md gap-3">
                                    <Input placeholder="Search requests…" className="bg-[var(--card)]" />
                                    <div className="flex items-center gap-2">
                                        <Search className="size-4 shrink-0 text-[var(--muted-foreground)]" />
                                        <Input placeholder="With leading icon" className="bg-[var(--card)]" />
                                    </div>
                                    <Input disabled placeholder="Disabled field" className="bg-[var(--card)]" />
                                    <Input
                                        placeholder="With error"
                                        className="border-[var(--bp-danger)] bg-[var(--card)]"
                                        aria-invalid
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <p className="bp-eyebrow">Table · hairline rules, mono IDs</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[560px] text-sm">
                                        <thead>
                                            <tr className="border-b border-[var(--border)] text-left">
                                                {['Request ID', 'Title', 'Facility', 'Date', 'Status'].map((h) => (
                                                    <th
                                                        key={h}
                                                        className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {TABLE_ROWS.map((row) => (
                                                <tr key={row.id} className="border-b border-[var(--border)]/70 last:border-0 hover:bg-[var(--muted)]/60">
                                                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">{row.id}</td>
                                                    <td className="px-3 py-2.5 font-medium">{row.title}</td>
                                                    <td className="px-3 py-2.5">{row.facility}</td>
                                                    <td className="px-3 py-2.5 font-mono text-xs">{row.date}</td>
                                                    <td className="px-3 py-2.5">
                                                        <StatusBadge status={row.status} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </ChamferCard>
                </section>

                <Link href={route('design.preview.create')} className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline">
                    Open the create-request mock <ArrowUpRight className="size-4" />
                </Link>
            </div>
        </PreviewLayout>
    );
}

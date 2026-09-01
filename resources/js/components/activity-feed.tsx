import {
    MessageSquare,
    Tag,
    UserPlus,
    CheckCircle,
    XCircle,
    Plus,
    Activity,
    Clock,
    AlertCircle,
    LogIn,
    LogOut,
    Upload,
    Trash2,
    KeyRound,
    ShieldCheck,
} from "lucide-react";
import moment from "moment";
import { cn } from "@/lib/utils";
import AvatarWithInitials from "./avatar-with-initials";

export type AuditLog = {
    id: number;
    user?: { name?: string; profile?: string };
    created_at: string;
    description?: string;
    event: string;
    properties?: Record<string, unknown>;
};

type EventKind = "comment" | "tag" | "system";

const eventLabels: Record<string, string> = {
    "auth.login": "Login",
    "auth.login_failed": "Failed Login",
    "auth.logout": "Logout",
    "auth.password_reset_initiated": "Password Reset by Admin",
    "auth.password_self_updated": "Password Updated",
    "request.created": "Request Created",
    "request.updated": "Request Updated",
    "request.approved": "Request Approved",
    "request.denied": "Request Denied",
    "request.conditionally_approved": "Conditionally Approved",
    "request.held": "Request Held",
    "request.comment_added": "Comment Added",
    "request.marked_for_reschedule": "Marked for Reschedule",
    "request.file_uploaded": "File Uploaded",
    "request.file_removed": "File Removed",
    "settings.updated": "Settings Updated",
};

function formatEventLabel(event?: string): string {
    if (!event) return "Event";
    return eventLabels[event] ?? event
        .replace(/^[^.]+\./, "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function getEventKind(event?: string): EventKind {
    const e = (event || "").toLowerCase();
    if (e.includes("comment")) return "comment";
    if (e.includes("tag")) return "tag";
    return "system";
}

function getEventIcon(event?: string) {
    const e = (event || "").toLowerCase();

    if (e.includes("comment")) return MessageSquare;
    if (e.includes("tag")) return Tag;
    if (e.includes("assign")) return UserPlus;

    if (e.includes("approved") || e.includes("approve")) return CheckCircle;
    if (e.includes("conditionally_approved")) return ShieldCheck;

    if (e.includes("denied") || e.includes("deny")) return XCircle;

    if (e.includes("created")) return Plus;
    if (e.includes("updated")) return Activity;

    if (e.includes("hold")) return Clock;
    if (e.includes("reschedule")) return AlertCircle;

    if (e.includes("login_failed")) return AlertCircle;
    if (e.includes("login")) return LogIn;
    if (e.includes("logout")) return LogOut;

    if (e.includes("file_uploaded")) return Upload;
    if (e.includes("file_removed")) return Trash2;

    if (e.includes("password_reset")) return KeyRound;
    if (e.includes("password_self_updated")) return ShieldCheck;

    return Activity;
}

const TAG_COLOR_CYCLES = [
    {
        dot: "#0c66e4",
        className:
            "bg-[var(--ads-ac-department)] text-[var(--ads-ac-ink-department)] border-[var(--ads-ac-ink-department)]/30",
    },
    {
        dot: "#216e4e",
        className:
            "bg-[var(--ads-ac-community)] text-[var(--ads-ac-ink-community)] border-[var(--ads-ac-ink-community)]/30",
    },
    {
        dot: "#e56910",
        className:
            "bg-[var(--ads-ac-university)] text-[var(--ads-ac-ink-university)] border-[var(--ads-ac-ink-university)]/30",
    },
    {
        dot: "#ae3e86",
        className:
            "bg-[var(--ads-ac-cultural)] text-[var(--ads-ac-ink-cultural)] border-[var(--ads-ac-ink-cultural)]/30",
    },
    {
        dot: "#5e4db2",
        className:
            "bg-[var(--ads-ac-academic)] text-[var(--ads-ac-ink-academic)] border-[var(--ads-ac-ink-academic)]/30",
    },
];

function TagPill({ label, index = 0 }: { label: string; index?: number }) {
    const color = TAG_COLOR_CYCLES[index % TAG_COLOR_CYCLES.length];
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border font-medium",
                color.className
            )}
        >
            <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: color.dot }}
            />
            {label}
        </span>
    );
}

function extractTags(log: AuditLog): string[] {
    const tags = log.properties?.tags;
    if (Array.isArray(tags)) return tags.map(String);

    const tagNames = log.properties?.tag_names;
    if (Array.isArray(tagNames)) return tagNames.map(String);

    return [];
}

function CommentEntry({ log }: { log: AuditLog }) {
    const name = log.user?.name || "System";
    const body = (log.properties?.body as string) || log.description || "";

    return (
        <div className="flex gap-4 relative pb-8 last:pb-0">
            {/* Avatar with chat badge overlay */}
            <div className="relative shrink-0 z-10">
                <AvatarWithInitials
                    avatarSrc={log.user?.profile}
                    username={name}
                    size="sm"
                    icon={MessageSquare}
                />
            </div>

            {/* Content */}
            <div className="flex flex-col gap-1 pt-0.5 min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{name}</span>
                    <span className="text-xs text-muted-foreground">
                        Commented {moment(log.created_at).fromNow()}
                    </span>
                </div>
                {body && (
                    <p className="text-sm text-foreground/80 leading-relaxed mt-0.5">{body}</p>
                )}
            </div>
        </div>
    );
}

function TagEntry({ log }: { log: AuditLog }) {
    const name = log.user?.name || "System";
    const tags = extractTags(log);
    const Icon = getEventIcon(log.event);

    return (
        <div className="flex gap-4 relative pb-8 last:pb-0">
            {/* Small icon circle */}
            <div className="shrink-0 z-10 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            {/* Inline content */}
            <div className="flex items-center gap-2 flex-wrap pt-1.5 min-w-0 flex-1">
                <span className="font-semibold text-sm text-foreground">{name}</span>
                <span className="text-sm text-muted-foreground">added tags</span>
                {tags.length > 0
                    ? tags.map((tag, i) => <TagPill key={tag} label={tag} index={i} />)
                    : log.description && (
                        <span className="text-sm text-muted-foreground">{log.description}</span>
                    )}
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {moment(log.created_at).fromNow()}
                </span>
            </div>
        </div>
    );
}

type FieldChange = { from: unknown; to: unknown };

type BookingSnapshot = {
    facility?: string;
    date?: string;
    time_start?: string;
    time_end?: string;
    expected_capacity?: number | null;
    has_outsiders?: boolean;
};

function formatChangeValue(v: unknown): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
}

function fmtTime(t: string): string {
    try {
        return new Date(`2000-01-01T${t}`).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        });
    } catch {
        return t;
    }
}

function fmtDate(d: string): string {
    try {
        return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    } catch {
        return d;
    }
}

function formatBookingLine(b: BookingSnapshot): string {
    const parts: string[] = [];
    if (b.facility) parts.push(b.facility);
    if (b.date) parts.push(fmtDate(b.date));
    if (b.time_start && b.time_end)
        parts.push(`${fmtTime(b.time_start)} – ${fmtTime(b.time_end)}`);
    if (b.expected_capacity != null) parts.push(`${b.expected_capacity} attendees`);
    if (b.has_outsiders !== undefined)
        parts.push(b.has_outsiders ? "with outsiders" : "no outsiders");
    return parts.join(" · ");
}

function isBookingArray(v: unknown): v is BookingSnapshot[] {
    if (!Array.isArray(v) || v.length === 0) return false;
    const first = v[0];
    if (typeof first !== "object" || first === null) return false;
    const keys = Object.keys(first);
    return keys.some((k) => ["facility", "date", "time_start", "has_outsiders"].includes(k));
}

function BookingChangeDiff({
    from,
    to,
}: {
    from: BookingSnapshot[];
    to: BookingSnapshot[];
}) {
    const fromLines = from.map(formatBookingLine);
    const toLines = to.map(formatBookingLine);

    const removed = fromLines.filter((l) => !toLines.includes(l));
    const added = toLines.filter((l) => !fromLines.includes(l));
    const unchanged = toLines.filter((l) => fromLines.includes(l));

    return (
        <div className="flex flex-col gap-1 min-w-0 w-full">
            {unchanged.map((line, i) => (
                <span key={`u-${i}`} className="text-xs font-mono text-foreground/50 break-all">
                    {line}
                </span>
            ))}
            {removed.map((line, i) => (
                <span key={`r-${i}`} className="text-xs font-mono text-foreground/50 line-through break-all">
                    {line}
                </span>
            ))}
            {added.map((line, i) => (
                <span key={`a-${i}`} className="text-xs font-mono text-foreground font-medium break-all">
                    {line}
                </span>
            ))}
        </div>
    );
}

function ChangeFieldValue({ field, change }: { field: string; change: FieldChange }) {
    const fromIsBookings = field === "bookings" || isBookingArray(change.from);
    const toIsBookings = field === "bookings" || isBookingArray(change.to);

    if (fromIsBookings || toIsBookings) {
        const from = Array.isArray(change.from) ? (change.from as BookingSnapshot[]) : [];
        const to = Array.isArray(change.to) ? (change.to as BookingSnapshot[]) : [];
        return <BookingChangeDiff from={from} to={to} />;
    }

    return (
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs font-mono text-foreground/50 line-through break-all">
                {formatChangeValue(change.from)}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">→</span>
            <span className="text-xs font-mono text-foreground font-medium break-all">
                {formatChangeValue(change.to)}
            </span>
        </div>
    );
}

function ChangeDiff({ changes }: { changes: Record<string, FieldChange> }) {
    const entries = Object.entries(changes);
    if (entries.length === 0) return null;

    return (
        <div className="mt-2 rounded-lg border border-border bg-muted/40 divide-y divide-border overflow-hidden">
            {entries.map(([field, change]) => (
                <div key={field} className="flex items-start gap-3 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground capitalize shrink-0 w-28 pt-0.5">
                        {(field || "").replace(/_/g, " ")}
                    </span>
                    <ChangeFieldValue field={field} change={change} />
                </div>
            ))}
        </div>
    );
}

function SystemEntry({ log }: { log: AuditLog }) {
    const name = log.user?.name || "System";
    const Icon = getEventIcon(log.event);
    const changes = log.properties?.changes as Record<string, FieldChange> | undefined;
    const hasChanges = changes && Object.keys(changes).length > 0;

    return (
        <div className="flex gap-4 relative pb-8 last:pb-0">
            {/* Small icon circle */}
            <div className="shrink-0 z-10 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            {/* Content */}
            <div className="flex flex-col pt-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{name}</span>
                    {log.description ? (
                        <span className="text-sm text-muted-foreground">
                            {name ? log.description.replace(name, "").trim() : log.description.trim()}
                        </span>
                    ) : (
                        <span className="text-sm text-muted-foreground">
                            {formatEventLabel(log.event)}
                        </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {moment(log.created_at).fromNow()}
                    </span>
                </div>
                {hasChanges && <ChangeDiff changes={changes} />}
            </div>
        </div>
    );
}

export function ActivityFeed({ auditLogs }: { auditLogs: AuditLog[] }) {
    if (auditLogs.length === 0) {
        return (
            <p className="text-muted-foreground text-sm py-4">No activity yet.</p>
        );
    }

    return (
        <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />

            <div className="flex flex-col gap-0">
                {auditLogs.map((log) => {
                    const kind = getEventKind(log.event);

                    if (kind === "comment") return <CommentEntry key={log.id} log={log} />;
                    if (kind === "tag") return <TagEntry key={log.id} log={log} />;
                    return <SystemEntry key={log.id} log={log} />;
                })}
            </div>
        </div>
    );
}

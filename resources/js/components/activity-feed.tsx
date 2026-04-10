import moment from "moment";
import { cn } from "@/lib/utils";
import AvatarWithInitials from "./avatar-with-initials";

function formatScalar(v: unknown): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
}

function statusBadge(value: string): React.ReactNode | null {
    const map: Record<string, string> = {
        approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        conditionally_approved: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
        pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        denied: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    };
    const cls = map[value.toLowerCase()];
    if (!cls) return null;
    return (
        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded capitalize", cls)}>
            {value.replace(/_/g, " ")}
        </span>
    );
}

function PropertyValue({ value }: { value: unknown }) {
    if (value === null || value === undefined) {
        return <span className="text-xs text-muted-foreground italic">—</span>;
    }

    if (typeof value === "boolean") {
        return (
            <span className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                value
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}>
                {value ? "Yes" : "No"}
            </span>
        );
    }

    if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        "from" in (value as object) &&
        "to" in (value as object)
    ) {
        const diff = value as { from: unknown; to: unknown };
        return (
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs line-through text-muted-foreground font-mono">
                    {formatScalar(diff.from)}
                </span>
                <span className="text-xs text-muted-foreground">→</span>
                <span className="text-xs font-mono text-foreground">
                    {formatScalar(diff.to)}
                </span>
            </div>
        );
    }

    if (typeof value === "string") {
        const badge = statusBadge(value);
        if (badge) return badge;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <span className="text-xs text-muted-foreground italic">none</span>;
        }
        if (typeof value[0] === "object") {
            return (
                <div className="flex flex-col gap-1 w-full">
                    {value.map((item, i) => (
                        <span key={i} className="text-xs font-mono text-foreground bg-muted px-1.5 py-0.5 rounded break-all">
                            {JSON.stringify(item)}
                        </span>
                    ))}
                </div>
            );
        }
        return (
            <span className="text-xs text-foreground">
                {(value as unknown[]).map(String).join(", ")}
            </span>
        );
    }

    if (typeof value === "object") {
        return (
            <div className="flex flex-col gap-0.5 w-full">
                {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                        <span className="text-xs text-muted-foreground capitalize shrink-0">
                            {k.replace(/_/g, " ")}:
                        </span>
                        <span className="text-xs font-mono text-foreground break-all">
                            {formatScalar(v)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <span className="text-xs font-mono text-foreground break-all">
            {String(value)}
        </span>
    );
}

export type AuditLog = {
    id: number;
    user?: { name?: string; profile?: string };
    created_at: string;
    description?: string;
    event: string;
    properties?: Record<string, unknown>;
};

export function ActivityFeed({ auditLogs }: { auditLogs: AuditLog[] }) {
    if (auditLogs.length === 0) {
        return <p className="text-muted-foreground text-sm">No activity yet.</p>;
    }

    return (
        <div className="relative">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
            <div className="flex flex-col gap-0">
                {auditLogs.map((log) => (
                    <div key={log.id} className="flex gap-4 relative pb-6 last:pb-0">
                        <div className="shrink-0 z-10">
                            <AvatarWithInitials
                                avatarSrc={log.user?.profile}
                                username={log.user?.name || "System"}
                                size="sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 pt-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">
                                    {log.user?.name || "System"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {moment(log.created_at).fromNow()}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {log.description || log.event}
                            </p>
                            {log.properties && Object.keys(log.properties).length > 0 && (
                                <div className="mt-1 rounded-lg border border-border bg-muted/50 divide-y divide-border overflow-hidden">
                                    {Object.entries(log.properties).map(([key, value]) => (
                                        <div key={key} className="flex gap-3 px-3 py-2">
                                            <span className="text-xs font-medium text-muted-foreground capitalize shrink-0 w-28">
                                                {key.replace(/_/g, " ")}
                                            </span>
                                            <PropertyValue value={value} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
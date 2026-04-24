import moment from "moment";
import { Request } from "@/types/request";
import { PRIORITY_LABELS } from "@/types/request";
import { formatTime } from "@/lib/utils";

export function downloadRequestsCSV(requests: Request[], filename = "requests.csv") {
    const HEADERS = [
        "Title",
        "Description",
        "Status",
        "Priority",
        "On Hold",
        "Requester",
        "Email",
        "Submitted At",
        "Facility",
        "Building",
        "Date Requested",
        "Time Start",
        "Time End",
        "External Equipment",
    ];

    const escape = (value: string | number | boolean | null | undefined): string => {
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (/[,"\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    const rows: string[][] = [HEADERS];

    for (const req of requests) {
        const base = [
            req.title,
            req.description,
            req.status,
            PRIORITY_LABELS[req.priority_level] ?? "Normal",
            req.on_hold ? "Yes" : "No",
            req.user.name,
            req.user.email,
            moment(req.created_at).format("YYYY-MM-DD HH:mm"),
        ];

        if (req.request_facilities.length === 0) {
            rows.push([...base, "", "", "", "", "", ""].map(escape));
        } else {
            for (const rf of req.request_facilities) {
                const facility = req.facilities.find((f) => f.id === rf.facility_id);
                rows.push(
                    [
                        ...base,
                        facility?.name ?? "",
                        facility?.building ?? "",
                        moment(rf.date_requested).format("YYYY-MM-DD"),
                        formatTime(rf.time_start),
                        formatTime(rf.time_end),
                        rf.external_equipments?.map(e => e.name).join(" | ") ?? "",
                    ].map(escape)
                );
            }
        }
    }

    const csvContent = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function downloadSingleRequestCSV(request: Request) {
    const filename = `request-${request.id}.csv`;
    downloadRequestsCSV([request], filename);
}

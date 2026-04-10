import { cn } from "@/lib/utils";

export default function StatusTag({ requestStatus }: { requestStatus: string }) {

    const wtc = (status: string) => {
        let statusColor;
        switch (status) {
            case 'Approved': statusColor = "bg-primary/20 border-primary text-primary"; break;
            case 'Pending': statusColor = "border-foreground"; break;
            case 'Denied': statusColor = "bg-destructive/20 border-destructive text-destructive"; break;
            case 'Conditionally Approved': statusColor = "bg-primary/20 border-primary/70"; break;
            case 'For Reschedule': statusColor = "bg-slate-500/20 border-slate-500 text-slate-600 dark:text-slate-400"; break;
        }
        return statusColor;
    }

    return (
        <div className={cn("flex gap-1 px-2 w-fit py-1 font-semibold text-xs border-border border-1 rounded-full ", wtc(requestStatus))}>
            <span>
                {requestStatus}
            </span>
        </div>
    )
}
import { Loader2 } from "lucide-react";

export default function RequestsSkeleton() {
    return (
        <div className="flex h-[550px] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading requests...</p>
            </div>
        </div>
    );
}
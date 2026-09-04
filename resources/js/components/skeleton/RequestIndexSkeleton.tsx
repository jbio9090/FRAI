import { Spinner } from "@/components/ui/spinner";

export default function RequestsSkeleton() {
    return (
        <div className="flex h-[550px] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
                <Spinner size="lg" />
                <p className="text-sm text-muted-foreground">Loading requests...</p>
            </div>
        </div>
    );
}
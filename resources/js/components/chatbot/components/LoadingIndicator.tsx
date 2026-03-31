export default function LoadingIndicator() {
    return (
        <div className="flex gap-4 justify-start">
            <div className="bg-muted h-10 w-10 rounded-lg flex items-center justify-center font-bold text-muted-foreground flex-shrink-0 text-sm">
                FRAI
            </div>
            <div className="flex items-center">
                <span className="text-sm text-muted-foreground animate-pulse">
                    FRAI is thinking...
                </span>
            </div>
        </div>
    );
}
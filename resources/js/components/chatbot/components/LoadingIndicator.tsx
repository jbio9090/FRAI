export default function LoadingIndicator() {
    return (
        <div className="flex justify-start gap-2 sm:gap-3 lg:gap-4">
            <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold flex-shrink-0 sm:h-10 sm:w-10 sm:text-sm">
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

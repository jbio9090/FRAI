export default function LoadingIndicator() {
    return (
        <div className="flex gap-4 justify-start">
            <div className="bg-gray-300 h-10 w-10 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0">
                AI
            </div>
            <div className="space-x-2 flex items-center">
                <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse"></div>
                <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse delay-200"></div>
                <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse delay-400"></div>
            </div>
        </div>
    );
}

export default function WelcomeMessage() {
    return (
        <div className="flex min-h-[30vh] items-center justify-center px-3 sm:min-h-[40vh] sm:px-4">
            <div className="text-center">
                <h2 className="mb-3 text-xl font-bold text-gray-800 sm:mb-4 sm:text-2xl dark:text-white">
                    Welcome to AI Chat
                </h2>
                <p className="text-sm text-gray-600 sm:text-base dark:text-gray-300">
                    Connected to the configured AI model.
                    <br />
                    Start a conversation by typing a message below, or use the guided quick actions.
                </p>
            </div>
        </div>
    );
}

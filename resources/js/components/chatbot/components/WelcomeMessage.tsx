export default function WelcomeMessage() {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Welcome to AI Chat</h2>
                <p className="text-gray-600">
                    Connected to <strong>FRAI</strong> model via CloudStudio Ollama.
                    <br />
                    Start a conversation by typing a message below.
                </p>
            </div>
        </div>
    );
}

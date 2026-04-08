import React, { useEffect, useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getCsrfToken } from '@/components/chatbot/utils/csrfToken';

interface ChatbotSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ChatbotSessionModal({ isOpen, onClose }: ChatbotSessionModalProps) {
    const [hasSession, setHasSession] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;

        setIsLoading(true);
        fetch(route('chat.session.get'), {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': getCsrfToken(),
            },
            credentials: 'same-origin',
        })
            .then(res => res.json())
            .then(json => {
                setHasSession(!!(json.messages && json.messages.length > 0));
                setIsLoading(false);
            })
            .catch(() => {
                setHasSession(false);
                setIsLoading(false);
            });
    }, [isOpen]);

    const handleNewRequest = async () => {
        try {
            await fetch(route('chat.session.clear'), {
                method: 'DELETE',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'same-origin',
            });
        } catch (err) {
            console.error('Failed to clear session:', err);
        }
        window.location.href = route('chatbot');
    };

    const handleContinue = () => {
        window.location.href = route('chatbot');
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Chatbot Session</AlertDialogTitle>
                    <AlertDialogDescription>
                        {isLoading ? (
                            'Checking your session...'
                        ) : hasSession ? (
                            'You have an ongoing conversation. Would you like to continue where you left off, or start a fresh session?'
                        ) : (
                            'Start a new conversation with the AI chatbot.'
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {!isLoading && (
                    <div className="flex gap-3">
                        {hasSession ? (
                            <>
                                <AlertDialogCancel onClick={handleNewRequest}>
                                    Start New Request
                                </AlertDialogCancel>
                                <AlertDialogAction onClick={handleContinue}>
                                    Continue Conversation
                                </AlertDialogAction>
                            </>
                        ) : (
                            <>
                                <AlertDialogCancel onClick={onClose}>
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction onClick={handleContinue}>
                                    Open Chatbot
                                </AlertDialogAction>
                            </>
                        )}
                    </div>
                )}
            </AlertDialogContent>
        </AlertDialog>
    );
}

import { useEffect, useMemo, useRef, useState } from 'react';

interface TypingMessageProps {
    text: string;
    messageKey: string;
    speedMs?: number;
    onComplete?: () => void;
}

export default function TypingMessage({
    text,
    messageKey,
    speedMs = 18,
    onComplete,
}: TypingMessageProps) {
    const [visibleText, setVisibleText] = useState('');
    const onCompleteRef = useRef(onComplete);

    const normalizedText = useMemo(() => text ?? '', [text]);

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        setVisibleText('');

        if (!normalizedText) {
            onCompleteRef.current?.();
            return;
        }

        let cancelled = false;
        let currentIndex = 0;

        const tick = () => {
            if (cancelled) {
                return;
            }

            currentIndex += 1;
            setVisibleText(normalizedText.slice(0, currentIndex));

            if (currentIndex >= normalizedText.length) {
                onCompleteRef.current?.();
                return;
            }

            window.setTimeout(tick, speedMs);
        };

        const initialDelay = window.setTimeout(tick, 120);

        return () => {
            cancelled = true;
            window.clearTimeout(initialDelay);
        };
    }, [messageKey, normalizedText, speedMs]);

    const isComplete = visibleText.length >= normalizedText.length;

    return (
        <div className="text-sm whitespace-pre-wrap">
            {visibleText}
            {!isComplete && <span className="inline-block ml-0.5 animate-pulse">|</span>}
        </div>
    );
}

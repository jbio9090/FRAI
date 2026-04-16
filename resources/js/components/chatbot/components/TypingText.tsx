import React from 'react';

interface TypingTextProps {
    text: string;
    startDelayMs?: number;
    charDelayMs?: number;
    showCursor?: boolean;
}

export default function TypingText({
    text,
    startDelayMs = 0,
    charDelayMs = 16,
    showCursor = false,
}: TypingTextProps) {
    const [visibleCount, setVisibleCount] = React.useState(0);

    React.useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;
        const timeoutId = setTimeout(() => {
            intervalId = setInterval(() => {
                setVisibleCount((prev) => {
                    if (prev >= text.length) {
                        if (intervalId) {
                            clearInterval(intervalId);
                        }
                        return prev;
                    }

                    return prev + 1;
                });
            }, Math.max(8, charDelayMs));
        }, Math.max(0, startDelayMs));

        return () => {
            clearTimeout(timeoutId);
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [text, startDelayMs, charDelayMs]);

    const done = visibleCount >= text.length;
    const typedText = text.slice(0, visibleCount);

    return (
        <span>
            {typedText}
            {showCursor && !done && <span className="ml-0.5 inline-block animate-pulse">|</span>}
        </span>
    );
}

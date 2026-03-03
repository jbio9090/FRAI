import { useState, useCallback } from 'react';
import { extractParticipantCount } from '../utils/extractParticipantCount';

/**
 * Custom hook for managing participant count
 */
export function useParticipantCount() {
    const [participantCount, setParticipantCount] = useState<number | null>(null);

    const extractAndSet = useCallback((text: string) => {
        const count = extractParticipantCount(text);
        if (count) {
            setParticipantCount(count);
            return count;
        }
        return null;
    }, []);

    const getCurrentCount = useCallback((allText: string): number | null => {
        return participantCount || extractParticipantCount(allText);
    }, [participantCount]);

    return {
        participantCount,
        setParticipantCount,
        extractAndSet,
        getCurrentCount,
    };
}

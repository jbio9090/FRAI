import { useState, useEffect, useCallback } from 'react';
import { route } from 'ziggy-js';
import type { ChosenAlternativesResponse } from '@/types/request';

interface UseChosenAlternativesOptions {
    requestId: number;
    enabled?: boolean;
}

export function useChosenAlternatives({ requestId, enabled = true }: UseChosenAlternativesOptions) {
    const [data, setData] = useState<ChosenAlternativesResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchChosenAlternatives = useCallback(async () => {
        if (!enabled) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(route('requests.reschedule-alternatives.index', [requestId]), {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('Failed to fetch chosen alternatives');
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [requestId, enabled]);

    useEffect(() => {
        fetchChosenAlternatives();
    }, [fetchChosenAlternatives]);

    return { chosenAlternatives: data, loading, error, refetch: fetchChosenAlternatives };
}
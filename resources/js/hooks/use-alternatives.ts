import { useState, useEffect, useCallback } from 'react';
import { route } from 'ziggy-js';
import type { AlternativesResponse } from '@/types/request';

interface UseAlternativesOptions {
    requestId: number;
    includeEquipment?: boolean;
    maxResults?: number;
    enabled?: boolean;
}

export function useAlternatives({ requestId, includeEquipment: initialIncludeEquipment = false, maxResults = 5, enabled = true }: UseAlternativesOptions) {
    const [data, setData] = useState<AlternativesResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [includeEquipment, setIncludeEquipmentState] = useState(initialIncludeEquipment);

    const fetchAlternatives = useCallback(async () => {
        if (!enabled) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                include_equipment: String(includeEquipment),
                max_results: String(maxResults),
            });
            const res = await fetch(route('requests.alternatives', [requestId]) + '?' + params.toString(), {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('Failed to fetch alternatives');
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [requestId, includeEquipment, maxResults, enabled]);

    useEffect(() => {
        fetchAlternatives();
    }, [fetchAlternatives]);

    const setIncludeEquipment = (value: boolean) => {
        setIncludeEquipmentState(value);
    };

    return { alternatives: data, loading, error, refetch: fetchAlternatives, includeEquipment, setIncludeEquipment };
}
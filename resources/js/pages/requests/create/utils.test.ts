import { describe, expect, it } from 'vitest';
import { pendingConflictsOnly } from '@/pages/requests/create/utils';

function conflict(status: string, request_id = 1) {
    return { request_id, request_title: `Request ${request_id}`, requester: 'Juan', status };
}

describe('pendingConflictsOnly', () => {
    it('keeps pending requests, which do not consume stock yet', () => {
        const kept = pendingConflictsOnly([conflict('Pending', 7)]);

        expect(kept).toHaveLength(1);
        expect(kept[0].request_id).toBe(7);
    });

    // The reported contradiction: "Available: 3" beside "also requested by an
    // Approved request". Approved bookings are already subtracted from the
    // availability figure, so warning about them repeated a fact the number
    // already carried.
    it('drops approved, since the number already accounts for it', () => {
        expect(pendingConflictsOnly([conflict('Approved')])).toEqual([]);
    });

    it('drops conditionally approved for the same reason', () => {
        expect(pendingConflictsOnly([conflict('Conditionally Approved')])).toEqual([]);
    });

    it('keeps only the pending entries from a mixed list', () => {
        const result = pendingConflictsOnly([conflict('Approved', 1), conflict('Pending', 2), conflict('Conditionally Approved', 3), conflict('Pending', 4)]);

        expect(result.map((c) => c.request_id)).toEqual([2, 4]);
    });

    it('handles absent and empty input', () => {
        expect(pendingConflictsOnly(null)).toEqual([]);
        expect(pendingConflictsOnly(undefined)).toEqual([]);
        expect(pendingConflictsOnly([])).toEqual([]);
    });

    it('preserves the other fields so the row can still name requester and title', () => {
        const [kept] = pendingConflictsOnly([conflict('Pending', 9)]);

        expect(kept).toEqual({ request_id: 9, request_title: 'Request 9', requester: 'Juan', status: 'Pending' });
    });

    it('does not mutate the input', () => {
        const input = [conflict('Approved'), conflict('Pending')];

        pendingConflictsOnly(input);

        expect(input).toHaveLength(2);
    });
});
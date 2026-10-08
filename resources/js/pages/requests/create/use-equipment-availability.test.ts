import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEquipmentAvailability } from '@/pages/requests/create/use-equipment-availability';
import type { Facility } from '@/types/facility';

const fetchEquipmentAvailability = vi.fn();
const fetchBorrowableAvailability = vi.fn();

vi.mock('@/pages/requests/create/api', async () => {
    const actual = await vi.importActual('@/pages/requests/create/api');

    return {
        ...(actual as Record<string, unknown>),
        fetchEquipmentAvailability: (...args: unknown[]) => fetchEquipmentAvailability(...args),
        fetchBorrowableAvailability: (...args: unknown[]) => fetchBorrowableAvailability(...args),
    };
});

function slot(available: number) {
    return {
        equipment_name: 'Folding Table',
        total_quantity: 10,
        reserved_quantity: 10 - available,
        available_quantity: available,
        is_limited: available < 10,
        is_empty: available <= 0,
        reservations: [],
    };
}

const facilities = [{ id: 1, name: 'Main', capacity: 100, building: '', status: 'active' }] as unknown as Facility[];

const dates = [new Date('2026-10-20'), new Date('2026-10-21'), new Date('2026-10-22')];

describe('useEquipmentAvailability', () => {
    beforeEach(() => {
        fetchEquipmentAvailability.mockReset();
        fetchBorrowableAvailability.mockReset();
    });

    // THE ORIGINAL REGRESSION. Both fetches resolve in the same tick. Previously
    // they were sibling effects sharing one request token, so the own-facility
    // response was discarded as stale and `own` stayed {} forever — which is why
    // the UI showed the full equipment quantity instead of what was left.
    it('populates own availability even when the borrowable fetch resolves at the same time', async () => {
        fetchEquipmentAvailability.mockResolvedValue({ '2026-10-20': { 8: slot(3) } });
        fetchBorrowableAvailability.mockResolvedValue({ 2: { 8: 5 } });

        const { result } = renderHook(() =>
            useEquipmentAvailability({ facilityId: 1, dates: [new Date('2026-10-20')], timeStart: '09:00', timeEnd: '12:00', facilities }),
        );

        await waitFor(() => {
            expect(result.current.own[8]).toBeDefined();
        });

        expect(result.current.own[8].available_quantity).toBe(3);
        expect(result.current.borrowable[2][8]).toBe(5);
    });

    // Ten dates used to mean ten concurrent POSTs, each running its own
    // reservation query.
    it('makes exactly one own request regardless of how many dates are selected', async () => {
        fetchEquipmentAvailability.mockResolvedValue({});
        fetchBorrowableAvailability.mockResolvedValue({});

        renderHook(() => useEquipmentAvailability({ facilityId: 1, dates, timeStart: '09:00', timeEnd: '12:00', facilities }));

        await waitFor(() => {
            expect(fetchEquipmentAvailability).toHaveBeenCalledTimes(1);
        });

        expect(fetchEquipmentAvailability).toHaveBeenCalledWith({
            facilityId: 1,
            dates: ['2026-10-20', '2026-10-21', '2026-10-22'],
            timeStart: '09:00',
            timeEnd: '12:00',
            excludeRequestId: null,
        });
    });

    it('merges the tightest date when several are selected and names it', async () => {
        fetchEquipmentAvailability.mockResolvedValue({
            '2026-10-20': { 8: slot(9) },
            '2026-10-21': { 8: slot(2) },
            '2026-10-22': { 8: slot(5) },
        });
        fetchBorrowableAvailability.mockResolvedValue({});

        const { result } = renderHook(() => useEquipmentAvailability({ facilityId: 1, dates, timeStart: '09:00', timeEnd: '12:00', facilities }));

        await waitFor(() => {
            expect(result.current.own[8]?.available_quantity).toBe(2);
        });

        expect(result.current.tightestDate).toBe('2026-10-21');
        expect(result.current.dateCount).toBe(3);
    });

    it('keeps the per-date view so a count can be attributed to a day', async () => {
        fetchEquipmentAvailability.mockResolvedValue({
            '2026-10-20': { 8: slot(9) },
            '2026-10-21': { 8: slot(2) },
        });
        fetchBorrowableAvailability.mockResolvedValue({});

        const { result } = renderHook(() => useEquipmentAvailability({ facilityId: 1, dates, timeStart: '09:00', timeEnd: '12:00', facilities }));

        await waitFor(() => {
            expect(Object.keys(result.current.byDate)).toHaveLength(2);
        });

        expect(result.current.byDate['2026-10-21'][8].available_quantity).toBe(2);
        expect(result.current.byDate['2026-10-20'][8].available_quantity).toBe(9);
    });

    it('reports the date a selection cannot satisfy', async () => {
        fetchEquipmentAvailability.mockResolvedValue({
            '2026-10-20': { 8: slot(9) },
            '2026-10-21': { 8: slot(2) },
        });
        fetchBorrowableAvailability.mockResolvedValue({});

        const { result } = renderHook(() =>
            useEquipmentAvailability({
                facilityId: 1,
                dates,
                timeStart: '09:00',
                timeEnd: '12:00',
                facilities,
                selectedEquipment: [{ equipment_id: 8, equipment_name: 'Folding Table', quantity_needed: 4 }],
            }),
        );

        await waitFor(() => {
            expect(result.current.shortfalls).toHaveLength(1);
        });

        expect(result.current.shortfalls[0]).toMatchObject({ date: '2026-10-21', requested: 4, remaining: 2 });
    });

    it('forwards the exclude id so editing does not block itself', async () => {
        fetchEquipmentAvailability.mockResolvedValue({});
        fetchBorrowableAvailability.mockResolvedValue({});

        renderHook(() =>
            useEquipmentAvailability({
                facilityId: 4,
                dates: [new Date('2026-10-20')],
                timeStart: '09:00',
                timeEnd: '12:00',
                excludeRequestId: 77,
                facilities,
            }),
        );

        await waitFor(() => {
            expect(fetchEquipmentAvailability).toHaveBeenCalled();
        });

        expect(fetchEquipmentAvailability).toHaveBeenCalledWith(expect.objectContaining({ excludeRequestId: 77, facilityId: 4 }));
    });

    it('does not fetch and clears state when the slot is incomplete', async () => {
        const { result } = renderHook(() => useEquipmentAvailability({ facilityId: null, dates: [], timeStart: '', timeEnd: '', facilities }));

        expect(fetchEquipmentAvailability).not.toHaveBeenCalled();
        expect(result.current.own).toEqual({});
        expect(result.current.borrowable).toEqual({});
        expect(result.current.shortfalls).toEqual([]);
    });

    it('reports a fully booked slot rather than falling back to the facility total', async () => {
        fetchEquipmentAvailability.mockResolvedValue({ '2026-10-20': { 8: slot(0) } });
        fetchBorrowableAvailability.mockResolvedValue({});

        const { result } = renderHook(() =>
            useEquipmentAvailability({ facilityId: 1, dates: [new Date('2026-10-20')], timeStart: '09:00', timeEnd: '12:00', facilities }),
        );

        await waitFor(() => {
            expect(result.current.own[8]).toBeDefined();
        });

        expect(result.current.own[8].available_quantity).toBe(0);
        expect(result.current.own[8].is_empty).toBe(true);
    });

    it('clears isLoading once the fetch settles', async () => {
        fetchEquipmentAvailability.mockResolvedValue({ '2026-10-20': { 8: slot(3) } });
        fetchBorrowableAvailability.mockResolvedValue({});

        const { result } = renderHook(() =>
            useEquipmentAvailability({ facilityId: 1, dates: [new Date('2026-10-20')], timeStart: '09:00', timeEnd: '12:00', facilities }),
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });
    });

    it('recovers when the availability request rejects', async () => {
        fetchEquipmentAvailability.mockRejectedValue(new Error('network'));
        fetchBorrowableAvailability.mockResolvedValue({});

        const { result } = renderHook(() =>
            useEquipmentAvailability({ facilityId: 1, dates: [new Date('2026-10-20')], timeStart: '09:00', timeEnd: '12:00', facilities }),
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.own).toEqual({});
    });
});
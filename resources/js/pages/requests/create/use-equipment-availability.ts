import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Facility } from '@/types/facility';
import { fetchBorrowableAvailability, fetchEquipmentAvailability } from './api';
import type { BorrowableAvailabilityMap, EquipmentAvailabilityByDate, EquipmentAvailabilityMap } from './api';
import { deriveShortfalls, mergeSlotAvailability } from './availability';
import type { AvailabilityShortfall } from './availability';

/**
 * Owns both availability fetches for the request composer.
 *
 * These used to live as two sibling effects in useCreateRequest sharing a single
 * `availabilityRequestId` ref. Both effects run in the same commit, so the second
 * `++` always invalidated the first one's response before it landed, and the
 * guard `if (availabilityRequestId.current !== requestId) return;` threw the
 * own-facility result away every single time. `equipmentAvailability` therefore
 * stayed `{}` and the UI fell back to the facility's full allocation.
 *
 * Keeping both fetches here — with one ref per fetch — makes that collision
 * structurally impossible rather than merely fixed.
 *
 * Both calls now take the whole date selection at once. Firing one request per
 * date turned a ten-date pick into ten concurrent calls, each running its own
 * reservation query, and changing any single date refetched all of them.
 */
export interface UseEquipmentAvailabilityParams {
    facilityId: number | null;
    dates: readonly Date[];
    timeStart: string;
    timeEnd: string;
    excludeRequestId?: number | null;
    facilities: Facility[];
    /** Current selection, used to report which dates cannot satisfy it. */
    selectedEquipment?: readonly { equipment_id: number; equipment_name: string; quantity_needed: number }[];
}

export interface UseEquipmentAvailabilityResult {
    /** Own facility, merged to the tightest selected date. */
    own: EquipmentAvailabilityMap;
    /** Per source facility, for the borrow panel, merged across dates. */
    borrowable: BorrowableAvailabilityMap;
    /** Selected dates the current selection cannot satisfy. */
    shortfalls: AvailabilityShortfall[];
    isLoading: boolean;
}

export function useEquipmentAvailability({
    facilityId,
    dates,
    timeStart,
    timeEnd,
    excludeRequestId = null,
    facilities,
    selectedEquipment = [],
}: UseEquipmentAvailabilityParams): UseEquipmentAvailabilityResult {
    const [byDate, setByDate] = useState<EquipmentAvailabilityByDate>({});
    const [borrowable, setBorrowable] = useState<BorrowableAvailabilityMap>({});
    const [isLoading, setIsLoading] = useState(false);

    // One token per fetch. Sharing one across concurrent fetches is what made
    // the own-facility response look stale.
    const ownRequestId = useRef(0);
    const borrowableRequestId = useRef(0);

    const dateKeys = dates.map((date) => format(date, 'yyyy-MM-dd'));
    const dateKeySignature = dateKeys.join(',');
    const selectedSignature = selectedEquipment.map((item) => `${item.equipment_id}:${item.quantity_needed}`).join(',');

    useEffect(() => {
        if (!facilityId || dateKeys.length === 0 || !timeStart || !timeEnd) {
            setByDate({});
            return;
        }

        const requestId = ++ownRequestId.current;
        setIsLoading(true);

        fetchEquipmentAvailability({ facilityId, dates: dateKeys, timeStart, timeEnd, excludeRequestId })
            .then((response) => {
                if (ownRequestId.current !== requestId) return;

                setByDate(response ?? {});
            })
            .catch(() => {
                if (ownRequestId.current === requestId) {
                    setByDate({});
                }
            })
            .finally(() => {
                if (ownRequestId.current === requestId) {
                    setIsLoading(false);
                }
            });
        // dateKeySignature stands in for dateKeys: a fresh array identity on every
        // render would refetch forever.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facilityId, dateKeySignature, timeStart, timeEnd, excludeRequestId]);

    useEffect(() => {
        if (!facilityId || dateKeys.length === 0 || !timeStart || !timeEnd) {
            setBorrowable({});
            return;
        }

        const requestId = ++borrowableRequestId.current;

        fetchBorrowableAvailability({
            facilities,
            selectedFacility: facilityId,
            dates: dateKeys,
            timeStart,
            timeEnd,
            excludeRequestId,
        })
            .then((map) => {
                if (borrowableRequestId.current !== requestId) return;

                setBorrowable(map ?? {});
            })
            .catch(() => {
                if (borrowableRequestId.current === requestId) {
                    setBorrowable({});
                }
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facilityId, dateKeySignature, timeStart, timeEnd, facilities, excludeRequestId]);

    const { merged } = useMemo(() => mergeSlotAvailability(byDate), [byDate]);

    const shortfalls = useMemo(() => deriveShortfalls(byDate, selectedEquipment), [byDate, selectedSignature]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        own: merged,
        borrowable,
        shortfalls,
        isLoading,
    };
}
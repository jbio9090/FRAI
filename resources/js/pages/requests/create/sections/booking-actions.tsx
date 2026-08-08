import { Button } from '@/components/ui/button';

interface BookingActionsProps {
    facilityBookingsLength: number;
    editingIndex: number | null;
    cancelEditBooking: () => void;
    addFacilityBooking: () => void;
    canSaveFacilityBooking: boolean;
    selectedDates: Date[];
}

export function BookingActions({
    facilityBookingsLength,
    editingIndex,
    cancelEditBooking,
    addFacilityBooking,
    canSaveFacilityBooking,
    selectedDates,
}: BookingActionsProps) {
    return (
        <div className="mt-12 flex w-full flex-col gap-1">
            {facilityBookingsLength === 0 && editingIndex === null && (
                <p className="text-xs text-destructive">At least one facility booking is required.</p>
            )}
            <div className="grid w-full grid-cols-3 gap-2">
                {editingIndex !== null && (
                    <Button type="button" variant="outline" onClick={cancelEditBooking} className="">
                        Cancel Edit
                    </Button>
                )}
                <Button
                    type="button"
                    variant="secondary"
                    onClick={addFacilityBooking}
                    disabled={!canSaveFacilityBooking}
                    className={'w-full ' + (editingIndex !== null ? 'col-span-2' : 'col-span-full')}
                >
                    {editingIndex !== null
                        ? 'Save changes to facility booking'
                        : selectedDates.length > 1
                          ? `Add ${selectedDates.length} Facility Bookings`
                          : 'Add Facility Booking'}
                </Button>
            </div>
        </div>
    );
}

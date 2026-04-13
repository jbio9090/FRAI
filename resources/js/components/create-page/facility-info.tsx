import { motion } from "motion/react";
import { Facility } from "@/types/request";
import { CalendarIcon, Building, User } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BookingCard } from "@/components/booking-card";

interface FacilityInfoProps {
    selectedFacility: number | null;
    facilities: Facility[];
    currentDate: Date | undefined;
    loadingSchedule: boolean;
    facilitySchedule: FacilityScheduleData | null;
    formatTime(time: string): string;
    isForSidebar: boolean;
}

interface BookingSchedule {
    request_title: string;
    status: string;
    time_start: string;
    time_end: string;
}

interface FacilityScheduleData {
    bookings: BookingSchedule[];
    date: string;
}

export function FacilityInfo({
    selectedFacility,
    facilities,
    currentDate,
    loadingSchedule,
    facilitySchedule,
    formatTime,
    isForSidebar,
}: FacilityInfoProps) {
    const facility = selectedFacility
        ? facilities.find(f => f.id === selectedFacility)
        : null;

    return (
        <div className={'space-y-4 ' + (isForSidebar ? 'hidden lg:block' : 'block lg:hidden')}>
            {isForSidebar && (
                <h2 className="font-semibold text-sm text-foreground">Facility Info</h2>
            )}

            {facility ? (
                <motion.div className="space-y-4">
                    {/* Facility meta */}
                    <div>
                        <h3 className="font-semibold text-xl mt-2">{facility.name}</h3>
                        <div className="flex text-muted-foreground gap-1 mt-2">
                            <Building size={16} className={cn(isForSidebar && "hidden")} />
                            <span className="text-sm">{facility.building}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                            <User size={16} />
                            <span className="text-sm">Capacity — {facility.capacity ?? 'N/A'}</span>
                        </div>
                    </div>

                    {/* Schedule for selected date */}
                    {currentDate ? (
                        <div className="mt-2 space-y-3">
                            <h4 className="text-sm font-semibold flex flex-wrap items-center gap-1">
                                <CalendarIcon size={14} />
                                <span className="text-muted-foreground">Schedule for</span>
                                <span>{format(currentDate, 'PPP')}</span>
                            </h4>

                            {loadingSchedule ? (
                                <div className="text-sm text-muted-foreground py-4 text-center">
                                    Loading schedule…
                                </div>
                            ) : facilitySchedule && facilitySchedule.bookings.length > 0 ? (
                                <div className="space-y-3">
                                    {facilitySchedule.bookings.map((booking, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                        >
                                            {/*
                                              Build a minimal FacilityBooking shape so BookingCard
                                              can render the schedule entry read-only.
                                              No onEdit / onRemove → action buttons won't appear.
                                            */}
                                            <BookingCard
                                                booking={{
                                                    facility_id: selectedFacility!,
                                                    facility_name: booking.request_title,
                                                    date: format(currentDate, 'yyyy-MM-dd'),
                                                    time_start: booking.time_start,
                                                    time_end: booking.time_end,
                                                    equipment: [],
                                                    borrowed_equipment: [],
                                                    conflicts: [],
                                                    external_equipment: [],
                                                    expected_capacity: null,
                                                    has_outsiders: false,
                                                    equipment_conflicts: {},
                                                }}
                                                index={idx}
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-sm text-muted-foreground py-4 text-center border rounded-md bg-muted/10"
                                >
                                    No bookings for this date
                                </motion.div>
                            )}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground py-4 text-center">
                            Select a date to view schedule
                        </div>
                    )}
                </motion.div>
            ) : (
                <div className="px-6 pb-6 text-sm text-muted-foreground text-center py-8">
                    Select a facility to view details
                </div>
            )}
        </div>
    );
}
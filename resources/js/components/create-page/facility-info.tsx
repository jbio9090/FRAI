import { format } from "date-fns";
import { CalendarIcon, Building, User } from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { BookingCard } from "@/components/booking-card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Facility } from "@/types/request";

interface FacilityInfoProps {
    facilities: Facility[];
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

export function FacilityInfo({ facilities, isForSidebar }: FacilityInfoProps) {
    const [internalFacilityId, setInternalFacilityId] = useState<number | null>(null);
    const [internalDate, setInternalDate] = useState<Date | undefined>(undefined);
    const [facilitySchedule, setFacilitySchedule] = useState<FacilityScheduleData | null>(null);
    const [loadingSchedule, setLoadingSchedule] = useState(false);

    const facility = internalFacilityId
        ? facilities.find((f) => f.id === internalFacilityId)
        : null;

    // Reset date + schedule when facility changes
    useEffect(() => {
        setFacilitySchedule(null);
        setInternalDate(undefined);
    }, [internalFacilityId]);

    // Fetch schedule whenever facility + date are both set
    useEffect(() => {
        if (!internalFacilityId || !internalDate) return;

        let cancelled = false;
        setLoadingSchedule(true);

        fetch(route("facility.schedule", { facility: internalFacilityId, date: format(internalDate, "yyyy-MM-dd") }))
            .then((res) => res.json())
            .then((data) => { if (!cancelled) setFacilitySchedule(data); })
            .catch((err) => {
                console.error("Failed to load schedule:", err);
                if (!cancelled) setFacilitySchedule(null);
            })
            .finally(() => { if (!cancelled) setLoadingSchedule(false); });

        return () => { cancelled = true; };
    }, [internalFacilityId, internalDate]);

    return (
        <div className={"space-y-4 " + (isForSidebar ? "hidden lg:block" : "block lg:hidden")}>
            {isForSidebar && (
                <h2 className="font-semibold text-sm text-foreground">Facility Info</h2>
            )}

            {/* Facility picker — owned by this component */}
            <Select
                value={internalFacilityId?.toString() ?? ""}
                onValueChange={(v) => setInternalFacilityId(Number(v))}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a facility…" />
                </SelectTrigger>
                <SelectContent>
                    {facilities.map((f) => (
                        <SelectItem key={f.id} value={f.id.toString()}>
                            <span className="font-medium">{f.name}</span>
                            {f.capacity && (
                                <span className="ml-1.5 text-xs text-muted-foreground flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {f.capacity}
                                </span>
                            )}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {facility ? (
                <motion.div
                    key={facility.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    {/* Facility meta */}
                    <div>
                        <h3 className="font-bold text-xl">{facility.name}</h3>
                        <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
                            <Building size={14} />
                            <span className="text-sm">{facility.building}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                            <User size={14} />
                            <span className="text-sm">
                                {facility.capacity ? `${facility.capacity} capacity` : "N/A"}
                            </span>
                        </div>
                    </div>

                    {/* Date picker */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !internalDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                {internalDate ? format(internalDate, "PPP") : "View schedule for a date…"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={internalDate}
                                onSelect={setInternalDate}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>

                    {/* Schedule */}
                    {internalDate && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold flex flex-wrap items-center gap-1">
                                <CalendarIcon size={14} />
                                <span className="text-muted-foreground">Schedule for</span>
                                <span>{format(internalDate, "PPP")}</span>
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
                                            <BookingCard
                                                booking={{
                                                    facility_id: internalFacilityId!,
                                                    facility_name: booking.request_title,
                                                    date: format(internalDate, "yyyy-MM-dd"),
                                                    time_start: booking.time_start,
                                                    time_end: booking.time_end,
                                                    equipment: [],
                                                    borrowed_equipment: [],
                                                    conflicts: [],
                                                    external_equipment: [],
                                                    expected_capacity: null,
                                                    has_outsiders: false,
                                                    equipment_conflicts: {},
                                                    facility_capacity: facility?.capacity ?? null,
                                                    request_facility_status: booking.status ?? null,
                                                }}
                                                index={idx}
                                                showActions={false}
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
                    )}
                </motion.div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                    Pick a facility above to view its details and schedule.
                </p>
            )}
        </div>
    );
}
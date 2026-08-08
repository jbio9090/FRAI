import { format } from 'date-fns';
import { AlertCircleIcon, CalendarIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { BookingSchedule } from '../types';
import { addCalendarDays, formatTime } from '../utils';

interface ScheduleSectionProps {
    selectedDates: Date[];
    handleDateChange: (dates: Date[] | undefined) => void;
    minSelectableDate: Date;
    availableDaysOfWeek: number[];
    hasNearMinimumScheduleDate: boolean;
    bookingTimeOptions: string[];
    availableEndTimeOptions: string[];
    currentTimeStart: string;
    currentTimeEnd: string;
    handleTimeStartChange: (time: string) => void;
    handleTimeEndChange: (time: string) => void;
    expectedCapacity: number | '';
    setExpectedCapacity: (value: number | '') => void;
    hasOutsiders: boolean;
    setHasOutsiders: (value: boolean) => void;
    scheduleConflicts: BookingSchedule[];
}

export function ScheduleSection({
    selectedDates,
    handleDateChange,
    minSelectableDate,
    availableDaysOfWeek,
    hasNearMinimumScheduleDate,
    bookingTimeOptions,
    availableEndTimeOptions,
    currentTimeStart,
    currentTimeEnd,
    handleTimeStartChange,
    handleTimeEndChange,
    expectedCapacity,
    setExpectedCapacity,
    hasOutsiders,
    setHasOutsiders,
    scheduleConflicts,
}: ScheduleSectionProps) {
    return (
        <section className="ads-card p-5 md:p-6">
            <div className="mb-5 border-b border-border pb-3">
                <span className="ads-eyebrow">Schedule</span>
            </div>
            <div className="space-y-5">
                {/* Date + Time row */}
                <div className="grid w-full grid-cols-[1fr_1fr] gap-4 md:grid-cols-[3fr_2fr_2fr]">
                    <div className="col-span-full space-y-2 md:col-span-1">
                        <Label>
                            Date <span className="text-destructive">*</span>
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                        'w-full justify-start text-left font-normal',
                                        selectedDates.length === 0 && 'text-muted-foreground',
                                    )}
                                >
                                    <CalendarIcon className="mr-1 h-4 w-4" />
                                    {selectedDates.length === 0
                                        ? 'Pick a date'
                                        : selectedDates.length === 1
                                          ? format(selectedDates[0], 'PPP')
                                          : `${selectedDates.length} dates selected`}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="multiple"
                                    selected={selectedDates}
                                    onSelect={handleDateChange}
                                    initialFocus
                                    disabled={(date) => addCalendarDays(date, 0) < minSelectableDate || !availableDaysOfWeek.includes(date.getDay())}
                                />
                            </PopoverContent>
                        </Popover>
                        {hasNearMinimumScheduleDate && (
                            <Alert className="border-[var(--ads-amber)]/50 bg-[var(--ads-amber-bg)] text-[var(--ads-amber)]">
                                <AlertCircleIcon className="text-[var(--ads-amber)]" />
                                <AlertTitle className="font-semibold text-[var(--ads-amber)]">Short Notice Schedule</AlertTitle>
                                <AlertDescription className="text-[var(--ads-amber)]">
                                    This selected date is close to the minimum lead time. Please make sure all requirements can be prepared before
                                    submitting.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="time_start">
                            Start Time <span className="text-destructive">*</span>
                        </Label>
                        <Select value={currentTimeStart} onValueChange={handleTimeStartChange}>
                            <SelectTrigger id="time_start" className="w-full text-sm">
                                <SelectValue placeholder="Select start time" />
                            </SelectTrigger>
                            <SelectContent>
                                {bookingTimeOptions.map((time) => (
                                    <SelectItem key={time} value={time}>
                                        {formatTime(time)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="time_end">
                            End Time <span className="text-destructive">*</span>
                        </Label>
                        <Select value={currentTimeEnd} onValueChange={handleTimeEndChange}>
                            <SelectTrigger id="time_end" className="w-full text-sm">
                                <SelectValue placeholder="Select end time" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableEndTimeOptions.map((time) => (
                                    <SelectItem key={time} value={time}>
                                        {formatTime(time)}
                                    </SelectItem>
                                ))}
                                {availableEndTimeOptions.length === 0 && (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No end times available</div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Attendees + Outsiders */}
                <div className="flex w-fit items-end gap-4">
                    <div className="flex-1 space-y-2">
                        <Label htmlFor="expected_capacity">Expected Attendees</Label>
                        <Input
                            id="expected_capacity"
                            type="number"
                            min="1"
                            value={expectedCapacity}
                            onChange={(e) => setExpectedCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="How many attendees?"
                            className="max-w-84 text-sm"
                        />
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pb-2">
                        <Checkbox id="has_outsiders" checked={hasOutsiders} onCheckedChange={(checked) => setHasOutsiders(!!checked)} />
                        <Label htmlFor="has_outsiders" className="cursor-pointer text-sm whitespace-nowrap">
                            Has Outsiders
                        </Label>
                    </div>
                </div>

                {scheduleConflicts.length > 0 && (
                    <Alert className="border-[var(--ads-amber)]/50 bg-[var(--ads-amber-bg)] text-[var(--ads-amber)]">
                        <AlertCircleIcon className="text-[var(--ads-amber)]" />
                        <AlertTitle className="font-semibold text-[var(--ads-amber)]">Time Conflict Detected</AlertTitle>
                        <AlertDescription className="text-[var(--ads-amber)]">
                            <p className="mb-2">Your selected time overlaps with existing facility bookings:</p>
                            <div className="space-y-1.5">
                                {scheduleConflicts.map((c, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-1.5 rounded border border-[var(--ads-amber)]/40 bg-[var(--ads-amber-bg)]/60 px-2 py-1.5 text-xs text-[var(--ads-amber)]"
                                    >
                                        <AlertCircleIcon size={14} className="mt-0.5 shrink-0" />
                                        <span>
                                            <strong>{c.request_title}</strong> <br />
                                            Time: {formatTime(c.time_start)} - {formatTime(c.time_end)} —{' '}
                                            <span className={c.status === 'Approved' ? 'font-semibold text-[var(--ads-danger)]' : 'font-semibold'}>
                                                {c.status}
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        </section>
    );
}

import { useState } from 'react';
import { Facility } from '../hooks/useBookingFlow';
import DatePicker from './DatePicker';

interface AvailabilityQuickFlowProps {
    facilities: Facility[];
    onComplete: (selection: { facility: Facility; date: string; startTime: string; endTime: string }) => void;
    onCancel: () => void;
}

const TIME_OPTIONS = [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
];

export default function AvailabilityQuickFlow({
    facilities,
    onComplete,
    onCancel,
}: AvailabilityQuickFlowProps) {
    const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedStartTime, setSelectedStartTime] = useState<string>('');

    const handleFacilitySelect = (facilityName: string) => {
        const facility = facilities.find(item => item.name === facilityName);

        if (!facility) {
            return;
        }

        setSelectedFacility(facility);
    };

    const handleDateSelect = (date: string) => {
        setSelectedDate(date);
    };

    const handleStartTimeSelect = (time: string) => {
        setSelectedStartTime(time);
    };

    const handleEndTimeSelect = (time: string) => {
        if (!selectedFacility || !selectedDate || !selectedStartTime) {
            return;
        }

        onComplete({
            facility: selectedFacility,
            date: selectedDate,
            startTime: selectedStartTime,
            endTime: time,
        });
    };

    const facilityOptions = facilities.length > 0
        ? facilities.map(facility => facility.name)
        : ['Loading rooms...'];

    return (
        <div className="space-y-4">
            <div className="flex gap-4 justify-start animate-in fade-in">
                <div className="bg-muted h-10 w-10 rounded-lg flex items-center justify-center font-bold text-muted-foreground flex-shrink-0 text-sm">
                    AI
                </div>
                <div className="max-w-[70%] px-5 py-3 rounded-lg border bg-muted border-border text-foreground">
                    <div className="text-xs uppercase font-mono text-muted-foreground mb-2 tracking-wide">
                        assistant
                    </div>

                    {!selectedFacility && (
                        <>
                            <div className="text-sm whitespace-pre-wrap">Please select a room to check availability.</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {facilityOptions.map(option => (
                                    <button
                                        key={option}
                                        onClick={() => handleFacilitySelect(option)}
                                        disabled={facilities.length === 0}
                                        className="px-3 py-1.5 text-xs rounded-lg border
                                            border-border bg-background text-foreground
                                            hover:bg-muted hover:border-ring
                                            dark:border-white/20 dark:bg-transparent dark:text-white
                                            dark:hover:bg-white/10 dark:hover:border-white/60
                                            font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {selectedFacility && !selectedDate && (
                        <>
                            <div className="text-sm whitespace-pre-wrap">
                                Select a date for {selectedFacility.name}.
                            </div>
                            <DatePicker onSelect={handleDateSelect} />
                        </>
                    )}

                    {selectedFacility && selectedDate && !selectedStartTime && (
                        <>
                            <div className="text-sm whitespace-pre-wrap">
                                Select a start time for {selectedFacility.name} on {selectedDate}.
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {TIME_OPTIONS.map(option => (
                                    <button
                                        key={option}
                                        onClick={() => handleStartTimeSelect(option)}
                                        className="px-3 py-1.5 text-xs rounded-lg border
                                            border-border bg-background text-foreground
                                            hover:bg-muted hover:border-ring
                                            dark:border-white/20 dark:bg-transparent dark:text-white
                                            dark:hover:bg-white/10 dark:hover:border-white/60
                                            font-medium transition-all duration-150 active:scale-[0.97]"
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {selectedFacility && selectedDate && selectedStartTime && (
                        <>
                            <div className="text-sm whitespace-pre-wrap">
                                Select an end time for {selectedFacility.name} on {selectedDate}. Start time is {selectedStartTime}.
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {TIME_OPTIONS.map(option => (
                                    <button
                                        key={option}
                                        onClick={() => handleEndTimeSelect(option)}
                                        className="px-3 py-1.5 text-xs rounded-lg border
                                            border-border bg-background text-foreground
                                            hover:bg-muted hover:border-ring
                                            dark:border-white/20 dark:bg-transparent dark:text-white
                                            dark:hover:bg-white/10 dark:hover:border-white/60
                                            font-medium transition-all duration-150 active:scale-[0.97]"
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="mt-3">
                        <button
                            onClick={onCancel}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { Facility } from '../hooks/useBookingFlow';
import DatePicker from './DatePicker';
import TypingMessage from './TypingMessage';

interface AvailabilityQuickFlowProps {
    facilities: Facility[];
    onComplete: (selection: { facility: Facility; date: string; startTime: string; endTime: string }) => void;
    onCancel: () => void;
}

const TIME_OPTIONS = [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
];

function toMinutes(time: string): number {
    const [timePart, modifier] = time.split(' ');
    const [rawHours, rawMinutes] = timePart.split(':').map(Number);
    let hours = rawHours;
    const minutes = rawMinutes;
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return (hours * 60) + minutes;
}

export default function AvailabilityQuickFlow({
    facilities,
    onComplete,
    onCancel,
}: AvailabilityQuickFlowProps) {
    const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedStartTime, setSelectedStartTime] = useState<string>('');
    const [isTypingPrompt, setIsTypingPrompt] = useState(true);

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

        if (toMinutes(time) <= toMinutes(selectedStartTime)) {
            return;
        }

        onComplete({
            facility: selectedFacility,
            date: selectedDate,
            startTime: selectedStartTime,
            endTime: time,
        });
    };

    const handleReturn = () => {
        if (selectedStartTime) {
            setSelectedStartTime('');
            return;
        }

        if (selectedDate) {
            setSelectedDate('');
            return;
        }

        if (selectedFacility) {
            setSelectedFacility(null);
        }
    };

    const facilityOptions = facilities.length > 0
        ? facilities.map(facility => facility.name)
        : ['Loading rooms...'];

    const currentPrompt = !selectedFacility
        ? 'Please select a room to check availability.'
        : !selectedDate
            ? `Select a date for ${selectedFacility.name}.`
            : !selectedStartTime
                ? `Select a start time for ${selectedFacility.name} on ${selectedDate}.`
                : `Select an end time for ${selectedFacility.name} on ${selectedDate}. Start time is ${selectedStartTime}.`;

    const promptKey = [
        selectedFacility?.id ?? 'none',
        selectedDate || 'none',
        selectedStartTime || 'none',
    ].join(':');

    const maxEndTime = TIME_OPTIONS[TIME_OPTIONS.length - 1];
    const availableStartTimes = TIME_OPTIONS.filter(
        option => toMinutes(option) < toMinutes(maxEndTime)
    );

    const availableEndTimes = selectedStartTime
        ? TIME_OPTIONS.filter(option => toMinutes(option) > toMinutes(selectedStartTime))
        : TIME_OPTIONS;

    useEffect(() => {
        setIsTypingPrompt(true);
    }, [promptKey]);

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
                    <TypingMessage
                        text={currentPrompt}
                        messageKey={promptKey}
                        onComplete={() => setIsTypingPrompt(false)}
                    />

                    {!isTypingPrompt && !selectedFacility && (
                        <>
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

                    {!isTypingPrompt && selectedFacility && !selectedDate && (
                        <>
                            <DatePicker onSelect={handleDateSelect} />
                        </>
                    )}

                    {!isTypingPrompt && selectedFacility && selectedDate && !selectedStartTime && (
                        <>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {availableStartTimes.map(option => (
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

                    {!isTypingPrompt && selectedFacility && selectedDate && selectedStartTime && (
                        <>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {availableEndTimes.map(option => (
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

                    {!isTypingPrompt && (
                        <div className="mt-3 flex gap-4">
                            {(selectedFacility || selectedDate || selectedStartTime) && (
                                <button
                                    onClick={handleReturn}
                                    className="text-xs text-muted-foreground hover:text-foreground underline"
                                >
                                    Return
                                </button>
                            )}
                            <button
                                onClick={onCancel}
                                className="text-xs text-muted-foreground hover:text-foreground underline"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

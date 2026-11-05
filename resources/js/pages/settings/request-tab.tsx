import { router, useForm } from '@inertiajs/react';
import { Plus, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { RequestOptions } from '@/types/request';

interface RequestTabProps {
    requestOptions: RequestOptions;
}

const STEP_OPTIONS = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
    const total = index * 15;
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

function formatTime(time: string): string {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

export default function RequestTab({ requestOptions }: RequestTabProps) {
    const { data, setData, errors } = useForm({
        approvers: requestOptions.approvers,
        booking_window: {
            start_time: requestOptions.booking_window.start_time,
            end_time: requestOptions.booking_window.end_time,
            days_of_week: requestOptions.booking_window.days_of_week,
            step_minutes: requestOptions.booking_window.step_minutes,
        },
        min_advance_days: requestOptions.min_advance_days,
    });
    const [newApprover, setNewApprover] = useState('');
    const reduceMotion = useReducedMotion();

    const addApprover = () => {
        const trimmed = newApprover.trim();
        if (!trimmed || data.approvers.includes(trimmed)) return;

        const prevApprovers = data.approvers;
        setData('approvers', [...prevApprovers, trimmed]);
        setNewApprover('');

        router.post(route('settings.request.approvers.add'), {
            approver: trimmed,
        }, {
            preserveScroll: true,
            onError: () => {
                setData('approvers', prevApprovers);
                toast.error('Failed to add approver.');
            },
        });
    };

    const removeApprover = (name: string) => {
        const prevApprovers = data.approvers;
        setData('approvers', prevApprovers.filter((approver) => approver !== name));

        router.post(route('settings.request.approvers.remove'), {
            approver: name,
        }, {
            preserveScroll: true,
            onError: () => {
                setData('approvers', prevApprovers);
                toast.error('Failed to remove approver.');
            },
        });
    };

    const handleStartTimeChange = (value: string) => {
        const prevStartTime = data.booking_window.start_time;
        setData('booking_window.start_time', value);

        router.post(route('settings.request.booking-window.start-time'), {
            start_time: value,
        }, {
            preserveScroll: true,
            onError: () => {
                setData('booking_window.start_time', prevStartTime);
                toast.error('Failed to update start time.');
            },
        });
    };

    const handleEndTimeChange = (value: string) => {
        const prevEndTime = data.booking_window.end_time;
        setData('booking_window.end_time', value);

        router.post(route('settings.request.booking-window.end-time'), {
            end_time: value,
        }, {
            preserveScroll: true,
            onError: () => {
                setData('booking_window.end_time', prevEndTime);
                toast.error('Failed to update end time.');
            },
        });
    };

    const handleStepMinutesChange = (value: string) => {
        const prevStep = data.booking_window.step_minutes;
        const stepValue = Number(value);
        setData('booking_window.step_minutes', stepValue);

        router.post(route('settings.request.booking-window.step-minutes'), {
            step_minutes: stepValue,
        }, {
            preserveScroll: true,
            onError: () => {
                setData('booking_window.step_minutes', prevStep);
                toast.error('Failed to update time step.');
            },
        });
    };

    const toggleDay = (day: number) => {
        const prevDays = data.booking_window.days_of_week;
        const newDays = prevDays.includes(day)
            ? prevDays.filter((d) => d !== day)
            : [...prevDays, day].sort((a, b) => a - b);
        setData('booking_window.days_of_week', newDays);

        router.post(route('settings.request.booking-window.days-of-week.toggle'), {
            day,
        }, {
            preserveScroll: true,
            onError: () => {
                setData('booking_window.days_of_week', prevDays);
                toast.error('Failed to update available days.');
            },
        });
    };

    const handleMinAdvanceDaysChange = (value: string) => {
        const numValue = value === '' ? 0 : Number(value);
        const prevMinAdvance = data.min_advance_days;
        setData('min_advance_days', numValue);

        router.post(route('settings.request.min-advance-days'), {
            min_advance_days: numValue,
        }, {
            preserveScroll: true,
            onError: () => {
                setData('min_advance_days', prevMinAdvance);
                toast.error('Failed to update minimum advance days.');
            },
        });
    };

    const motionProps = {
        initial: reduceMotion ? false : { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, ease: 'easeOut' as const },
    };

    return (
        <div className="mt-6 flex flex-col gap-6">
            {/* <motion.div {...motionProps}>
                <div className="flex flex-col gap-1">
                    <p className="frai-eyebrow">Request configuration</p>
                    <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Request Options</h1>
                    <p className="text-sm text-muted-foreground">
                        Defaults for new facility requests. Will not affect already sent requests.
                    </p>
                </div>
            </motion.div> */}

            <motion.div {...motionProps}>
                <div className="flex flex-col gap-6 text-sm">
                    <section className="frai-card p-5 md:p-6">
                        <div className="mb-4 flex flex-col gap-1">
                            <span className="frai-eyebrow">Approvers</span>
                            <p className="text-sm text-muted-foreground">
                                Who a requester can select in the "Approved By" section of the request form.
                            </p>
                        </div>

                        <div className="space-y-8">
                            {data.approvers.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {data.approvers.map((approver, index) => (
                                        <div
                                            key={approver}
                                            className={cn(
                                                'flex items-center gap-1.5 rounded-[4px] px-3 py-1 text-sm font-medium',
                                                index === 0
                                                    ? 'bg-[var(--ads-ok-bg)] text-[var(--ads-ok)]'
                                                    : 'bg-[var(--ads-neutral-bg)] text-[var(--ads-neutral)]'
                                            )}
                                        >
                                            <span>{approver}</span>
                                            <button
                                                type="button"
                                                aria-label={`Remove ${approver}`}
                                                className="text-muted-foreground hover:text-destructive cursor-pointer"
                                                onClick={() => removeApprover(approver)}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No approvers added yet.</p>
                            )}
                            {errors.approvers && <p className="text-xs text-destructive">{errors.approvers}</p>}

                            <div className="flex gap-2 mt-4">
                                <Input
                                    value={newApprover}
                                    onChange={(e) => setNewApprover(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addApprover();
                                        }
                                    }}
                                    placeholder="Add an approver, e.g. Registrar"
                                    className="text-sm"
                                />
                                <Button type="button" variant="secondary" onClick={addApprover}>
                                    <Plus size={16} />
                                    Add
                                </Button>
                            </div>
                        </div>
                    </section>

                    <section className="frai-card p-5 md:p-6 text-sm">
                        <div className="mb-4 flex flex-col gap-1">
                            <span className="frai-eyebrow">Booking window</span>
                        </div>

                        <div className="space-y-8">
                            <div className="grid grid-cols-2 gap-4 my-4">
                                <div className="space-y-2">
                                    <Label htmlFor="start_time">Start Time</Label>
                                    <Select
                                        value={data.booking_window.start_time}
                                        onValueChange={handleStartTimeChange}
                                    >
                                        <SelectTrigger id="start_time" className="text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-72">
                                            {TIME_OPTIONS.map((time) => (
                                                <SelectItem key={time} value={time}>
                                                    {formatTime(time)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors['booking_window.start_time'] && (
                                        <p className="text-xs text-destructive">{errors['booking_window.start_time']}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="end_time">End Time</Label>
                                    <Select
                                        value={data.booking_window.end_time}
                                        onValueChange={handleEndTimeChange}
                                    >
                                        <SelectTrigger id="end_time" className="text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-72">
                                            {TIME_OPTIONS.map((time) => (
                                                <SelectItem key={time} value={time}>
                                                    {formatTime(time)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors['booking_window.end_time'] && (
                                        <p className="text-xs text-destructive">{errors['booking_window.end_time']}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="step_minutes">Time Step</Label>
                                <Select
                                    value={data.booking_window.step_minutes.toString()}
                                    onValueChange={handleStepMinutesChange}
                                >
                                    <SelectTrigger id="step_minutes" className="w-full text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STEP_OPTIONS.map((step) => (
                                            <SelectItem key={step.value} value={step.value.toString()}>
                                                {step.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors['booking_window.step_minutes'] && (
                                    <p className="text-xs text-destructive">{errors['booking_window.step_minutes']}</p>
                                )}
                            </div>

                            <div className="space-y-3">
                                <Label className="font-semibold text-sm">Available Days</Label>
                                <div className="flex flex-wrap gap-4">
                                    {DAYS_OF_WEEK.map((day, index) => (
                                        <div key={day} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`day-${index}`}
                                                checked={data.booking_window.days_of_week.includes(index)}
                                                onCheckedChange={() => toggleDay(index)}
                                            />
                                            <Label htmlFor={`day-${index}`}>{day}</Label>
                                        </div>
                                    ))}
                                    {errors['booking_window.days_of_week'] && (
                                        <p className="text-xs text-destructive">{errors['booking_window.days_of_week']}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="min_advance_days">Minimum Advance Days</Label>
                                <Input
                                    id="min_advance_days"
                                    type="number"
                                    min="0"
                                    max="365"
                                    value={data.min_advance_days}
                                    onChange={(e) => handleMinAdvanceDaysChange(e.target.value)}
                                    className="max-w-40 text-sm"
                                />
                                <p className="text-xs text-muted-foreground">How many days in advance a request must be submitted.</p>
                                {errors.min_advance_days && <p className="text-xs text-destructive">{errors.min_advance_days}</p>}
                            </div>
                        </div>
                    </section>
                </div>
            </motion.div>
        </div>
    );
}

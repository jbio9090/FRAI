import { useForm } from '@inertiajs/react';
import { Plus, Save, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
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
import DefaultLayout from '@/layout.tsx/default.';
import { cn } from '@/lib/utils';
import type { RequestOptions } from '@/types/request';

interface PageProps extends Record<string, unknown> {
    settings: RequestOptions;
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

export default function RequestOptionsSettings({ settings }: PageProps) {
    const { data, setData, post, processing, errors } = useForm({
        approvers: settings.approvers,
        booking_window: {
            start_time: settings.booking_window.start_time,
            end_time: settings.booking_window.end_time,
            days_of_week: settings.booking_window.days_of_week,
            step_minutes: settings.booking_window.step_minutes,
        },
        min_advance_days: settings.min_advance_days,
    });
    const [newApprover, setNewApprover] = useState('');
    const reduceMotion = useReducedMotion();

    const addApprover = () => {
        const trimmed = newApprover.trim();
        if (!trimmed || data.approvers.includes(trimmed)) return;
        setData('approvers', [...data.approvers, trimmed]);
        setNewApprover('');
    };

    const removeApprover = (name: string) => {
        setData('approvers', data.approvers.filter((approver) => approver !== name));
    };

    const toggleDay = (day: number) => {
        const days = data.booking_window.days_of_week;
        setData('booking_window.days_of_week', days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('request-options.update'), { preserveScroll: true });
    };

    const motionProps = {
        initial: reduceMotion ? false : { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, ease: 'easeOut' as const },
    };

    return (
        <DefaultLayout>
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
                <motion.div {...motionProps}>
                    <div className="flex flex-col gap-1">
                        <p className="ads-eyebrow">Request configuration</p>
                        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Request Options</h1>
                        <p className="text-sm text-muted-foreground">
                            Defaults for new facility requests, also used when the chatbot helps with booking.
                        </p>
                    </div>
                </motion.div>

                <motion.div {...motionProps}>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <section className="ads-card p-5 md:p-6">
                            <div className="mb-4 flex flex-col gap-1">
                                <span className="ads-eyebrow">Approvers</span>
                                <p className="text-sm text-muted-foreground">
                                    Who a requester can select in the "Approved By" section of the request form.
                                </p>
                            </div>

                            <div className="space-y-4">
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
                                                    className="text-muted-foreground hover:text-destructive"
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

                                <div className="flex gap-2">
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

                        <section className="ads-card p-5 md:p-6">
                            <div className="mb-4 flex flex-col gap-1">
                                <span className="ads-eyebrow">Booking window</span>
                                <p className="text-sm text-muted-foreground">
                                    Available hours and days for scheduling facility requests. Also used by the chatbot.
                                </p>
                            </div>

                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="start_time">Start Time</Label>
                                        <Select
                                            value={data.booking_window.start_time}
                                            onValueChange={(value) => setData('booking_window.start_time', value)}
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
                                            onValueChange={(value) => setData('booking_window.end_time', value)}
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
                                        onValueChange={(value) => setData('booking_window.step_minutes', Number(value))}
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
                                    <Label className="font-semibold">Available Days</Label>
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
                                    </div>
                                    {errors['booking_window.days_of_week'] && (
                                        <p className="text-xs text-destructive">{errors['booking_window.days_of_week']}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="min_advance_days">Minimum Advance Days</Label>
                                    <Input
                                        id="min_advance_days"
                                        type="number"
                                        min="0"
                                        max="365"
                                        value={data.min_advance_days}
                                        onChange={(e) => setData('min_advance_days', Number(e.target.value))}
                                        className="max-w-40 text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">How many days in advance a request must be submitted.</p>
                                    {errors.min_advance_days && <p className="text-xs text-destructive">{errors.min_advance_days}</p>}
                                </div>
                            </div>
                        </section>

                        <div className="ads-card sticky bottom-0 z-10 flex items-center justify-end gap-2 p-4">
                            <Button type="submit" disabled={processing}>
                                <Save size={16} />
                                {processing ? 'Saving…' : 'Save changes'}
                            </Button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </DefaultLayout>
    );
}

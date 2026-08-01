import { useForm } from '@inertiajs/react';
import { Plus, Save, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
        post(route('request-settings.update'), { preserveScroll: true });
    };

    return (
        <DefaultLayout>
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
                <div>
                    <h1 className="text-lg font-semibold">Request Settings</h1>
                    <p className="text-sm text-muted-foreground">Configure the options available when creating a facility request.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Approvers</CardTitle>
                            <CardDescription>Who a requester can select in the "Approved By" section of the request form.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {data.approvers.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {data.approvers.map((approver) => (
                                        <div
                                            key={approver}
                                            className="flex items-center gap-1.5 rounded-full border bg-muted/20 px-3 py-1 text-sm"
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
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Booking Window</CardTitle>
                            <CardDescription>Available hours and days for scheduling facility requests. Also used by the chatbot.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
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
                        </CardContent>
                    </Card>

                    <Card>
                        <CardFooter className="justify-end">
                            <Button type="submit" disabled={processing}>
                                <Save size={16} />
                                {processing ? 'Saving…' : 'Save Changes'}
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </div>
        </DefaultLayout>
    );
}

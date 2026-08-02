import { BookMarked, Check, Clock, GraduationCap, Landmark, Paperclip, Save, Sparkles, UsersRound } from 'lucide-react';
import { useState } from 'react';
import ChamferCard from '@/components/design/ChamferCard';
import PreviewLayout from '@/components/design/PreviewLayout';
import StatusBadge from '@/components/design/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const PRIORITIES = [
    { value: 0, icon: BookMarked, label: 'Routine' },
    { value: 1, icon: UsersRound, label: 'Department' },
    { value: 2, icon: GraduationCap, label: 'Academic' },
    { value: 3, icon: Landmark, label: 'University' },
] as const;

const FACILITIES = ['Auditorium', 'Covered Court', 'Music Hall', 'Room 204', 'Multi-Purpose Gym'];
const DATES = ['Mon, Aug 10', 'Tue, Aug 11', 'Wed, Aug 12', 'Thu, Aug 13', 'Fri, Aug 14'];
const TIMES = ['07:00', '08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

function toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m ?? 0);
}

function duration(start: string, end: string): string {
    if (!start || !end) return '—';
    const diff = toMinutes(end) - toMinutes(start);
    if (diff <= 0) return '—';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

function FieldBlock({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-medium text-[var(--card-foreground)]">
                {label} {required && <span className="text-[var(--bp-danger)]">*</span>}
            </Label>
            {children}
        </div>
    );
}

export default function PreviewCreateRequest() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<0 | 1 | 2 | 3>(0);
    const [facility, setFacility] = useState('');
    const [date, setDate] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [capacity, setCapacity] = useState('');
    const [outsiders, setOutsiders] = useState(false);
    const [notes, setNotes] = useState('');

    const priorityMeta = PRIORITIES.find((p) => p.value === priority)!;

    return (
        <PreviewLayout crumb="preview / create">
            <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-1.5">
                    <p className="bp-eyebrow">New Request Form</p>
                    <h1 className="font-display text-3xl font-semibold tracking-tight">Request facility &amp; equipment</h1>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                        Draft · nothing is saved in this mockup
                    </p>
                </div>

                <div className="grid items-start gap-6 lg:grid-cols-[7fr_5fr]">
                    {/* ── Form ─────────────────────────────────────────── */}
                    <div className="flex flex-col gap-6">
                        <ChamferCard>
                            <form
                                className="flex flex-col gap-5 p-6"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                }}
                            >
                                <div className="flex flex-col gap-1">
                                    <p className="bp-eyebrow">Request Details</p>
                                </div>

                                <FieldBlock label="Request Title" required>
                                    <Input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g., Gamecon 2026"
                                        className="bg-[var(--card)]"
                                    />
                                </FieldBlock>

                                <FieldBlock label="Description">
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Provide details about your request"
                                        rows={3}
                                        className="bg-[var(--card)]"
                                    />
                                </FieldBlock>

                                <FieldBlock label="Event Type" required>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {PRIORITIES.map((p) => {
                                            const Icon = p.icon;
                                            const active = priority === p.value;
                                            return (
                                                <button
                                                    key={p.value}
                                                    type="button"
                                                    onClick={() => setPriority(p.value)}
                                                    className={cn(
                                                        'flex items-center justify-center gap-2 border px-3 py-2.5 text-sm font-medium transition-colors',
                                                        active
                                                            ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                                                            : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50 hover:text-[var(--foreground)]',
                                                    )}
                                                >
                                                    <Icon className="size-4" />
                                                    <span className="text-xs font-semibold uppercase tracking-wider">{p.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </FieldBlock>

                                <div className="flex flex-col gap-1">
                                    <p className="bp-eyebrow">Facility &amp; Time</p>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FieldBlock label="Facility" required>
                                        <Select value={facility} onValueChange={setFacility}>
                                            <SelectTrigger className="w-full bg-[var(--card)]">
                                                <SelectValue placeholder="Select facility" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {FACILITIES.map((f) => (
                                                    <SelectItem key={f} value={f}>
                                                        {f}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FieldBlock>

                                    <FieldBlock label="Date" required>
                                        <Select value={date} onValueChange={setDate}>
                                            <SelectTrigger className="w-full bg-[var(--card)]">
                                                <SelectValue placeholder="Pick a date" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DATES.map((d) => (
                                                    <SelectItem key={d} value={d}>
                                                        {d}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FieldBlock>

                                    <FieldBlock label="Start Time" required>
                                        <Select value={start} onValueChange={setStart}>
                                            <SelectTrigger className="w-full bg-[var(--card)]">
                                                <SelectValue placeholder="From" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TIMES.map((t) => (
                                                    <SelectItem key={t} value={t}>
                                                        {t}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FieldBlock>

                                    <FieldBlock label="End Time" required>
                                        <Select value={end} onValueChange={setEnd}>
                                            <SelectTrigger className="w-full bg-[var(--card)]">
                                                <SelectValue placeholder="To" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TIMES.map((t) => (
                                                    <SelectItem key={t} value={t}>
                                                        {t}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FieldBlock>

                                    <FieldBlock label="Expected Capacity">
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            value={capacity}
                                            onChange={(e) => setCapacity(e.target.value)}
                                            placeholder="e.g., 150"
                                            className="bg-[var(--card)]"
                                        />
                                    </FieldBlock>
                                </div>

                                <label className="flex items-center gap-2.5 text-sm">
                                    <Checkbox checked={outsiders} onCheckedChange={(v) => setOutsiders(v === true)} />
                                    <span>Has outside attendees</span>
                                </label>

                                <div className="flex flex-col gap-1">
                                    <p className="bp-eyebrow">Additional Notes</p>
                                </div>

                                <FieldBlock label="Requirements &amp; Notes">
                                    <Textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Special setup, equipment needs, access notes…"
                                        rows={3}
                                        className="bg-[var(--card)]"
                                    />
                                </FieldBlock>

                                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
                                    <Button type="submit" className="gap-2">
                                        <Check className="size-4" />
                                        Submit Request
                                    </Button>
                                    <Button type="button" variant="outline" className="gap-2">
                                        <Save className="size-4" />
                                        Save draft
                                    </Button>
                                    <Button type="button" variant="ghost" className="gap-2">
                                        <Sparkles className="size-4" />
                                        Ask AI Assistant
                                    </Button>
                                </div>
                            </form>
                        </ChamferCard>

                        <div className="flex items-center gap-2 border border-dashed border-[var(--border)] px-4 py-3 text-xs font-medium text-[var(--muted-foreground)]">
                            <Paperclip className="size-4 shrink-0" />
                            Attachments live in the final form — drag files here is mocked.
                        </div>
                    </div>

                    {/* ── Live summary ─────────────────────────────────── */}
                    <ChamferCard size="lg" className="lg:sticky lg:top-24">
                        <div className="flex flex-col gap-5 p-6">
                            <div className="flex flex-col gap-0.5">
                                <p className="bp-eyebrow">Booking Summary</p>
                                <h2 className="text-lg font-semibold tracking-tight">Pre-submission check</h2>
                            </div>

                            <StatusBadge status="Pending" />

                            <div className="flex flex-col divide-y divide-[var(--border)] text-sm">
                                {(
                                    [
                                        ['Request', title || 'Untitled request'],
                                        ['Event Type', priorityMeta.label],
                                        ['Facility', facility || '—'],
                                        ['Date', date || '—'],
                                        ['Time', start && end ? `${start} – ${end}` : '—'],
                                        ['Duration', duration(start, end)],
                                        ['Capacity', capacity ? `${capacity} pax` : '—'],
                                        ['Outsiders', outsiders ? 'Yes' : 'No'],
                                    ] as const
                                ).map(([k, v]) => (
                                    <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
                                        <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{k}</dt>
                                        <dd className={cn('text-right font-medium', k === 'Request' && 'font-semibold')}>{v}</dd>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-start gap-3 border border-[var(--bp-amber)]/40 bg-[var(--bp-amber-bg)] p-3">
                                <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--bp-amber)]" />
                                <p className="text-xs text-[var(--bp-amber)]">
                                    The AI pre-check runs here after a real facility &amp; time are chosen — conflicts, capacity and
                                    rule violations surface in mono.
                                </p>
                            </div>

                            <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs font-medium text-[var(--muted-foreground)]">
                                <span>Draft status</span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock className="size-3.5" />
                                    auto-saved locally
                                </span>
                            </div>
                        </div>
                    </ChamferCard>
                </div>
            </div>
        </PreviewLayout>
    );
}

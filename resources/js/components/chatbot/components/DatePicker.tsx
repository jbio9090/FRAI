import { useState } from 'react';

interface DatePickerProps {
    onSelect: (dateISO: string) => void;
    minAdvanceDays?: number;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export default function DatePicker({ onSelect, minAdvanceDays = 0 }: DatePickerProps) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minSelectableDate = new Date(today);
    minSelectableDate.setDate(minSelectableDate.getDate() + minAdvanceDays);
    minSelectableDate.setHours(0, 0, 0, 0);

    const [viewYear, setViewYear] = useState(minSelectableDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(minSelectableDate.getMonth());
    const [selected, setSelected] = useState<string | null>(null);

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const prevMonth = () => {
        if (viewYear === minSelectableDate.getFullYear() && viewMonth === minSelectableDate.getMonth()) return;
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(y => y - 1);
        } else {
            setViewMonth(m => m - 1);
        }
    };

    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(y => y + 1);
        } else {
            setViewMonth(m => m + 1);
        }
    };

    const isBlocked = (day: number): boolean => {
        const d = new Date(viewYear, viewMonth, day);
        d.setHours(0, 0, 0, 0);
        return d < minSelectableDate;
    };

    const isSelected = (day: number): boolean => {
        return selected === `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const handleDayClick = (day: number) => {
        if (isBlocked(day)) return;
        const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setSelected(iso);
        onSelect(iso);
    };

    const atCurrentMonth = viewYear === minSelectableDate.getFullYear() && viewMonth === minSelectableDate.getMonth();

    return (
        <div className="mt-3 bg-background border border-border rounded-xl shadow-sm p-4 w-full max-w-xs mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={prevMonth}
                    disabled={atCurrentMonth}
                    className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground"
                >
                    ‹
                </button>
                <span className="text-sm font-semibold text-foreground">
                    {MONTHS[viewMonth]} {viewYear}
                </span>
                <button
                    onClick={nextMonth}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                    ›
                </button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 mb-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const blocked = isBlocked(day);
                    const sel = isSelected(day);
                    return (
                        <button
                            key={day}
                            onClick={() => handleDayClick(day)}
                            disabled={blocked}
                            className={`
                                text-xs rounded-lg py-1.5 transition-all font-medium
                                ${blocked
                                    ? 'bg-black text-white/40 cursor-not-allowed'
                                    : 'hover:bg-muted cursor-pointer text-foreground'
                                }
                                ${sel
                                    ? 'bg-primary text-primary-foreground hover:bg-primary'
                                    : ''
                                }
                            `}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

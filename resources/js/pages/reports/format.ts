function parseDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

function formatDay(value: string): string {
    const date = parseDate(value);
    if (!date) {
        return value;
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatRange(start: string, end: string): string | null {
    const startDate = parseDate(start);
    const endDate = parseDate(end);

    if (!startDate || !endDate) {
        return null;
    }

    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const startLabel = `${startMonth} ${startDate.getDate()}`;
    const endLabel = startYear === endYear
        ? `${endMonth.split(', ')[0]} ${endDate.getDate()}`
        : endMonth;

    return `${startLabel} – ${endLabel}`;
}

function formatNumber(value: number, maxFractionDigits = 1): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxFractionDigits }).format(value);
}

function pluralize(count: number, singular: string, plural?: string): string {
    if (count === 1) {
        return singular;
    }

    return plural ?? `${singular}s`;
}

function formatPercent(value: number): string {
    return formatNumber(value, 2);
}

function share(value: number, total: number): number {
    if (total === 0) {
        return 0;
    }

    return (value / total) * 100;
}

function leading<T>(
    rows: T[],
    valueOf: (row: T) => number
): T | null {
    if (rows.length === 0) {
        return null;
    }

    let best: T | null = null;
    let bestValue = -Infinity;

    for (const row of rows) {
        const value = valueOf(row);
        if (value > bestValue) {
            bestValue = value;
            best = row;
        }
    }

    return best;
}

export { formatDay, formatRange, formatNumber, formatPercent, pluralize, share, leading };

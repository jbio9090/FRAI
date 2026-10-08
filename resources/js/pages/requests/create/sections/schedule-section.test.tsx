import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Facility } from '@/types/facility';
import { ScheduleSection } from './schedule-section';

function facility(id: number, capacity: number): Facility {
    return { id, name: 'Test Hall', capacity, building: '', status: 'active', equipment: [] } as unknown as Facility;
}

function renderSection(expectedCapacity: number | '', selectedFacilityId: number | null) {
    return render(
        <ScheduleSection
            selectedDates={[]}
            handleDateChange={() => {}}
            minSelectableDate={new Date()}
            availableDaysOfWeek={[0, 1, 2, 3, 4, 5, 6]}
            hasNearMinimumScheduleDate={false}
            bookingTimeOptions={['09:00']}
            availableEndTimeOptions={['10:00']}
            currentTimeStart=""
            currentTimeEnd=""
            handleTimeStartChange={() => {}}
            handleTimeEndChange={() => {}}
            expectedCapacity={expectedCapacity}
            setExpectedCapacity={() => {}}
            hasOutsiders={false}
            setHasOutsiders={() => {}}
            scheduleConflicts={[]}
            checkingConflicts={false}
            facilities={[facility(1, 50)]}
            selectedFacilityId={selectedFacilityId}
        />,
    );
}

describe('ScheduleSection capacity hint', () => {
    it('shows the passive capacity hint when attendees are within capacity', () => {
        renderSection(30, 1);

        expect(screen.getByText('Capacity: 50')).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('shows the passive hint when the input is still empty', () => {
        renderSection('', 1);

        expect(screen.getByText('Capacity: 50')).toBeInTheDocument();
    });

    it('warns inline when expected attendees exceed the facility capacity', () => {
        renderSection(60, 1);

        expect(screen.getByRole('status')).toHaveTextContent("Expected attendees exceed this facility's capacity (60 expected, 50 capacity).");
    });

    it('treats exactly-at-capacity as fitting', () => {
        renderSection(50, 1);

        expect(screen.getByText('Capacity: 50')).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('shows no capacity hint until a facility is selected', () => {
        renderSection(60, null);

        expect(screen.queryByText(/Capacity/)).not.toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});

import { describe, expect, it } from 'vitest';
import { validateCreateRequest } from './validation';

const baseBooking = {
    facility_id: 1,
    facility_name: 'Assembly Hall',
    date: '2026-11-10',
    time_start: '09:00',
    time_end: '10:00',
    equipment: [],
    external_equipment: [],
    borrowed_equipment: [],
    expected_capacity: null,
    has_outsiders: false,
    conflicts: [],
    equipment_conflicts: {},
};

const baseEquipment = {
    equipment_id: 1,
    equipment_name: 'Folding Table',
    quantity_needed: 1,
    max_quantity: 10,
};

const baseBorrowed = {
    equipment_id: 1,
    equipment_name: 'Folding Table',
    source_facility_id: 2,
    source_facility_name: 'Other Hall',
    quantity_needed: 1,
    max_quantity: 10,
};

function baseForm(overrides: Partial<Parameters<typeof validateCreateRequest>[0]> = {}) {
    return {
        title: 'Gamecon',
        description: '',
        facility_bookings: [baseBooking],
        priority_level: 0,
        priority_reason: '',
        approved_by: [],
        files: [],
        existing_file_ids: [],
        ...overrides,
    } as Parameters<typeof validateCreateRequest>[0];
}

describe('validateCreateRequest', () => {
    it('returns no errors for a valid request', () => {
        expect(validateCreateRequest(baseForm())).toEqual({});
    });

    it('flags a completely empty request', () => {
        const errors = validateCreateRequest({
            title: '',
            description: '',
            facility_bookings: [],
            priority_level: 0,
            priority_reason: '',
            approved_by: [],
            files: [],
            existing_file_ids: [],
        });

        expect(errors.title).toBe('This field is required.');
        expect(errors.facility_bookings).toBe('At least one facility booking is required.');
    });

    it('flags missing title', () => {
        const errors = validateCreateRequest(baseForm({ title: '' }));
        expect(errors.title).toBe('This field is required.');
    });

    it('flags title over 255 characters', () => {
        const errors = validateCreateRequest(baseForm({ title: 'a'.repeat(256) }));
        expect(errors.title).toBe('Must not exceed 255 characters.');
    });

    it('flags priority_reason over 512 characters', () => {
        const errors = validateCreateRequest(baseForm({ priority_reason: 'a'.repeat(513) }));
        expect(errors.priority_reason).toBe('Must not exceed 512 characters.');
    });

    it('flags invalid priority_level', () => {
        const errors = validateCreateRequest(baseForm({ priority_level: 9 as never }));
        expect(errors.priority_level).toBe('Priority must be 0, 1, 2 or 3.');
    });

    it('accepts valid priority levels 0-3', () => {
        for (const level of [0, 1, 2, 3]) {
            const errors = validateCreateRequest(baseForm({ priority_level: level }));
            expect(errors.priority_level).toBeUndefined();
        }
    });

    it('flags booking with no facility_id', () => {
        const errors = validateCreateRequest(baseForm({ facility_bookings: [{ ...baseBooking, facility_id: undefined as never }] }));
        expect(errors['facility_bookings.0.facility_id']).toBe('This field is required.');
    });

    it('flags booking with no date', () => {
        const errors = validateCreateRequest(baseForm({ facility_bookings: [{ ...baseBooking, date: '' }] }));
        expect(errors['facility_bookings.0.date']).toBe('This field is required.');
    });

    it('flags booking with invalid date format', () => {
        const errors = validateCreateRequest(baseForm({ facility_bookings: [{ ...baseBooking, date: 'not-a-date' }] }));
        expect(errors['facility_bookings.0.date']).toBe('Please enter a valid date.');
    });

    it('flags booking with no time_start', () => {
        const errors = validateCreateRequest(baseForm({ facility_bookings: [{ ...baseBooking, time_start: '' }] }));
        expect(errors['facility_bookings.0.time_start']).toBe('This field is required.');
    });

    it('flags booking with no time_end', () => {
        const errors = validateCreateRequest(baseForm({ facility_bookings: [{ ...baseBooking, time_end: '' }] }));
        expect(errors['facility_bookings.0.time_end']).toBe('This field is required.');
    });

    it('flags equipment missing equipment_id', () => {
        const errors = validateCreateRequest(
            baseForm({
                facility_bookings: [{ ...baseBooking, equipment: [{ ...baseEquipment, equipment_id: undefined as never }] }],
            }),
        );
        expect(errors['facility_bookings.0.equipment.0.equipment_id']).toBe('This field is required.');
    });

    it('flags equipment with quantity_needed 0', () => {
        const errors = validateCreateRequest(
            baseForm({
                facility_bookings: [{ ...baseBooking, equipment: [{ ...baseEquipment, quantity_needed: 0 }] }],
            }),
        );
        expect(errors['facility_bookings.0.equipment.0.quantity_needed']).toBe('Must be at least 1.');
    });

    it('flags borrowed equipment missing source_facility_id', () => {
        const errors = validateCreateRequest(
            baseForm({
                facility_bookings: [{ ...baseBooking, borrowed_equipment: [{ ...baseBorrowed, source_facility_id: undefined as never }] }],
            }),
        );
        expect(errors['facility_bookings.0.borrowed_equipment.0.source_facility_id']).toBe('This field is required.');
    });

    it('flags borrowed equipment with quantity_needed 0', () => {
        const errors = validateCreateRequest(
            baseForm({
                facility_bookings: [{ ...baseBooking, borrowed_equipment: [{ ...baseBorrowed, quantity_needed: 0 }] }],
            }),
        );
        expect(errors['facility_bookings.0.borrowed_equipment.0.quantity_needed']).toBe('Must be at least 1.');
    });

    it('flags external equipment missing name', () => {
        const errors = validateCreateRequest(
            baseForm({ facility_bookings: [{ ...baseBooking, external_equipment: [{ name: '' }] }] }),
        );
        expect(errors['facility_bookings.0.external_equipment.0.name']).toBe('This field is required.');
    });

    it('flags expected_capacity below 1', () => {
        const errors = validateCreateRequest(baseForm({ facility_bookings: [{ ...baseBooking, expected_capacity: 0 }] }));
        expect(errors['facility_bookings.0.expected_capacity']).toBe('Must be at least 1.');
    });

    it('flags more than 10 files', () => {
        const errors = validateCreateRequest(baseForm({ files: Array.from({ length: 11 }, () => new File([''], 'f.txt')) }));
        expect(errors.files).toBe('You may only attach up to 10 files.');
    });

    it('accepts exactly 10 files', () => {
        const errors = validateCreateRequest(baseForm({ files: Array.from({ length: 10 }, () => new File([''], 'f.txt')) }));
        expect(errors.files).toBeUndefined();
    });

    it('collects multiple errors across fields', () => {
        const errors = validateCreateRequest(
            baseForm({
                title: '',
                facility_bookings: [
                    { ...baseBooking, facility_id: undefined as never, time_start: '' },
                    { ...baseBooking, facility_id: undefined as never, time_end: '' },
                ],
            }),
        );
        expect(errors.title).toBeDefined();
        expect(errors['facility_bookings.0.facility_id']).toBeDefined();
        expect(errors['facility_bookings.0.time_start']).toBeDefined();
        expect(errors['facility_bookings.1.facility_id']).toBeDefined();
        expect(errors['facility_bookings.1.time_end']).toBeDefined();
    });
});

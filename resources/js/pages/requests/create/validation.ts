import type { CreateRequestFormData } from './types';

export type ValidationErrors = Record<string, string>;

const REQUIRED = 'This field is required.';
const INVALID_DATE = 'Please enter a valid date.';
const INVALID_INTEGER = 'Must be a whole number.';
const MIN_ONE = 'Must be at least 1.';
const MIN_ONE_BOOKING = 'At least one facility booking is required.';
const MAX_10_FILES = 'You may only attach up to 10 files.';
const INVALID_PRIORITY = 'Priority must be 0, 1, 2 or 3.';

function required(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return REQUIRED;
    if (Array.isArray(value) && value.length === 0) return REQUIRED;
    return null;
}

function maxLength(value: string, max: number): string | null {
    if (value.length > max) return `Must not exceed ${max} characters.`;
    return null;
}

function isDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
}

function isInteger(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value) || /^-?\d+$/.test(String(value ?? ''));
}

export function validateCreateRequest(data: CreateRequestFormData): ValidationErrors {
    const errors: ValidationErrors = {};

    if (required(data.title)) errors.title = REQUIRED;
    else {
        const max = maxLength(data.title, 255);
        if (max) errors.title = max;
    }

    if (data.priority_reason !== undefined && data.priority_reason !== null) {
        const max = maxLength(String(data.priority_reason), 512);
        if (max) errors.priority_reason = max;
    }

    if (data.priority_level !== undefined && data.priority_level !== null) {
        if (![0, 1, 2, 3].includes(data.priority_level as number)) errors.priority_level = INVALID_PRIORITY;
    }

    if (required(data.facility_bookings)) errors.facility_bookings = MIN_ONE_BOOKING;

    if (Array.isArray(data.facility_bookings)) {
        data.facility_bookings.forEach((booking, bi) => {
            const prefix = `facility_bookings.${bi}`;

            if (required(booking.facility_id)) errors[`${prefix}.facility_id`] = REQUIRED;

            if (required(booking.date)) errors[`${prefix}.date`] = REQUIRED;
            else if (typeof booking.date === 'string' && !isDate(booking.date)) errors[`${prefix}.date`] = INVALID_DATE;

            if (required(booking.time_start)) errors[`${prefix}.time_start`] = REQUIRED;
            if (required(booking.time_end)) errors[`${prefix}.time_end`] = REQUIRED;

            if (Array.isArray(booking.equipment)) {
                booking.equipment.forEach((eq, ei) => {
                    const ep = `${prefix}.equipment.${ei}`;
                    if (required(eq.equipment_id)) errors[`${ep}.equipment_id`] = REQUIRED;
                    else if (!isInteger(eq.equipment_id)) errors[`${ep}.equipment_id`] = INVALID_INTEGER;

                    if (required(eq.quantity_needed)) errors[`${ep}.quantity_needed`] = REQUIRED;
                    else if (!isInteger(eq.quantity_needed)) errors[`${ep}.quantity_needed`] = INVALID_INTEGER;
                    else if (eq.quantity_needed < 1) errors[`${ep}.quantity_needed`] = MIN_ONE;
                });
            }

            if (Array.isArray(booking.external_equipment)) {
                booking.external_equipment.forEach((ee, ei) => {
                    const ep = `${prefix}.external_equipment.${ei}`;
                    if (required(ee.name)) errors[`${ep}.name`] = REQUIRED;
                    else {
                        const max = maxLength(String(ee.name), 255);
                        if (max) errors[`${ep}.name`] = max;
                    }
                });
            }

            if (Array.isArray(booking.borrowed_equipment)) {
                booking.borrowed_equipment.forEach((be, ei) => {
                    const ep = `${prefix}.borrowed_equipment.${ei}`;
                    if (required(be.equipment_id)) errors[`${ep}.equipment_id`] = REQUIRED;
                    else if (!isInteger(be.equipment_id)) errors[`${ep}.equipment_id`] = INVALID_INTEGER;

                    if (required(be.source_facility_id)) errors[`${ep}.source_facility_id`] = REQUIRED;

                    if (required(be.quantity_needed)) errors[`${ep}.quantity_needed`] = REQUIRED;
                    else if (!isInteger(be.quantity_needed)) errors[`${ep}.quantity_needed`] = INVALID_INTEGER;
                    else if (be.quantity_needed < 1) errors[`${ep}.quantity_needed`] = MIN_ONE;
                });
            }

            if (booking.expected_capacity !== undefined && booking.expected_capacity !== null) {
                if (!isInteger(booking.expected_capacity)) {
                    errors[`${prefix}.expected_capacity`] = INVALID_INTEGER;
                } else if (booking.expected_capacity < 1) {
                    errors[`${prefix}.expected_capacity`] = MIN_ONE;
                }
            }
        });
    }

    if (Array.isArray(data.files) && data.files.length > 10) errors.files = MAX_10_FILES;

    return errors;
}

export function hasValidationErrors(errors: ValidationErrors): boolean {
    return Object.keys(errors).length > 0;
}

<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

class RequestSettingsService
{
    private const CACHE_KEY = 'request_options.settings';

    private const DEFAULT_APPROVERS = [
        'Faculty',
        'College Dean',
        'Chairperson',
        'OSA',
        'VP AA',
        'VP Admin',
        'President',
    ];

    private const DEFAULT_BOOKING_WINDOW = [
        'start_time' => '07:00',
        'end_time' => '20:00',
        'days_of_week' => [0, 1, 2, 3, 4, 5, 6],
        'step_minutes' => 30,
    ];

    private const DEFAULT_MIN_ADVANCE_DAYS = 5;

    /**
     * The full request-options snapshot, keyed by setting key.
     *
     * Missing rows fall back to defaults so the app never breaks when a
     * setting has not been seeded yet.
     *
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        return array_merge(
            Cache::rememberForever(self::CACHE_KEY, function () {
                $rows = Setting::query()->pluck('value', 'key');

                return [
                    'approvers' => $rows->get('request.approvers', self::DEFAULT_APPROVERS),
                    'booking_window' => array_replace(self::DEFAULT_BOOKING_WINDOW, $rows->get('request.booking_window', [])),
                    'min_advance_days' => $rows->get('request.min_advance_days', self::DEFAULT_MIN_ADVANCE_DAYS),
                ];
            }),
            [
                'max_file_size_mb' => self::maxFileSizeMb(),
            ]
        );
    }

    /**
     * Get the maximum file upload size in megabytes from PHP configuration.
     * Returns null if unlimited or not configured.
     */
    public static function maxFileSizeMb(): ?float
    {
        $value = ini_get('upload_max_filesize');
        if ($value === false || $value === '' || trim($value) === '-1') {
            return null;
        }

        return self::parseIniSize($value);
    }

    /**
     * Get the maximum file upload size in kilobytes (for Laravel validation rules).
     * Returns null if unlimited or not configured.
     */
    public static function maxFileSizeKb(): ?int
    {
        $mb = self::maxFileSizeMb();
        if ($mb === null) {
            return null;
        }

        return (int) round($mb * 1024);
    }

    /**
     * Parse a PHP ini size string (e.g., "10M", "512K", "1G") into megabytes as float.
     */
    private static function parseIniSize(string $value): float
    {
        $value = trim($value);
        $lastChar = strtolower($value[-1]);
        $num = (float) substr($value, 0, -1);

        return match ($lastChar) {
            'k' => $num / 1024,
            'm' => $num,
            'g' => $num * 1024,
            default => (float) $value / (1024 * 1024),
        };
    }

    /**
     * @return array<int, string>
     */
    public static function approvers(): array
    {
        return self::all()['approvers'];
    }

    /**
     * @return array{start_time: string, end_time: string, days_of_week: array<int, int>, step_minutes: int}
     */
    public static function bookingWindow(): array
    {
        return self::all()['booking_window'];
    }

    public static function minAdvanceDays(): int
    {
        return (int) self::all()['min_advance_days'];
    }

    /**
     * Persist a subset of request options and invalidate the cache.
     *
     * @param  array<string, mixed>  $values
     */
    public static function update(array $values): void
    {
        foreach ($values as $key => $value) {
            Setting::updateOrCreate(['key' => $key], ['value' => $value]);
        }

        Cache::forget(self::CACHE_KEY);
    }
}

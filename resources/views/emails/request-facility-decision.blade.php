<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Facility Decision - {{ config('app.name') }}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; line-height: 1.6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
            <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="text-align: center;">
                                        @php
                                            $statusColors = [
                                                'approved' => '#10b981',
                                                'denied' => '#ef4444',
                                                'conditionally_approved' => '#f59e0b',
                                                'for_reschedule' => '#8b5cf6',
                                                'on_hold' => '#6366f1',
                                                'pending' => '#f59e0b',
                                                'partially_approved' => '#06b6d4',
                                            ];
                                            $statusIcons = [
                                                'approved' => '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />',
                                                'denied' => '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />',
                                                'conditionally_approved' => '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3m0 3v3m-9-9h18" />',
                                                'for_reschedule' => '<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />',
                                                'on_hold' => '<path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />',
                                                'pending' => '<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />',
                                                'partially_approved' => '<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
                                            ];
                                            $statusKey = strtolower(str_replace('_', '_', $status));
                                            $iconColor = $statusColors[$statusKey] ?? '#1a1a2e';
                                            $iconPath = $statusIcons[$statusKey] ?? $statusIcons['pending'];
                                        @endphp
                                        <div style="display: inline-block; background: rgba(255,255,255,0.1); border-radius: 50%; width: 64px; height: 64px; line-height: 64px; margin-bottom: 16px;">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="{{ $iconColor }}" stroke-width="2" style="margin-top: 16px;">
                                                {!! $iconPath !!}
                                            </svg>
                                        </div>
                                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">Facility Decision</h1>
                                        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">{{ $requestTitle }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 32px;">
                            <!-- Facility Name -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="background: #f8fafc; border-radius: 8px; padding: 20px; border-left: 4px solid {{ $iconColor }};">
                                        <h2 style="margin: 0 0 8px; color: #111827; font-size: 18px; font-weight: 600;">{{ $facilityName }}</h2>
                                        <p style="margin: 0; color: #6b7280; font-size: 14px;">Booking for request: {{ $requestTitle }}</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Status Badge -->
                            @php
                                $badgeColors = [
                                    'approved' => ['bg' => '#d1fae5', 'text' => '#065f46'],
                                    'denied' => ['bg' => '#fee2e2', 'text' => '#991b1b'],
                                    'conditionally_approved' => ['bg' => '#fef3c7', 'text' => '#92400e'],
                                    'on_hold' => ['bg' => '#e0e7ff', 'text' => '#3730a3'],
                                    'for_reschedule' => ['bg' => '#f3e8ff', 'text' => '#6b21a8'],
                                    'partially_approved' => ['bg' => '#cffafe', 'text' => '#155e75'],
                                    'pending' => ['bg' => '#fef3c7', 'text' => '#92400e'],
                                ];
                                $badge = $badgeColors[$statusKey] ?? $badgeColors['pending'];
                            @endphp
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <span style="display: inline-block; background: {{ $badge['bg'] }}; color: {{ $badge['text'] }}; padding: 10px 24px; border-radius: 9999px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">{{ ucfirst(str_replace('_', ' ', $status)) }}</span>
                                    </td>
                                </tr>
                            </table>

                            <!-- Details -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="color: #374151; font-size: 15px;">
                                        {{ $body }}
                                    </td>
                                </tr>
                            </table>

                            <!-- Action Button -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="{{ $url }}" style="display: inline-block; background: #1a1a2e; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                                            View Request Details
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
                            <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px;">&copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.</p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">Manage email preferences in <a href="{{ config('app.url') }}/settings" style="color: #1a1a2e; text-decoration: underline;">Settings</a>.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
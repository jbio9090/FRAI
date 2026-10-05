<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reschedule Required - {{ config('app.name') }}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; line-height: 1.6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
            <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 32px; text-align: center;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="text-align: center;">
                                        <div style="display: inline-block; background: rgba(255,255,255,0.15); border-radius: 50%; width: 64px; height: 64px; line-height: 64px; margin-bottom: 16px;">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" style="margin-top: 16px;">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </div>
                                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">Reschedule Required</h1>
                                        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">{{ $requestTitle }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 32px;">
                            <!-- Alert Box -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="width: 32px; vertical-align: top;">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
                                                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                </td>
                                                <td style="color: #92400e; font-size: 14px; padding-left: 12px;">
                                                    <strong>Action Required:</strong> Another event is scheduled at the same facility during your requested time. Please edit your request to choose a different time or date.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Facility Details -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="background: #f8fafc; border-radius: 8px; padding: 20px; border-left: 4px solid #f59e0b;">
                                        <h2 style="margin: 0 0 12px; color: #111827; font-size: 18px; font-weight: 600;">{{ $facility }}</h2>
                                        <table role="presentation" cellpadding="0" cellspacing="0" style="color: #374151; font-size: 14px;">
                                            <tr>
                                                <td style="padding: 4px 0;"><strong>Date:</strong> {{ $date }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px 0;"><strong>Time:</strong> {{ $time }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Action Button -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="{{ $url }}" style="display: inline-block; background: #f59e0b; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                                            Edit Request & Choose New Time
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Note -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px;">
                                <tr>
                                    <td style="color: #166534; font-size: 13px;">
                                        <strong>Tip:</strong> When editing your request, check the "Suggested Reschedule Options" tab for admin-recommended alternative times that may work better for everyone.
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
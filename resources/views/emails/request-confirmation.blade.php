<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Request Submitted - {{ config('app.name') }}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; line-height: 1.6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
            <td>
                <!-- Header Card -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="text-align: center;">
                                        <div style="display: inline-block; background: rgba(255,255,255,0.1); border-radius: 50%; width: 64px; height: 64px; line-height: 64px; margin-bottom: 16px;">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 16px; color: #ffffff;">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">Request Submitted</h1>
                                        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Your facility request has been received</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 32px;">
                            <!-- Request Title -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="background: #f8fafc; border-radius: 8px; padding: 20px; border-left: 4px solid #1a1a2e;">
                                        <h2 style="margin: 0 0 8px; color: #111827; font-size: 18px; font-weight: 600;">{{ $requestTitle }}</h2>
                                        <p style="margin: 0; color: #6b7280; font-size: 14px;">Request ID: #{{ $requestId }}</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Submitted Info -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="color: #6b7280; font-size: 14px;">Submitted on {{ $submittedAt }}</td>
                                </tr>
                            </table>

                            <!-- Facilities Table -->
                            @if(!empty($facilities))
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="color: #374151; font-size: 14px; font-weight: 600; margin-bottom: 12px; display: block;">Requested Facilities</td>
                                </tr>
                                @foreach($facilities as $index => $facility)
                                <tr>
                                    <td style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="color: #111827; font-size: 15px; font-weight: 600; padding-bottom: 8px;">{{ $facility['name'] }}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #6b7280; font-size: 13px;">
                                                    <table role="presentation" cellpadding="0" cellspacing="0">
                                                        <tr>
                                                            <td style="padding-right: 16px;"><strong>Date:</strong> {{ $facility['date'] }}</td>
                                                            <td><strong>Time:</strong> {{ $facility['timeStart'] }} - {{ $facility['timeEnd'] }}</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                @endforeach
                            </table>
                            @endif

                            <!-- Status Badge -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td>
                                        <span style="display: inline-block; background: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Pending Review</span>
                                    </td>
                                </tr>
                            </table>

                            <!-- Action Button -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="{{ $url }}" style="display: inline-block; background: #1a1a2e; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; transition: background 0.2s;">
                                            View Request Details
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Note -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px;">
                                <tr>
                                    <td style="color: #166534; font-size: 13px;">
                                        <strong>What's next?</strong> Your request is now under review. You'll receive email updates when admins review your request (if you have email notifications enabled in settings).
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
                            <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px;">&copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.</p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">You can manage your email preferences in <a href="{{ config('app.url') }}/settings" style="color: #1a1a2e; text-decoration: underline;">Settings</a>.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
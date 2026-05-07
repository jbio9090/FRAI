<?php

namespace App\Notifications;

use App\Models\Request as FacilityRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;

class AdminAiRecommendationReady extends Notification implements ShouldQueue
{
    use Queueable;

    protected int $requestId;

    public function __construct(
        FacilityRequest $facilityRequest,
    ) {
        $this->requestId = $facilityRequest->id;
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $request = FacilityRequest::with(['user', 'files', 'requestFacilities.facility'])->findOrFail($this->requestId);

        Log::info('Preparing admin AI recommendation email.', [
            'request_id' => $request->id,
            'request_title' => $request->title,
            'recipient_user_id' => $notifiable->id ?? null,
            'recipient_email' => $notifiable->email ?? null,
            'mail_mailer' => config('mail.default'),
            'mail_host' => config('mail.mailers.smtp.host'),
            'mail_port' => config('mail.mailers.smtp.port'),
            'mail_from_address' => config('mail.from.address'),
            'mail_from_name' => config('mail.from.name'),
        ]);

        return (new MailMessage)
            ->subject('AI recommendation ready: '.$request->title)
            ->markdown('emails.admin-ai-recommendation-ready', [
                'requestModel' => $request,
                'hasFiles' => $request->files->isNotEmpty(),
                'approveUrl' => $this->signedActionUrl($request, 'approve', $notifiable->id),
                'rescheduleUrl' => $this->signedActionUrl($request, 'for_reschedule', $notifiable->id),
                'detailUrl' => route('requests.detail', ['request_id' => $request->id]),
            ]);
    }

    private function signedActionUrl(FacilityRequest $request, string $action, int $adminId): string
    {
        return URL::temporarySignedRoute(
            'requests.email-action',
            now()->addHours(6),
            [
                'id' => $request->id,
                'action' => $action,
                'admin_id' => $adminId,
            ],
        );
    }
}

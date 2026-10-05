<?php

namespace App\Notifications;

use App\Models\Request as FacilityRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RequestSubmitted extends Notification implements ShouldQueue
{
    use Queueable;

    protected FacilityRequest $request;

    public function __construct(FacilityRequest $request)
    {
        $this->request = $request;
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $this->request->loadMissing(['requestFacilities.facility', 'user']);

        return (new MailMessage)
            ->subject('Request Submitted: '.$this->request->title)
            ->markdown('emails.request-confirmation', [
                'requestTitle' => $this->request->title,
                'requestId' => $this->request->id,
                'submittedAt' => $this->request->created_at?->format('F j, Y g:i A'),
                'facilities' => $this->request->requestFacilities->map(function ($rf) {
                    return [
                        'name' => $rf->facility?->name ?? 'Unknown Facility',
                        'date' => $rf->date_requested ? \Carbon\Carbon::parse($rf->date_requested)->format('F j, Y') : 'TBD',
                        'timeStart' => $rf->time_start ? \Carbon\Carbon::parse($rf->time_start)->format('g:i A') : 'TBD',
                        'timeEnd' => $rf->time_end ? \Carbon\Carbon::parse($rf->time_end)->format('g:i A') : 'TBD',
                    ];
                })->toArray(),
                'url' => route('requests.detail', ['request_id' => $this->request->id]),
            ]);
    }
}
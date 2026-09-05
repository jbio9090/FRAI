<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RescheduleAlternativesChosen extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $requestTitle,
        public string $url,
        public array $alternatives,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reschedule Options Available: '.$this->requestTitle,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.reschedule-alternatives-chosen',
            with: [
                'requestTitle' => $this->requestTitle,
                'url' => $this->url,
                'alternatives' => $this->alternatives,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
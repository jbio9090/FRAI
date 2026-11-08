<?php

namespace App\Mail\Transports;

use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BrevoTransport extends AbstractTransport
{
    protected string $apiKey;
    protected string $senderName;
    protected string $senderEmail;

    public function __construct(string $apiKey, string $senderName = 'FRAI', string $senderEmail = 'frai.plv@gmail.com')
    {
        $this->apiKey = $apiKey;
        $this->senderName = $senderName;
        $this->senderEmail = $senderEmail;
    }

    protected function doSend(SentMessage $message): SentMessage
    {
        $email = $message->getMessage();

        if (! $email instanceof Email) {
            throw new \UnexpectedValueException('BrevoTransport expects an Email instance.');
        }

        $payload = [
            'sender' => [
                'name' => $this->senderName,
                'email' => $this->senderEmail,
            ],
            'to' => $this->formatRecipients($email->getTo()),
            'subject' => $email->getSubject() ?? '',
        ];

        if ($cc = $email->getCc()) {
            $payload['cc'] = $this->formatRecipients($cc);
        }

        if ($bcc = $email->getBcc()) {
            $payload['bcc'] = $this->formatRecipients($bcc);
        }

        $htmlBody = $email->getHtmlBody();
        $textBody = $email->getTextBody();

        if ($htmlBody) {
            $payload['htmlContent'] = $htmlBody;
        } elseif ($textBody) {
            $payload['textContent'] = $textBody;
        } else {
            $payload['textContent'] = '';
        }

        // Handle attachments (Brevo expects base64-encoded content)
        $attachments = $email->getAttachments();
        if ($attachments->count() > 0) {
            $payload['attachment'] = [];
            foreach ($attachments as $attachment) {
                $payload['attachment'][] = [
                    'name' => $attachment->getName(),
                    'type' => $attachment->getMimeType(),
                    'content' => base64_encode(file_get_contents($attachment->getPath())),
                    'content_id' => $attachment->getId(),
                ];
            }
        }

        $response = Http::withHeaders([
            'api-key' => $this->apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ])->timeout(30)->post('https://api.brevo.com/v3/smtp/email', $payload);

        if (! $response->successful()) {
            Log::error('Brevo API email failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \Symfony\Component\Mailer\Exception\TransportException(
                'Brevo API error: '.$response->status().' '.$response->body()
            );
        }

        Log::info('Brevo API email sent', [
            'message_id' => $response->json('messageId'),
            'to' => array_column($payload['to'], 'email'),
        ]);

        return $message;
    }

    /**
     * Format an array of Address objects into Brevo recipient format.
     */
    protected function formatRecipients(array $recipients): array
    {
        $formatted = [];
        foreach ($recipients as $recipient) {
            if (! $recipient instanceof Address) {
                continue;
            }
            $formatted[] = [
                'email' => $recipient->getAddress(),
                'name' => $recipient->getName() ?? null,
            ];
        }

        return $formatted;
    }

    public function __toString(): string
    {
        return 'brevo';
    }
}

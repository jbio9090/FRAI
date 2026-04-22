<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Request as FacilityRequest;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request as RequestFacade;
use App\AuditEvent;
use App\Models\RequestFile;

class AuditLogger
{
    /**
     * Write a single audit entry.
     *
     * @param  string       $event       Dot-namespaced event: 'request.approved'
     * @param  string|null  $description Human-readable summary
     * @param  Model|null   $subject     The model this event is about
     * @param  array        $properties  Extra key-value metadata
     * @param  int|null     $userId      Defaults to the authenticated user
     */
    public static function log(
        AuditEvent $event,
        ?string $description = null,
        ?Model  $subject      = null,
        array   $properties   = [],
        ?int    $userId       = null,
    ): AuditLog {
        return AuditLog::create([
            'user_id'      => $userId ?? Auth::id(),
            'event'        => $event,
            'subject_type' => $subject ? get_class($subject) : null,
            'subject_id'   => $subject?->getKey(),
            'description'  => $description,
            'properties'   => $properties ?: null,
            'ip_address'   => RequestFacade::ip(),
            'user_agent'   => RequestFacade::userAgent(),
        ]);
    }

    public static function loginSucceeded(int $userId, string $email): AuditLog
    {
        return self::log(
            event: AuditEvent::AuthLogin,
            description: "User logged in: {$email}",
            userId: $userId,
        );
    }

    public static function loginFailed(string $email): AuditLog
    {
        return self::log(
            event: AuditEvent::AuthLoginFailed,
            description: "Failed login attempt for: {$email}",
            properties: ['email' => $email],
            userId: null,
        );
    }

    public static function loggedOut(int $userId, string $email): AuditLog
    {
        return self::log(
            event: AuditEvent::AuthLogout,
            description: "User logged out: {$email}",
            userId: $userId,
        );
    }

    public static function requestCreated(FacilityRequest $request): AuditLog
    {
        return self::log(
            event: AuditEvent::RequestCreated,
            description: "Request created: \"{$request->title}\"",
            subject: $request,
            properties: [
                'title'          => $request->title,
                'priority_level' => $request->priority_level?->value,
                'status'         => $request->status?->value,
            ],
        );
    }

    public static function requestUpdated(FacilityRequest $request, array $changes = []): AuditLog
    {
        return self::log(
            event: AuditEvent::RequestUpdated,
            description: "Request updated: \"{$request->title}\"",
            subject: $request,
            properties: ['changes' => $changes],
        );
    }

    public static function requestApproved(FacilityRequest $request): AuditLog
    {
        $heldOrApproved = $request->on_hold ? 'placed on hold' : 'approved';

        return self::log(
            event: AuditEvent::RequestApproved,
            description: "Request {$heldOrApproved}: \"{$request->title}\"",
            subject: $request,
            properties: [
                'on_hold'            => $request->on_hold,
                'held_by_request_id' => $request->held_by_request_id,
            ],
        );
    }

    public static function requestDenied(FacilityRequest $request): AuditLog
    {
        return self::log(
            event: AuditEvent::RequestDenied,
            description: "Request denied: \"{$request->title}\"",
            subject: $request,
        );
    }

    public static function requestConditionallyApproved(FacilityRequest $request): AuditLog
    {
        return self::log(
            event: AuditEvent::RequestConditionallyApproved,
            description: "Request conditionally approved: \"{$request->title}\"",
            subject: $request,
        );
    }

    public static function requestHeld(FacilityRequest $target, FacilityRequest $heldBy): AuditLog
    {
        return self::log(
            event: AuditEvent::RequestHeld,
            description: "Request \"{$target->title}\" placed on hold by \"{$heldBy->title}\"",
            subject: $target,
            properties: ['held_by_request_id' => $heldBy->id],
        );
    }

    public static function commentAdded(FacilityRequest $request, string $body): AuditLog
    {
        return self::log(
            event: AuditEvent::RequestCommentAdded,
            description: "Comment added on: \"{$request->title}\"",
            subject: $request,
            properties: ['body' => $body],
        );
    }

    public static function requestMarkedForReschedule(FacilityRequest $request): AuditLog
    {
        return self::log(
            event: AuditEvent::RequestMarkedForReschedule,
            description: "Request marked for rescheduling: \"{$request->title}\"",
            subject: $request,
        );
    }

    public static function requestHoldToggled(FacilityRequest $request, bool $onHold): AuditLog
    {
        return self::log(
            event: AuditEvent::RequestHeld,
            description: $onHold
                ? "Request manually placed on hold: \"{$request->title}\""
                : "Request manually removed from hold: \"{$request->title}\"",
            subject: $request,
            properties: ['on_hold' => $onHold],
        );
    }

    public static function requestFileUploaded(FacilityRequest $request, RequestFile $file): AuditLog
    {
        return self::log(
            event: AuditEvent::RequestFileUploaded,
            description: "File uploaded on: \"{$request->title}\" — {$file->original_name}",
            subject: $request,
            properties: [
                'file_id'       => $file->id,
                'original_name' => $file->original_name,
                'mime_type'     => $file->mime_type,
                'size'          => $file->size,
            ],
        );
    }

    public static function requestFileRemoved(FacilityRequest $request, RequestFile $file): AuditLog
    {
        return self::log(
            event: AuditEvent::RequestFileRemoved,
            description: "File removed on: \"{$request->title}\" — {$file->original_name}",
            subject: $request,
            properties: [
                'file_id'       => $file->id,
                'original_name' => $file->original_name,
                'mime_type'     => $file->mime_type,
                'size'          => $file->size,
            ],
        );
    }
}

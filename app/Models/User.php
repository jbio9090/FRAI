<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

/**
 * @mixin \Spatie\Permission\Traits\HasRoles
 */
class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, HasRoles, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'profile',
        'is_active',
        'force_password_change',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'admin_email_notifications_enabled' => 'boolean',
            'email_verified_at'                 => 'datetime',
            'password'                          => 'hashed',
            'is_active'                         => 'boolean',
            'force_password_change'             => 'boolean',
        ];
    }

    public function routeNotificationForFcm()
    {
        // Return an array of FCM tokens for this user (multi-device)
        return $this->fcmTokens()->pluck('fcm_token')->filter()->values()->toArray();
    }

    public function fcmTokens()
    {
        return $this->hasMany(UserFcmToken::class);
    }
}

<?php

namespace App\Models\Traits;

use App\Models\DeviceToken;
use Illuminate\Database\Eloquent\Relations\HasMany;

trait HasFcmTokens
{
    public function fcmTokens(): HasMany
    {
        return $this->hasMany(DeviceToken::class);
    }

    public function activeFcmTokens(): HasMany
    {
        return $this->fcmTokens()->active();
    }

    public function routeNotificationForFcm(): array
    {
        return $this->activeFcmTokens()->pluck('token')->toArray();
    }

    public function registerFcmToken(string $token, string $platform = 'web'): void
    {
        // Tokens are globally unique (one row per device). The same browser
        // yields the same token for different logins, so upsert by token and
        // reassign ownership instead of scoping to this user (which would hit
        // the unique constraint with a 500 on the second account).
        DeviceToken::updateOrCreate(
            ['token' => $token],
            ['user_id' => $this->getKey(), 'platform' => $platform, 'is_active' => true]
        );
    }

    public function removeFcmToken(string $token): void
    {
        $this->fcmTokens()->where('token', $token)->update(['is_active' => false]);
    }

    public function purgeInactiveTokens(): void
    {
        $this->fcmTokens()->where('is_active', false)->delete();
    }
}

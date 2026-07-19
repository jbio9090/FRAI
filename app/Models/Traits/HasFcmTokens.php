<?php

namespace App\Models\Traits;

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
        $this->fcmTokens()->updateOrCreate(
            ['token' => $token],
            ['platform' => $platform, 'is_active' => true]
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

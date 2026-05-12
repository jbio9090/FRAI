<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('user_fcm_tokens')) {
            return;
        }

        // Delete duplicate rows keeping the one with the smallest id for each user/token pair
        $keepIds = DB::table('user_fcm_tokens')
            ->select(DB::raw('MIN(id) as id'))
            ->groupBy('user_id', 'fcm_token')
            ->pluck('id')
            ->toArray();

        if (! empty($keepIds)) {
            DB::table('user_fcm_tokens')
                ->whereNotIn('id', $keepIds)
                ->delete();
        }

        // Add a unique index to prevent future duplicates (user_id + token)
        Schema::table('user_fcm_tokens', function (Blueprint $table) {
            $table->unique(['user_id', 'fcm_token'], 'user_fcm_tokens_user_token_unique');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('user_fcm_tokens')) {
            return;
        }

        Schema::table('user_fcm_tokens', function (Blueprint $table) {
            $table->dropUnique('user_fcm_tokens_user_token_unique');
        });
    }
};

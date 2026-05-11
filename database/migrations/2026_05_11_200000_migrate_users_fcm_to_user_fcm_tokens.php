<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

return new class extends Migration
{
    public function up(): void
    {
        // Only act if the users table has the old single-token column
        if (! Schema::hasTable('users')) {
            return;
        }

        if (Schema::hasColumn('users', 'fcm_token')) {
            if (! Schema::hasTable('user_fcm_tokens')) {
                Schema::create('user_fcm_tokens', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('user_id')->constrained()->onDelete('cascade');
                    $table->text('fcm_token');
                    $table->string('device_type')->nullable();
                    $table->timestamps();
                });
            }

            $users = DB::table('users')
                ->select('id', 'fcm_token')
                ->whereNotNull('fcm_token')
                ->where('fcm_token', '!=', '')
                ->get();

            $now = Carbon::now();

            foreach ($users as $u) {
                DB::table('user_fcm_tokens')->updateOrInsert([
                    'user_id' => $u->id,
                    'fcm_token' => $u->fcm_token,
                ], [
                    'device_type' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            // drop the single-token column
            Schema::table('users', function (Blueprint $table) {
                if (Schema::hasColumn('users', 'fcm_token')) {
                    $table->dropColumn('fcm_token');
                }
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        if (! Schema::hasColumn('users', 'fcm_token')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('fcm_token')->nullable()->after('remember_token');
            });

            if (Schema::hasTable('user_fcm_tokens')) {
                $users = DB::table('users')->select('id')->get();

                foreach ($users as $user) {
                    $token = DB::table('user_fcm_tokens')
                        ->where('user_id', $user->id)
                        ->value('fcm_token');

                    if ($token) {
                        DB::table('users')->where('id', $user->id)->update(['fcm_token' => $token]);
                    }
                }
            }
        }
    }
};

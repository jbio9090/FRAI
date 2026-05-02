<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE requests ALTER COLUMN recommended_action_reason TYPE TEXT');

            return;
        }

        Schema::table('requests', function (Blueprint $table) {
            $table->text('recommended_action_reason')->nullable()->change();
        });
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE requests ALTER COLUMN recommended_action_reason TYPE VARCHAR(512)');

            return;
        }

        Schema::table('requests', function (Blueprint $table) {
            $table->string('recommended_action_reason', 512)->nullable()->change();
        });
    }
};

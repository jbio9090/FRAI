<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * priority_level: 0 = normal, 1 = school event, 2 = government/high-priority
     * on_hold: true if this request was put on hold due to a higher-priority conflict
     * priority_reason: text description of why this request has priority (from AI context)
     * held_by_request_id: the higher-priority request that caused this to be put on hold
     */
    public function up(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            $table->unsignedTinyInteger('priority_level')->default(0)->after('status');
            $table->boolean('on_hold')->default(false)->after('priority_level');
            $table->string('priority_reason', 512)->nullable()->after('on_hold');
            $table->unsignedBigInteger('held_by_request_id')->nullable()->after('priority_reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            $table->dropColumn(['priority_level', 'on_hold', 'priority_reason', 'held_by_request_id']);
        });
    }
};

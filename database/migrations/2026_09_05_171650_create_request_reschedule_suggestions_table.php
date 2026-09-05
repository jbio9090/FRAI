<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('request_reschedule_suggestions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('request_id')->constrained('requests')->cascadeOnDelete();
            $table->foreignId('chosen_by_admin_id')->constrained('users');
            $table->integer('facility_id');
            $table->string('facility_name');
            $table->date('date');
            $table->time('time_start');
            $table->time('time_end');
            $table->string('type');
            $table->integer('facility_capacity');
            $table->string('capacity_fit');
            $table->boolean('equipment_available');
            $table->timestamps();

            $table->index(['request_id', 'facility_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('request_reschedule_suggestions');
    }
};
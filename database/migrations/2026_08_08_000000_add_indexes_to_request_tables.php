<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('request_facilities', function (Blueprint $table) {
            $table->index(['facility_id', 'date_requested', 'status']);
        });

        Schema::table('requests', function (Blueprint $table) {
            $table->index('status');
        });

        Schema::table('request_equipment', function (Blueprint $table) {
            $table->index('equipment_id');
        });
    }

    public function down(): void
    {
        Schema::table('request_facilities', function (Blueprint $table) {
            $table->dropIndex(['facility_id', 'date_requested', 'status']);
        });

        Schema::table('requests', function (Blueprint $table) {
            $table->dropIndex(['status']);
        });

        Schema::table('request_equipment', function (Blueprint $table) {
            $table->dropIndex(['equipment_id']);
        });
    }
};

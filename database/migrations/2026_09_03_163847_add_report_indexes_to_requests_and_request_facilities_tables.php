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
        Schema::table('requests', function (Blueprint $table) {
            $table->index(['user_id', 'status'], 'requests_user_id_status_index');
            $table->index(['priority_level', 'status'], 'requests_priority_level_status_index');
            $table->index(['processed_at', 'status'], 'requests_processed_at_status_index');
            $table->index(['created_at', 'status'], 'requests_created_at_status_index');
        });

        Schema::table('request_facilities', function (Blueprint $table) {
            $table->index(['date_requested', 'status'], 'request_facilities_date_status_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            $table->dropIndex('requests_user_id_status_index');
            $table->dropIndex('requests_priority_level_status_index');
            $table->dropIndex('requests_processed_at_status_index');
            $table->dropIndex('requests_created_at_status_index');
        });

        Schema::table('request_facilities', function (Blueprint $table) {
            $table->dropIndex('request_facilities_date_status_index');
        });
    }
};

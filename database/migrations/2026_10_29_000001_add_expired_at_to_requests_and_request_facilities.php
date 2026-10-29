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
            $table->timestamp('expired_at')->nullable()->after('processed_at');
        });

        Schema::table('request_facilities', function (Blueprint $table) {
            $table->timestamp('expired_at')->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            $table->dropColumn('expired_at');
        });

        Schema::table('request_facilities', function (Blueprint $table) {
            $table->dropColumn('expired_at');
        });
    }
};

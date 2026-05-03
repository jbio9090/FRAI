<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('request_facilities', function (Blueprint $table) {
            $table->string('ai_recommended_status')->nullable()->after('id');
            $table->text('ai_recommendation_reason')->nullable()->after('ai_recommended_status');
        });
    }

    public function down(): void
    {
        Schema::table('request_facilities', function (Blueprint $table) {
            $table->dropColumn(['ai_recommended_status', 'ai_recommendation_reason']);
        });
    }
};
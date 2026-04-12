<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chatbot_interaction_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('facility_request_id')->nullable()->constrained('requests')->nullOnDelete();
            $table->string('session_id')->nullable()->index();
            $table->string('interaction_type')->nullable()->index();
            $table->string('intent')->nullable()->index();
            $table->text('user_message')->nullable();
            $table->longText('assistant_message')->nullable();
            $table->json('context_data')->nullable();
            $table->json('generated_payload')->nullable();
            $table->json('validation_result')->nullable();
            $table->string('status', 50)->default('answered')->index();
            $table->timestamps();

            $table->index(['created_at', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chatbot_interaction_logs');
    }
};

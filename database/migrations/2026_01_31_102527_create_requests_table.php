<?php

use App\RequestStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('requests', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
            $table->string("status")->default(RequestStatus::PENDING);
            $table->string("title", 256)->nullable();
            $table->string("description", 512)->nullable();
            $table->foreignId("user_id")->references("id")->on("users");
            $table->string("recommended_action")->default(RequestStatus::APPROVED);
            $table->string("recommended_action_reason", 512)->nullable();
            $table->foreignId('processed_by')->nullable()->constrained('users');
            $table->timestamp('processed_at')->nullable();
            $table->json('pending_conflict_rf_ids')->nullable();
            $table->json('approved_conflict_rf_ids')->nullable();
            $table->json("approved_by")->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('requests');
    }
};

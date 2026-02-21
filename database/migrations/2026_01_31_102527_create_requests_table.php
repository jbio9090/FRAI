<?php

use App\RequestStatus;
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
        Schema::create('requests', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
            $table->string("status")->default(RequestStatus::PENDING);
            $table->string("title", 256)->nullable();
            $table->string("description", 512)->nullable();
            $table->foreignId("user_id")->references("id")->on("users");
            $table->string("comment", 512)->nullable();
            $table->string("recommended_action")->default(RequestStatus::DENIED);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('requests');
    }
};

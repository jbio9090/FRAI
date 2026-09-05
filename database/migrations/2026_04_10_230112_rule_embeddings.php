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
        $driver = Schema::getConnection()->getDriverName();

        Schema::create('rule_embeddings', function (Blueprint $table) use ($driver) {
            $table->id();
            $table->foreignId('rule_id')->constrained('rules');
            $table->text('content');
            if ($driver === 'pgsql') {
                $table->vector('embedding', 768);
            } else {
                // Test/runtime fallback for drivers without pgvector support.
                $table->json('embedding')->nullable();
            }
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rule_embeddings');
    }
};

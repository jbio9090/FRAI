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
        Schema::create('request_equipment', function (Blueprint $table) {
            $table->id();
            $table->foreignId("request_id")->constrained()->onDelete("cascade");
            $table->foreignId("equipment_id")->constrained()->onDelete("cascade");
            $table->integer("quantity_needed")->default(1); // How many they need
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('request_equipment');
    }
};

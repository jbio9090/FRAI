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
        Schema::create('facility_equipment', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->onDelete('cascade');
            $table->foreignId('equipment_id')->constrained('equipments')->onDelete('cascade');
            $table->integer('quantity'); // how many this facility holds
            $table->timestamps();
            
            $table->unique(['facility_id', 'equipment_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('facility_equipment');
    }
};

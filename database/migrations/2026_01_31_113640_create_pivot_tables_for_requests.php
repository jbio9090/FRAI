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
        Schema::create("request_facilities", function (Blueprint $table) {
            $table->id();
            $table->foreignId("request_id")->constrained("requests")->onDelete("cascade");
            $table->foreignId("facility_id")->constrained("facilities")->onDelete("cascade");
            $table->date("date_requested");
            $table->time("time_start");
            $table->time("time_end");
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('request_facilities');
    }
};

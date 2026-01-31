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
        Schema::create("requested_facilities", function (Blueprint $table) {
            $table->id();
            $table->timestamps();
            $table->foreignId("request_id")->references("id")->on("requests");
            $table->foreignId("facility_id")->references("id")->on("facilities");
            $table->integer("capacity")->nullable();
        });

        Schema::create("requested_dates", function (Blueprint $table) {
            $table->id();
            $table->timestamps();
            $table->foreignId("request_id")->references("id")->on("requests");
            $table->date("date_requested");
            $table->time("time_start");
            $table->time("time_end");
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};

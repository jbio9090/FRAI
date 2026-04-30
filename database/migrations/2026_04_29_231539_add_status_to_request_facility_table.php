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
        Schema::table('request_facilities', function (Blueprint $table) {
            $table->string('status')->default(RequestStatus::PENDING)->after('has_outsiders');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('request_facility', function (Blueprint $table) {
            $table->dropColumn("status");
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('request_equipment', function (Blueprint $table) {
            $table->foreignId('request_facility_id')
                ->nullable()
                ->after('request_id')
                ->constrained('request_facilities')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('request_equipment', function (Blueprint $table) {
            $table->dropForeign(['request_facility_id']);
            $table->dropColumn('request_facility_id');
        });
    }
};

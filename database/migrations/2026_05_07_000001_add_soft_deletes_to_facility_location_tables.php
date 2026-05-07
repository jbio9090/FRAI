<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('buildings', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('campuses', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('buildings', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('campuses', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};

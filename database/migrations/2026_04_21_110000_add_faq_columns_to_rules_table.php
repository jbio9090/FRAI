<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rules', function (Blueprint $table) {
            $table->unsignedTinyInteger('forPolicy')->default(0)->index()->after('rule');
            $table->text('faq_answer')->nullable()->after('forPolicy');
        });
    }

    public function down(): void
    {
        Schema::table('rules', function (Blueprint $table) {
            $table->dropColumn('faq_answer');
            $table->dropColumn('forPolicy');
        });
    }
};


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
        Schema::create('request_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('request_id')->constrained()->onDelete('cascade');
            $table->string('path');           // storage path e.g. request-files/abc123.pdf
            $table->string('original_name'); // what the user sees e.g. "budget-proposal.pdf"
            $table->string('mime_type');
            $table->unsignedBigInteger('size'); // bytes
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('request_files');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Resize the pgvector embedding column to match the chosen NVIDIA embed
     * model (nemotron-3-embed-1b = 2048 dimensions). Safe because the table is
     * populated only after embeddings are generated, so it is empty at this
     * point. No-op on non-pgsql drivers (sqlite test db uses a json column).
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE rule_embeddings ALTER COLUMN embedding TYPE vector(2048) USING embedding::vector(2048)');
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE rule_embeddings ALTER COLUMN embedding TYPE vector(768) USING embedding::vector(768)');
    }
};

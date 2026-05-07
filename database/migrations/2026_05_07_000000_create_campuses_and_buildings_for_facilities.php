<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campuses', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::create('buildings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();

            $table->unique(['campus_id', 'name']);
        });

        Schema::table('facilities', function (Blueprint $table) {
            $table->foreignId('campus_id')->nullable()->after('building')->constrained()->nullOnDelete();
            $table->foreignId('building_id')->nullable()->after('campus_id')->constrained()->nullOnDelete();
        });

        $now = now();
        foreach (['Main', 'Annes', 'SIPAG'] as $campusName) {
            DB::table('campuses')->updateOrInsert(
                ['name' => $campusName],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }

        $mainCampusId = DB::table('campuses')->where('name', 'Main')->value('id');

        DB::table('facilities')
            ->select('building')
            ->whereNotNull('building')
            ->where('building', '!=', '')
            ->distinct()
            ->orderBy('building')
            ->pluck('building')
            ->each(function (string $buildingName) use ($mainCampusId, $now) {
                DB::table('buildings')->updateOrInsert(
                    ['campus_id' => $mainCampusId, 'name' => $buildingName],
                    ['created_at' => $now, 'updated_at' => $now]
                );
            });

        DB::table('facilities')
            ->orderBy('id')
            ->get(['id', 'building'])
            ->each(function ($facility) use ($mainCampusId) {
                $buildingId = DB::table('buildings')
                    ->where('campus_id', $mainCampusId)
                    ->where('name', $facility->building)
                    ->value('id');

                DB::table('facilities')
                    ->where('id', $facility->id)
                    ->update([
                        'campus_id' => $mainCampusId,
                        'building_id' => $buildingId,
                    ]);
            });
    }

    public function down(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('building_id');
            $table->dropConstrainedForeignId('campus_id');
        });

        Schema::dropIfExists('buildings');
        Schema::dropIfExists('campuses');
    }
};

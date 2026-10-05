<?php

use App\Models\Rule;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Rule::where('forPolicy', 1)->chunk(50, function ($rules) {
            foreach ($rules as $rule) {
                $rule->update([
                    'faq_answer' => str_replace('**', '', $rule->faq_answer)
                ]);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Cannot reliably restore ** formatting without backup
    }
};
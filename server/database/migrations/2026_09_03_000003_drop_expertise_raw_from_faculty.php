<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('faculty', 'expertise_raw')) {
            // Backfill any existing faculty who have expertise_raw but null expertise
            \Illuminate\Support\Facades\DB::table('faculty')
                ->whereNotNull('expertise_raw')
                ->whereNull('expertise')
                ->cursor()
                ->each(function ($row) {
                    $items = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', (string)$row->expertise_raw))));
                    \Illuminate\Support\Facades\DB::table('faculty')
                        ->where('id', $row->id)
                        ->update(['expertise' => json_encode($items)]);
                });

            Schema::table('faculty', function (Blueprint $table) {
                $table->dropColumn('expertise_raw');
            });
        }
    }

    public function down(): void
    {
        Schema::table('faculty', function (Blueprint $table) {
            if (!Schema::hasColumn('faculty', 'expertise_raw')) {
                $table->text('expertise_raw')->nullable()->after('expertise');
            }
        });
    }
};

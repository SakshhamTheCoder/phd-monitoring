<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('faculty', function (Blueprint $table) {
            if (!Schema::hasColumn('faculty', 'expertise')) {
                $table->json('expertise')->nullable()->after('designation');
            }
            if (!Schema::hasColumn('faculty', 'expertise_raw')) {
                $table->text('expertise_raw')->nullable()->after('expertise');
            }
        });
    }

    public function down(): void
    {
        Schema::table('faculty', function (Blueprint $table) {
            if (Schema::hasColumn('faculty', 'expertise')) $table->dropColumn('expertise');
            if (Schema::hasColumn('faculty', 'expertise_raw')) $table->dropColumn('expertise_raw');
        });
    }
};

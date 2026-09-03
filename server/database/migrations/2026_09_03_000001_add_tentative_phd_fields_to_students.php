<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            if (!Schema::hasColumn('students', 'tentative_desc')) {
                $table->text('tentative_desc')->nullable()->after('phd_title');
            }
            if (!Schema::hasColumn('students', 'tentative_broad_area')) {
                $table->text('tentative_broad_area')->nullable()->after('tentative_desc');
            }
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            if (Schema::hasColumn('students', 'tentative_desc')) {
                $table->dropColumn('tentative_desc');
            }
            if (Schema::hasColumn('students', 'tentative_broad_area')) {
                $table->dropColumn('tentative_broad_area');
            }
        });
    }
};

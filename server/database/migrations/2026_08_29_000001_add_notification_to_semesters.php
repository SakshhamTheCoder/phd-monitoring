<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('semesters', 'notification')) {
            Schema::table('semesters', function (Blueprint $table) {
                $table->boolean('notification')->default(false)->after('ppt_file');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('semesters', 'notification')) {
            Schema::table('semesters', function (Blueprint $table) {
                $table->dropColumn('notification');
            });
        }
    }
};

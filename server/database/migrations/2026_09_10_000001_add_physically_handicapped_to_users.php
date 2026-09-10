<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Physically handicapped students get the same thesis deadline as female
 * students, so the flag sits beside gender: both feed the same rule and
 * neither is something a student may set for themselves.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'physically_handicapped')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('physically_handicapped')->default(false)->after('gender');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'physically_handicapped')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('physically_handicapped');
            });
        }
    }
};

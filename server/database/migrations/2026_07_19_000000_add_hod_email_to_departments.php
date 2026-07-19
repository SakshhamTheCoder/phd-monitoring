<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The official departmental HoD address (hcsed@thapar.edu and friends).
 *
 * This is correspondence only. Headship stays attached to the real person via
 * departments.hod_id, so they keep logging in as themselves and approvals stay
 * attributable to a human. This address belongs to the department, not the
 * person, so it survives a change of HoD untouched.
 *
 * Nullable and additive, so it is safe to run against a live database.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->string('hod_email')->nullable()->after('hod_id');
        });
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->dropColumn('hod_email');
        });
    }
};

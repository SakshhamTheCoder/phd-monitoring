<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Mentoring is a fact about a person, not a role: the capability says a role
 * may read the projects it mentors, and the record decides which those are.
 * Granted to every role a faculty account can act as.
 */
return new class extends Migration
{
    private const ROLES = [
        'faculty', 'hod', 'phd_coordinator', 'adordc', 'dordc', 'dra', 'director',
    ];

    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->enum('can_read_urf_mentees', ['true', 'false'])->default('false');
        });

        DB::table('roles')->whereIn('role', self::ROLES)->update(['can_read_urf_mentees' => 'true']);
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn('can_read_urf_mentees');
        });
    }
};

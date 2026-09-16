<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A URF project names two faculty mentors, and until now only the admin could
 * read one. Mentoring is a fact about a person, not a role, so the capability
 * says what a role may read, "the projects I mentor", and the record decides
 * which projects that means. A faculty member who mentors nothing sees nothing.
 *
 * Granted to every role a faculty account can be acting as, since any of them
 * can be named on an application.
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

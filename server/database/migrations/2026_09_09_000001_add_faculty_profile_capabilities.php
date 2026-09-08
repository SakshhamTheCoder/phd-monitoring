<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Capabilities for the unified faculty profile.
 *
 * The profile is one page for every viewer; what it contains is decided by
 * these three columns rather than by the page knowing who is looking.
 *
 * `can_read_faculty_phone` exists as its own column rather than being folded
 * into the supervision tier so the decision "students do not see phone
 * numbers" can be reversed by setting one value to 'true', with no deploy.
 */
return new class extends Migration
{
    private const MATRIX = [
        // Browse the directory and open any faculty profile. Everyone except
        // clerk, whose account exists for attendance.
        'can_read_faculty_directory' => [
            'admin', 'adordc', 'director', 'doctoral', 'dordc', 'dra',
            'external', 'faculty', 'hod', 'phd_coordinator', 'student',
        ],

        // Named supervised students, doctoral committee memberships and student
        // publications on someone else's profile. A faculty member always sees
        // their own, which is a record check, not this capability.
        'can_read_faculty_supervision' => [
            'hod', 'phd_coordinator', 'dordc', 'adordc', 'dra', 'director', 'admin',
        ],

        // Everyone with directory access except students. Flip the student row
        // to 'true' to show it to them again.
        'can_read_faculty_phone' => [
            'admin', 'adordc', 'director', 'doctoral', 'dordc', 'dra',
            'external', 'faculty', 'hod', 'phd_coordinator',
        ],
    ];

    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            foreach (array_keys(self::MATRIX) as $column) {
                $table->enum($column, ['true', 'false'])->default('false');
            }
        });

        foreach (self::MATRIX as $capability => $roles) {
            DB::table('roles')->whereIn('role', $roles)->update([$capability => 'true']);
        }
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(array_keys(self::MATRIX));
        });
    }
};

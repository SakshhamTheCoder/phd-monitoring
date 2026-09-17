<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A URF project records two students and two mentors, so a filter on "Student
 * Name" that reads only the first one finds nothing for the second: a search
 * for a teammate's roll number came back empty though she is on the project.
 *
 * These filters now name both columns, which the filter engine reads as either
 * matching.
 */
return new class extends Migration
{
    private const PAIRS = [
        'student1_name' => 'student1_name|student2_name',
        'student1_roll_no' => 'student1_roll_no|student2_roll_no',
        'mentor1.user.first_name' => 'mentor1.user.first_name|mentor2.user.first_name',
    ];

    public function up(): void
    {
        foreach (self::PAIRS as $one => $both) {
            DB::table('filters')->where('key_name', $one)->whereJsonContains('applicable_pages', 'urf')->update(['key_name' => $both]);
        }
    }

    public function down(): void
    {
        foreach (self::PAIRS as $one => $both) {
            DB::table('filters')->where('key_name', $both)->whereJsonContains('applicable_pages', 'urf')->update(['key_name' => $one]);
        }
    }
};

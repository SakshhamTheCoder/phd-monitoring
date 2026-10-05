<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What a scholar was admitted on, which two of the institute's coursework rules
 * are decided by and which the portal has never held.
 *
 * A candidate admitted with a B.E. or B.Tech owes eight masters level courses,
 * and an executive candidate's credits depend on whether they hold a
 * postgraduate degree and, if not, on their undergraduate percentage. Both read
 * these columns; see App\Support\CourseworkRequirement.
 *
 * The level is a choice rather than the degree's name, because the rules turn
 * on the level alone and a typed "B.Tech." or "BTech" would have to be guessed
 * at. The institute and the percentage are recorded beside it because the
 * office asks for them on the same form.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->enum('highest_qualification', ['bachelors', 'masters'])->nullable()->after('cgpa');
            $table->string('qualification_institute')->nullable()->after('highest_qualification');
            // Percentages are written to two places ("74.50"), and a CGPA out
            // of 10 converted to one still fits.
            $table->decimal('qualification_percentage', 5, 2)->nullable()->after('qualification_institute');
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn(['highest_qualification', 'qualification_institute', 'qualification_percentage']);
        });
    }
};

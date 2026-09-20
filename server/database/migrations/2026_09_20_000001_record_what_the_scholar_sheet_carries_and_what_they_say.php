<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Four columns on a scholar, in two halves.
 *
 * The office half comes off the students sheet and had nowhere to land, so the
 * import read past it: whether they qualified NET or GATE, and the date the
 * degree was actually awarded, which is a later and different event from the
 * thesis being submitted.
 *
 * The scholar half is theirs to write and theirs to change. Two questions, not
 * three: "what do you need help with" is the same question as "what are your
 * weaknesses" asked in the way somebody will actually answer it on a record
 * their supervisor and department read.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            // Nullable in the is_jrf sense: null is nobody has said, which is
            // not the same as no. The sheet asks one Yes/No, so this is one
            // boolean; telling NET from GATE would need the sheet to ask twice.
            $table->boolean('is_net_gate_qualified')->nullable()->after('is_jrf');
            $table->date('date_of_thesis_awarded')->nullable()->after('date_of_thesis');

            $table->text('strengths')->nullable();
            $table->text('help_needed')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn([
                'is_net_gate_qualified',
                'date_of_thesis_awarded',
                'strengths',
                'help_needed',
            ]);
        });
    }
};

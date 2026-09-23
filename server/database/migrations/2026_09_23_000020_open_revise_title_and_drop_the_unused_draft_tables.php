<?php

use App\Models\Student;
use App\Models\Traits\MigrationCommonFormFields;
use App\Support\FormLadder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Revise title opens once the revised IRB is approved (FormLadder), so the
 * scholars already past that point are given it here, the same way: anyone
 * the IRB submission has already opened the synopsis for.
 *
 * The two tables an earlier revise-title attempt created (2025_11_10) were
 * never written by any code. They are dropped only when empty; a table that
 * somehow holds rows is left alone and logged, so no data is lost.
 */
return new class extends Migration
{
    use MigrationCommonFormFields;

    private const DRAFT_TABLES = ['table_revise_title_form', 'student_objectives'];

    public function up(): void
    {
        $scholars = DB::table('forms')->where('form_type', 'synopsis-submission')->pluck('student_id');
        Student::whereIn('roll_no', $scholars)->each(fn ($student) => FormLadder::openOne($student, 'revise-title'));

        foreach (self::DRAFT_TABLES as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            if (DB::table($table)->exists()) {
                Log::warning("Kept {$table}: it holds rows, so it was not dropped.");
                continue;
            }
            Schema::drop($table);
        }
    }

    public function down(): void
    {
        // The opened forms are left in place: a scholar may have started one.
        // The empty tables come back as the 2025_11_10 migration made them.
        if (!Schema::hasTable('table_revise_title_form')) {
            Schema::create('table_revise_title_form', function (Blueprint $table) {
                $this->addCommonFields($table);
                $table->text('current_title')->nullable();
                $table->text('proposed_title')->nullable();
                $table->text('justification')->nullable();
                $table->json('current_objectives')->nullable();
                $table->json('proposed_objectives')->nullable();
                $table->timestamps();
            });
        }
        if (!Schema::hasTable('student_objectives')) {
            Schema::create('student_objectives', function (Blueprint $table) {
                $table->increments('id');
                $table->integer('student_id')->unsigned()->index();
                $table->foreign('student_id')->references('roll_no')->on('students')->onDelete('cascade');
                $table->string('objective');
                $table->timestamps();
            });
        }
    }
};

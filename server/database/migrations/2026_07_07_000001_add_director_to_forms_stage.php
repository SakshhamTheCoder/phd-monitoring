<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Add 'director' to the forms.stage enum. Three forms (semester-off,
     * list-of-examiners, synopsis-submission) progress to a director step, and the
     * forms table's stage enum was missing it, causing a truncation error on that
     * transition. Additive change: every existing stage value stays valid.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE `forms` MODIFY `stage` ENUM('student','hod','phd_coordinator','supervisor','doctoral','external','adordc','dordc','dra','director','complete') NULL DEFAULT 'student'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE `forms` MODIFY `stage` ENUM('student','hod','phd_coordinator','supervisor','doctoral','external','adordc','dordc','dra','complete') NULL DEFAULT 'student'");
    }
};

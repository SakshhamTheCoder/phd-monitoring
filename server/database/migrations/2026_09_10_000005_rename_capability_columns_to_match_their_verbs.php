<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Three capability columns were named for a verb they do not describe:
 *
 *  - `can_add_faculties` also gates FacultyController::update and the
 *    bulk/upload import, not just add.
 *  - `can_add_students` also gates StudentController::bulkUpload,
 *    bulkUpdate and adminUpdate, not just add.
 *  - `can_read_supervisor_change_requests` gates
 *    SupervisorDoctoralChangeController::proposeChange, which creates a
 *    pending change. A "read" name on a write is misleading.
 *
 * Renaming rather than adding new columns keeps every role's existing grant
 * intact; only the column name changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->renameColumn('can_add_faculties', 'can_manage_faculties');
            $table->renameColumn('can_add_students', 'can_manage_students');
            $table->renameColumn('can_read_supervisor_change_requests', 'can_propose_supervisor_changes');
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->renameColumn('can_manage_faculties', 'can_add_faculties');
            $table->renameColumn('can_manage_students', 'can_add_students');
            $table->renameColumn('can_propose_supervisor_changes', 'can_read_supervisor_change_requests');
        });
    }
};

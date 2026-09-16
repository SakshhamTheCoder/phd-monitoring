<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which department a branch is taught by.
 *
 * A URF form is approved by the student's mentor, then their ADORDC, then the
 * DORDC. An ADORDC holds departments, so the form has to name one, and a branch
 * is what a UG student gives. Nullable, because the list can be filled in
 * before the departments are matched up, and a branch with none sits with every
 * ADORDC rather than with none of them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ug_branches', function (Blueprint $table) {
            $table->integer('department_id')->unsigned()->nullable()->after('name');
            $table->foreign('department_id')->references('id')->on('departments')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('ug_branches', function (Blueprint $table) {
            $table->dropForeign(['department_id']);
            $table->dropColumn('department_id');
        });
    }
};

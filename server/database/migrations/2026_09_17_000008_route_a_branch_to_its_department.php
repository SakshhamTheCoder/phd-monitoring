<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An ADORDC holds departments, so a form has to name one, and a branch is what
 * a UG student gives. A branch with none sits with every ADORDC.
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

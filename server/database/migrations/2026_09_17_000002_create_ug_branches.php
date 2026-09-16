<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A branch is not a department: several branches are taught by one, and each
 * programme has its own list. Existing applications lose their department,
 * since it cannot be turned into a branch.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ug_branches', function (Blueprint $table) {
            $table->increments('id');
            $table->string('programme', 20)->index();
            $table->string('code', 20);
            $table->string('name');
            $table->timestamps();
            $table->unique(['programme', 'code']);
        });

        Schema::table('ug_students', function (Blueprint $table) {
            $table->dropForeign(['department_id']);
            $table->dropColumn('department_id');
            $table->integer('branch_id')->unsigned()->nullable()->after('roll_no');
            $table->foreign('branch_id')->references('id')->on('ug_branches');
        });

        foreach (['student1', 'student2'] as $student) {
            Schema::table('urf_applications', function (Blueprint $table) use ($student) {
                $table->dropForeign(["{$student}_department_id"]);
                $table->dropColumn("{$student}_department_id");
                $table->integer("{$student}_branch_id")->unsigned()->nullable()->after("{$student}_roll_no");
                $table->foreign("{$student}_branch_id")->references('id')->on('ug_branches');
            });
        }

        DB::table('filters')
            ->where('key_name', 'student1Department.name')
            ->whereJsonContains('applicable_pages', 'urf')
            ->update([
                'key_name' => 'student1Branch.name|student2Branch.name',
                'label' => 'Branch',
                'api_url' => null,
            ]);
    }

    public function down(): void
    {
        DB::table('filters')
            ->where('key_name', 'student1Branch.name|student2Branch.name')
            ->whereJsonContains('applicable_pages', 'urf')
            ->update([
                'key_name' => 'student1Department.name',
                'label' => 'Department',
                'api_url' => '/suggestions/department',
            ]);

        foreach (['student1', 'student2'] as $student) {
            Schema::table('urf_applications', function (Blueprint $table) use ($student) {
                $table->dropForeign(["{$student}_branch_id"]);
                $table->dropColumn("{$student}_branch_id");
                $table->integer("{$student}_department_id")->unsigned()->nullable()->after("{$student}_roll_no");
                $table->foreign("{$student}_department_id")->references('id')->on('departments')->onDelete('set null');
            });
        }

        Schema::table('ug_students', function (Blueprint $table) {
            $table->dropForeign(['branch_id']);
            $table->dropColumn('branch_id');
            $table->integer('department_id')->unsigned()->nullable()->after('roll_no');
            $table->foreign('department_id')->references('id')->on('departments');
        });

        Schema::dropIfExists('ug_branches');
    }
};

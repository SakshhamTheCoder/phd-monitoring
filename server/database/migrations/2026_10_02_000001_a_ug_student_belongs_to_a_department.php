<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A UG student is filed under a department, as every other person here is.
 *
 * Branches were a layer in between: a student picked one, and the only thing
 * read from it was `ug_branches.department_id`, because the department is what
 * decides which ADORDC sees a URF project. The institute's own sheets name the
 * department and never the branch, so the layer had to be filled in by hand
 * before anybody could be imported, and the one row production held (COE) was
 * not enough to import a single fellowship against.
 *
 * The branch and programme distinction goes with it. Nothing read it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ug_students', function (Blueprint $table) {
            $table->integer('department_id')->unsigned()->nullable()->after('roll_no');
            $table->foreign('department_id')->references('id')->on('departments')->onDelete('set null');
        });

        DB::statement('UPDATE ug_students s JOIN ug_branches b ON b.id = s.branch_id
                       SET s.department_id = b.department_id');

        Schema::table('ug_students', function (Blueprint $table) {
            $table->dropForeign(['branch_id']);
            $table->dropColumn('branch_id');
        });

        foreach (['student1', 'student2'] as $student) {
            Schema::table('urf_applications', function (Blueprint $table) use ($student) {
                $table->integer("{$student}_department_id")->unsigned()->nullable()->after("{$student}_roll_no");
                $table->foreign("{$student}_department_id")->references('id')->on('departments')->onDelete('set null');
            });

            DB::statement("UPDATE urf_applications a JOIN ug_branches b ON b.id = a.{$student}_branch_id
                           SET a.{$student}_department_id = b.department_id");

            Schema::table('urf_applications', function (Blueprint $table) use ($student) {
                $table->dropForeign(["{$student}_branch_id"]);
                $table->dropColumn("{$student}_branch_id");
            });
        }

        Schema::dropIfExists('ug_branches');

        // The students page offered a filter on the branch's name and programme.
        DB::table('filters')->whereIn('key_name', ['branch.name', 'branch.programme'])
            ->whereJsonContains('applicable_pages', 'ug_students')->delete();
        DB::table('filters')->insert([
            'key_name' => 'department.name',
            'label' => 'Department',
            'data_type' => 'string',
            'function_name' => 'text',
            'api_url' => '/suggestions/department',
            'applicable_pages' => json_encode(['ug_students']),
        ]);
    }

    public function down(): void
    {
        Schema::create('ug_branches', function (Blueprint $table) {
            $table->increments('id');
            $table->string('programme', 20)->index();
            $table->string('code', 20);
            $table->string('name');
            $table->integer('department_id')->unsigned()->nullable();
            $table->foreign('department_id')->references('id')->on('departments')->onDelete('set null');
            $table->timestamps();
            $table->unique(['programme', 'code']);
        });

        Schema::table('ug_students', function (Blueprint $table) {
            $table->integer('branch_id')->unsigned()->nullable()->after('roll_no');
            $table->foreign('branch_id')->references('id')->on('ug_branches');
            $table->dropForeign(['department_id']);
            $table->dropColumn('department_id');
        });

        foreach (['student1', 'student2'] as $student) {
            Schema::table('urf_applications', function (Blueprint $table) use ($student) {
                $table->integer("{$student}_branch_id")->unsigned()->nullable()->after("{$student}_roll_no");
                $table->foreign("{$student}_branch_id")->references('id')->on('ug_branches')->onDelete('set null');
                $table->dropForeign(["{$student}_department_id"]);
                $table->dropColumn("{$student}_department_id");
            });
        }

        DB::table('filters')->where('key_name', 'department.name')
            ->whereJsonContains('applicable_pages', 'ug_students')->delete();
        foreach ([['branch.name', 'Branch'], ['branch.programme', 'Programme']] as [$key, $label]) {
            DB::table('filters')->insert([
                'key_name' => $key,
                'label' => $label,
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => json_encode(['ug_students']),
            ]);
        }
    }
};

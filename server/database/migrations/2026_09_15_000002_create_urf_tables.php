<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The Undergraduate Research Fellowship, stage by stage:
 *
 *  - urf_applications: the application form, one row per project. Up to two
 *    students and two faculty mentors apply together; the columns follow the
 *    application sheet. The student who fills it in owns it (user_id), the
 *    second student reaches it through their email.
 *  - urf_fellows: what each selected student gives after the result, for the
 *    stipend. Identity and bank numbers are encrypted by the model.
 *  - urf_reports: the half-yearly progress reports and the final report.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('urf_applications', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('user_id')->unsigned()->index();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('project_title');

            foreach (['student1', 'student2'] as $s) {
                $table->string("{$s}_name")->nullable();
                $table->string("{$s}_roll_no")->nullable();
                $table->integer("{$s}_department_id")->unsigned()->nullable();
                $table->foreign("{$s}_department_id")->references('id')->on('departments')->onDelete('set null');
                $table->enum("{$s}_gender", ['Male', 'Female'])->nullable();
                $table->string("{$s}_email")->nullable()->index();
                $table->string("{$s}_phone")->nullable();
            }

            foreach (['mentor1', 'mentor2'] as $m) {
                $table->integer("{$m}_faculty_code")->unsigned()->nullable();
                $table->foreign("{$m}_faculty_code")->references('faculty_code')->on('faculty')->onDelete('set null');
            }

            $table->string('proposal');
            $table->enum('status', ['applied', 'selected', 'rejected', 'ongoing', 'completed'])->default('applied');
            $table->timestamps();
        });

        Schema::create('urf_fellows', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('urf_application_id')->unsigned();
            $table->foreign('urf_application_id')->references('id')->on('urf_applications')->onDelete('cascade');
            $table->integer('user_id')->unsigned();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['urf_application_id', 'user_id']);
            $table->string('full_name');
            $table->date('dob');
            $table->enum('gender', ['Male', 'Female']);
            $table->string('father_name');
            // Encrypted, so text rather than the length of the plain number.
            $table->text('pan');
            $table->text('aadhaar');
            $table->string('bank_name');
            $table->text('account_no');
            $table->string('ifsc');
            $table->timestamps();
        });

        Schema::create('urf_reports', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('urf_application_id')->unsigned();
            $table->foreign('urf_application_id')->references('id')->on('urf_applications')->onDelete('cascade');
            $table->integer('user_id')->unsigned();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->enum('type', ['half_yearly', 'final']);
            $table->text('conference_presentation')->nullable();
            $table->string('report');
            $table->timestamps();
        });

        $filters = [
            ['project_title', 'Project Title', null],
            ['student1_name', 'Student Name', null],
            ['student1_roll_no', 'Roll No', null],
            ['student1Department.name', 'Department', '/suggestions/department'],
            ['mentor1.user.first_name', 'Mentor Name', '/suggestions/faculty'],
        ];
        foreach ($filters as [$key, $label, $api]) {
            DB::table('filters')->insert([
                'key_name' => $key,
                'label' => $label,
                'data_type' => 'string',
                'function_name' => 'text',
                'api_url' => $api,
                'applicable_pages' => json_encode(['urf']),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('filters')->whereJsonContains('applicable_pages', 'urf')->delete();
        Schema::dropIfExists('urf_reports');
        Schema::dropIfExists('urf_fellows');
        Schema::dropIfExists('urf_applications');
    }
};

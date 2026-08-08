<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('forms', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
            $table->integer('student_id')->unsigned()->index();
            $table->foreign('student_id')->references('roll_no')->on('students')->onDelete('cascade');
            $table->string('form_type');
            $table->string('form_name');
            $table->integer('max_level')->default(0);
            $table->integer('current_level')->default(0);
            $table->json('steps')->nullable();
            $table->integer('department_id')->unsigned()->index();
            $table->foreign('department_id')->references('id')->on('departments')->onDelete('cascade');
            $table->boolean('student_available')->default(false);
            $table->boolean('supervisor_available')->default(false);
            $table->boolean('hod_available')->default(false);
            $table->boolean('phd_coordinator_available')->default(false);
            $table->boolean('dordc_available')->default(false);
            $table->boolean('adordc_available')->default(false);
            $table->boolean('dra_available')->default(false);
            $table->boolean('director_available')->default(false);
            $table->boolean('doctoral_available')->default(false);
            $table->enum('stage', ['student', 'hod','phd_coordinator', 'supervisor','doctoral','external','adordc', 'dordc', 'dra','director','complete'])->nullable()->default('student'); // Common field
            $table->integer('count')->default(0);
            $table->integer('max_count')->default(1);

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('forms');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Remove `examiners_details`, `list_of_examiners`, and
 * `list_of_examiners_recommendations`.
 *
 * These tables were created in 2024 and 2025 as part of an earlier examiner
 * recommendation workflow, but were never written to by any code. The workflow
 * has since been replaced by `examiners_recommendation` (singular, no prefix)
 * which stores recommendations directly on the forms themselves.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('list_of_examiners_recommendations');
        Schema::dropIfExists('list_of_examiners');
        Schema::dropIfExists('examiners_details');
    }

    public function down(): void
    {
        Schema::create('examiners_details', function (Blueprint $table) {
            $table->increments('id')->index();
            $table->timestamps();
            $table->text('name');
            $table->text('designation');
            $table->text('department');
            $table->text('email');
            $table->text('phone');
            $table->text('university');
            $table->text('country');
            $table->text('city');
        });

        Schema::create('list_of_examiners', function (Blueprint $table) {
            $table->id();
            $table->integer('examiner_id')->unsigned()->index();
            $table->foreign('examiner_id')->references('id')->on('examiners_details')->onDelete('cascade');
            $table->integer('student_id')->unsigned()->index();
            $table->foreign('student_id')->references('roll_no')->on('students')->onDelete('cascade');
            $table->integer('faculty_id')->unsigned()->index();
            $table->foreign('faculty_id')->references('faculty_code')->on('faculty')->onDelete('cascade');
        });

        Schema::create('list_of_examiners_recommendations', function (Blueprint $table) {
            $table->increments('id');
            $table->primary('id');
            $table->timestamps();
            $table->integer('form_id')->unsigned()->index();
            $table->foreign('form_id')->references('id')->on('list_of_examiners_forms')->onDelete('cascade');
            $table->integer('examiner_id')->unsigned()->index();
            $table->foreign('examiner_id')->references('id')->on('examiners_details')->onDelete('cascade');
            $table->enum('recommendation', ['approved', 'rejected', 'awaited'])->default('awaited');
        });
    }
};

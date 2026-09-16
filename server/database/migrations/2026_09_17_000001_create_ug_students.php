<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What a UG student is, apart from their login.
 *
 * Until now a UG account was a users row and nothing else: roll number, branch
 * and year were typed onto every application and read back from the latest one,
 * so a student who had not applied had none. Signing up asks for them once, and
 * this is where they live.
 *
 * A row is not required. An admin can still create a UG login without one, and
 * the application form falls back to asking for the three fields.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ug_students', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('user_id')->unsigned()->unique();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('roll_no', 50)->unique();
            $table->integer('department_id')->unsigned();
            $table->foreign('department_id')->references('id')->on('departments');
            // Year of study, 1 to 4. It moves with the student, so the
            // application prefills it and lets them correct it.
            $table->unsignedTinyInteger('year');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ug_students');
    }
};

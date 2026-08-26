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
        Schema::create('clerk_departments', function (Blueprint $table) {
            $table->increments('id');
            $table->primary('id');
            $table->integer('user_id')->unsigned()->index();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->integer('department_id')->unsigned()->index();
            $table->foreign('department_id')->references('id')->on('departments')->onDelete('cascade');
            // A clerk is tagged to a department at most once; the pair is the identity.
            $table->unique(['user_id', 'department_id']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('clerk_departments');
    }
};

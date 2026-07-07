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
        Schema::create('publications', function (Blueprint $table) {
            $table->increments('id');
            $table->primary('id');
            $table->integer('student_id')->unsigned()->index();
            $table->foreign('student_id')->references('roll_no')->on('students')->onDelete('cascade');
            $table->integer('form_id')->unsigned()->nullable();
            $table->enum('form_type', ['progress', 'thesis','synopsis'])->nullable();

            $table->text('title')->nullable();
            $table->text('authors')->nullable();
            $table->text('doi_link')->nullable();
            $table->string('first_page')->nullable();
            $table->year('year')->nullable();
            $table->text('name')->nullable();
            $table->enum('status', ['published', 'accepted'])->nullable();

            $table->string('country')->nullable();
            $table->string('state')->nullable();
            $table->string('city')->nullable();
            $table->text('publisher')->nullable();
            $table->integer('volume')->nullable();
            // page_no holds ranges like "1-18", not just integers, so it must be a string
            // (an integer column truncated those values — see the real schema).
            $table->string('page_no')->nullable();
            $table->integer('issn')->nullable();
        

            $table->enum('publication_type', ['journal', 'conference', 'book'])->default('journal');
            $table->enum('type', ['national', 'international','sci', 'non-sci',''])->default('')->nullable();
            
            $table->float('impact_factor')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('publications');
    }
};
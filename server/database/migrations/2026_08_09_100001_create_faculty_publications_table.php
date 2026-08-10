<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Mirrors the columns of `publications` so the research profile can show
        // faculty and student records side by side. Patents live here too, under
        // publication_type 'patent', rather than in a second table.
        Schema::create('faculty_publications', function (Blueprint $table) {
            $table->id();
            $table->integer('faculty_code')->unsigned()->index();

            $table->text('title')->nullable();
            $table->text('authors')->nullable();
            $table->text('doi_link')->nullable();
            $table->year('year')->nullable();
            $table->text('name')->nullable();
            $table->text('publisher')->nullable();
            $table->string('volume')->nullable();
            $table->string('page_no')->nullable();
            $table->integer('issn')->nullable();
            $table->string('country')->nullable();
            $table->string('state')->nullable();
            $table->string('city')->nullable();
            $table->float('impact_factor')->nullable();

            $table->enum('publication_type', ['journal', 'conference', 'book', 'patent'])->default('journal');
            $table->enum('type', ['national', 'international', 'sci', 'non-sci', ''])->default('')->nullable();

            $table->enum('source', ['manual', 'scopus', 'orcid'])->default('manual');
            $table->string('external_id')->nullable();
            $table->boolean('verified')->default(false);

            $table->timestamps();
            $table->foreign('faculty_code')->references('faculty_code')->on('faculty')->onDelete('cascade');
            // Lets a repeated sync update a record instead of duplicating it.
            $table->unique(['faculty_code', 'external_id']);
        });
    }

    public function down(): void { Schema::dropIfExists('faculty_publications'); }
};

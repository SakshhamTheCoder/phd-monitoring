<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Access index for internal Co-PIs. The projects.co_pis JSON stays the
        // display record (it also holds external partners, who have no account);
        // this table is what lets an internal Co-PI find the project at all.
        Schema::create('project_co_pis', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id')->index();
            $table->integer('faculty_code')->unsigned()->index();
            $table->timestamps();
            $table->foreign('project_id')->references('id')->on('projects')->onDelete('cascade');
            $table->foreign('faculty_code')->references('faculty_code')->on('faculty')->onDelete('cascade');
            $table->unique(['project_id', 'faculty_code']);
        });
    }

    public function down(): void { Schema::dropIfExists('project_co_pis'); }
};

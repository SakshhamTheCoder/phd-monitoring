<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('project_positions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id')->index();
            $table->enum('type', ['JRF','SRF','Research Associate','Research Intern','UG Intern','PG Intern']);
            $table->text('title');
            $table->integer('openings')->default(1);
            $table->text('stipend')->nullable();
            $table->date('deadline')->nullable();
            $table->text('eligibility')->nullable();
            $table->text('skills')->nullable();
            $table->text('min_cgpa')->nullable();
            $table->text('description')->nullable();
            $table->text('advertisement_path')->nullable();
            $table->timestamps();
            $table->foreign('project_id')->references('id')->on('projects')->onDelete('cascade');
        });
    }
    public function down(): void { Schema::dropIfExists('project_positions'); }
};

<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('position_applications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('position_id')->index();
            $table->unsignedBigInteger('project_id')->index();
            $table->integer('student_id')->unsigned()->nullable()->index();
            $table->text('name');
            $table->text('email');
            $table->text('phone')->nullable();
            $table->text('degree')->nullable();
            $table->text('institute')->nullable();
            $table->text('cgpa')->nullable();
            $table->text('research')->nullable();
            $table->json('skills')->nullable();
            $table->text('cover_note')->nullable();
            $table->text('resume_path')->nullable();
            $table->enum('status', ['Applied','Shortlisted','Interview Scheduled','Selected','Rejected'])->default('Applied');
            $table->date('applied_date')->nullable();
            $table->timestamps();
            $table->foreign('position_id')->references('id')->on('project_positions')->onDelete('cascade');
            $table->foreign('project_id')->references('id')->on('projects')->onDelete('cascade');
            $table->foreign('student_id')->references('roll_no')->on('students')->onDelete('set null');
            $table->unique(['position_id','student_id']);
        });
    }
    public function down(): void { Schema::dropIfExists('position_applications'); }
};

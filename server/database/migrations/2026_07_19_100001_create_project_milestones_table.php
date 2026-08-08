<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('project_milestones', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id')->index();
            $table->text('name');
            $table->text('deliverable')->nullable();
            $table->date('due_date')->nullable();
            $table->enum('status', ['Not Started','In Progress','Completed','Delayed'])->default('Not Started');
            $table->timestamps();
            $table->foreign('project_id')->references('id')->on('projects')->onDelete('cascade');
        });
    }
    public function down(): void { Schema::dropIfExists('project_milestones'); }
};

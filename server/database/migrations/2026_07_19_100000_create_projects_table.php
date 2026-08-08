<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->integer('pi_faculty_code')->unsigned()->index();
            $table->text('title');
            $table->enum('category', ['In-house','Research','Consultancy','Industry','International','Other'])->default('Research');
            $table->text('funding_agency')->nullable();
            $table->bigInteger('amount')->default(0);
            $table->bigInteger('tiet_share')->nullable();
            $table->text('role')->nullable();
            $table->enum('status', ['Active','Completed','Pending','On Hold'])->default('Pending');
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->integer('duration_years')->default(0);
            $table->integer('duration_months')->default(0);
            $table->text('description')->nullable();
            $table->text('focus_area')->nullable();
            $table->text('grant_type')->nullable();
            $table->json('co_pis')->nullable();
            $table->json('objectives')->nullable();
            $table->json('budget')->nullable();
            $table->json('equipment_details')->nullable();
            $table->text('sanction_letter_link')->nullable();
            $table->text('sanction_letter_name')->nullable();
            $table->timestamps();
            $table->foreign('pi_faculty_code')->references('faculty_code')->on('faculty')->onDelete('cascade');
        });
    }
    public function down(): void { Schema::dropIfExists('projects'); }
};

<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('position_applications', function (Blueprint $table) {
            $table->string('token', 64)->nullable()->unique()->after('id');
            $table->enum('applicant_type', ['internal', 'external'])->default('internal')->after('student_id');
            $table->timestamp('email_verified_at')->nullable()->after('applied_date');
        });

        // student_id is null for an external applicant, and MySQL treats nulls as
        // distinct, so the old index stopped blocking anything for them. Email
        // has to leave TEXT before it can carry an index.
        Schema::table('position_applications', function (Blueprint $table) {
            $table->string('email', 191)->nullable(false)->change();
        });
        Schema::table('position_applications', function (Blueprint $table) {
            $table->dropUnique(['position_id', 'student_id']);
            $table->unique(['position_id', 'email'], 'position_applications_position_email_unique');
        });
    }

    public function down(): void {
        Schema::table('position_applications', function (Blueprint $table) {
            $table->dropUnique('position_applications_position_email_unique');
            $table->text('email')->change();
            $table->unique(['position_id', 'student_id']);
            $table->dropUnique(['token']);
            $table->dropColumn(['token', 'applicant_type', 'email_verified_at']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Keep daily unique but prepare for lecture_id.
        // Existing attendance has unique (roll_no, date). Add lecture_id for future
        // lecture-based attendance; keep daily as lecture_id=0 so unique
        // (roll_no, date, lecture_id) covers both.
        if (Schema::hasTable('attendance')) {
            // Drop old unique if exists, add lecture_id
            try {
                Schema::table('attendance', function (Blueprint $table) {
                    // MySQL names it attendance_roll_no_date_unique
                    try { $table->dropUnique(['roll_no', 'date']); } catch (\Throwable $e) {}
                });
            } catch (\Throwable $e) {}

            Schema::table('attendance', function (Blueprint $table) {
                if (!Schema::hasColumn('attendance', 'lecture_id')) {
                    $table->integer('lecture_id')->unsigned()->default(0)->after('date');
                }
            });

            Schema::table('attendance', function (Blueprint $table) {
                $table->unique(['roll_no', 'date', 'lecture_id'], 'attendance_roll_date_lecture_unique');
            });
        }

        Schema::create('attendance_history', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('attendance_id')->index();
            $table->foreign('attendance_id')->references('id')->on('attendance')->onDelete('cascade');
            $table->integer('roll_no')->unsigned()->index();
            $table->date('date')->index();
            $table->integer('lecture_id')->unsigned()->default(0);
            $table->enum('old_status', ['present', 'absent'])->nullable();
            $table->enum('new_status', ['present', 'absent']);
            $table->integer('changed_by')->unsigned()->nullable()->index();
            $table->foreign('changed_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_history');
        if (Schema::hasTable('attendance') && Schema::hasColumn('attendance', 'lecture_id')) {
            Schema::table('attendance', function (Blueprint $table) {
                try { $table->dropUnique('attendance_roll_date_lecture_unique'); } catch (\Throwable $e) {}
                $table->dropColumn('lecture_id');
                $table->unique(['roll_no', 'date']);
            });
        }
    }
};

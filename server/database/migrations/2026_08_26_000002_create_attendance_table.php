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
        Schema::create('attendance', function (Blueprint $table) {
            $table->increments('id');
            $table->primary('id');
            // Students are keyed by roll_no (an integer), not an auto-increment id.
            $table->integer('roll_no')->unsigned()->index();
            $table->foreign('roll_no')->references('roll_no')->on('students')->onDelete('cascade');
            $table->date('date')->index();
            // Absent is stored explicitly; no row for a day means "not taken",
            // which is different from everyone defaulting to present.
            $table->enum('status', ['present', 'absent'])->default('present');
            $table->integer('marked_by')->unsigned()->nullable()->index();
            $table->foreign('marked_by')->references('id')->on('users')->onDelete('set null');
            // One record per student per day: re-saving the same day updates
            // instead of duplicating.
            $table->unique(['roll_no', 'date']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance');
    }
};

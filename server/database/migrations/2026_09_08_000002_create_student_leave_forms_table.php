<?php

use App\Models\Traits\MigrationCommonFormFields;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A scholar's leave application. Uses the shared form fields so it moves
 * through the same stage/approval machinery as every other form, but it
 * deliberately creates no `forms` row: like presentations, it is surfaced on
 * its own page rather than in the Forms list.
 */
return new class extends Migration
{
    use MigrationCommonFormFields;

    public function up(): void
    {
        Schema::create('student_leave_forms', function (Blueprint $table) {
            $this->addCommonFields($table);
            $table->enum('leave_type', ['casual', 'academic'])->default('casual');
            $table->date('from_date')->nullable()->index();
            $table->date('to_date')->nullable()->index();
            // Recorded for the HOD and charged at 0.5, but it never narrows
            // attendance coverage: there is only one session per day today.
            $table->enum('day_part', ['full', 'first_half', 'second_half'])->default('full');
            $table->text('reason')->nullable();
            $table->text('supporting_document')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_leave_forms');
    }
};

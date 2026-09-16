<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When a URF report can be filed.
 *
 * A progress report is not something a fellow files whenever they like: the
 * office opens the half-yearly round, and later the final one, the way a
 * semester is opened for PhD progress monitoring. Until a round is open the
 * form is not offered, and after it closes it is not accepted.
 *
 * One round per session per kind of report, so opening the 2026 half-yearly
 * round twice corrects it rather than making a second one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('urf_report_windows', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedSmallInteger('session')->index();
            $table->enum('type', ['half_yearly', 'final']);
            $table->date('opens_on');
            $table->date('closes_on');
            // What the office wants the fellows to know about this round.
            $table->string('notes')->nullable();
            $table->timestamps();
            $table->unique(['session', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('urf_report_windows');
    }
};

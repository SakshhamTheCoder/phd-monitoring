<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When a URF report can be filed, the way a semester is opened for PhD
 * progress monitoring. One round per session per kind of report.
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

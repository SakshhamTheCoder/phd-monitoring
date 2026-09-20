<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The synopsis is approved twice: once on the written submission, and again
 * after the viva, which is held offline.
 *
 * `round` is which of the two passes the form is on. It is not a step and not an
 * index: the chain a role hands the form to next is read from it, and nothing
 * else. Existing forms are on round 1, which is what they have been doing.
 *
 * The checklist is a set of declarations the scholar picks one of, and the set
 * depends on the year they were admitted, because the regulations changed. The
 * options are rows rather than a constant so a new year does not need a deploy.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('synopsis_checklist_options', function (Blueprint $table) {
            $table->id();
            // The year the scholar registered, matched against the year of their
            // date_of_registration. Not a foreign key: it is a rule about a year,
            // and it is written before any scholar of that year exists.
            $table->smallInteger('admission_year')->index();
            $table->string('label');
            $table->integer('sort_order')->default(0);
            // Retired rather than deleted, so a form that already chose an option
            // still reads back the wording the scholar actually agreed to.
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['admission_year', 'label']);
        });

        Schema::table('synopsis_submissions', function (Blueprint $table) {
            $table->unsignedTinyInteger('round')->default(1)->after('stage');
            $table->string('viva_minutes_pdf')->nullable();
            $table->unsignedBigInteger('checklist_option_id')->nullable();
            $table->foreign('checklist_option_id')
                ->references('id')
                ->on('synopsis_checklist_options')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('synopsis_submissions', function (Blueprint $table) {
            $table->dropForeign(['checklist_option_id']);
            $table->dropColumn(['round', 'viva_minutes_pdf', 'checklist_option_id']);
        });

        Schema::dropIfExists('synopsis_checklist_options');
    }
};

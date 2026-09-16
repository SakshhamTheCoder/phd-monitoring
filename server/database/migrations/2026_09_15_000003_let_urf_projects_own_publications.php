<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A URF fellow records publications the way a PhD scholar does, but has no
 * students row to hang them on. They belong to the URF project instead, so
 * both students on it see the same list. Exactly one of student_id and
 * urf_application_id is set.
 *
 * The publications sheet also asks how a paper was funded and whether it was
 * presented offline or online.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['publications', 'patents'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->integer('student_id')->unsigned()->nullable()->change();
                $table->integer('urf_application_id')->unsigned()->nullable()->after('student_id');
                $table->foreign('urf_application_id')->references('id')->on('urf_applications')->onDelete('cascade');
            });
        }

        Schema::table('publications', function (Blueprint $table) {
            $table->string('funding')->nullable();
            $table->enum('mode', ['offline', 'online'])->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('publications', function (Blueprint $table) {
            $table->dropColumn(['funding', 'mode']);
        });

        foreach (['publications', 'patents'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropForeign(['urf_application_id']);
                $table->dropColumn('urf_application_id');
            });
        }
    }
};

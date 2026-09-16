<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Every URF form is approved in turn: the student files it, their mentor reads
 * it, then the ADORDC, then the DORDC, and then it is done.
 *
 * The columns follow the PhD forms so the two read alike: `stage` says whose
 * turn it is, an approval and a comment per participant record what they did,
 * and `history` keeps the whole account of it. A rejection sends the form back
 * to the student with the reason, which is why comments are kept per step
 * rather than one field overwritten each time.
 *
 * Forms already filed start with the student's step done and the mentor next,
 * which is where they would be had the chain existed when they were submitted.
 */
return new class extends Migration
{
    private const TABLES = ['urf_applications', 'urf_fellows', 'urf_reports'];

    public const CHAIN = ['student', 'mentor', 'adordc', 'dordc'];

    public function up(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->string('stage', 20)->default('mentor')->index();
                foreach (['mentor', 'adordc', 'dordc'] as $step) {
                    $table->boolean("{$step}_approval")->default(false);
                    $table->text("{$step}_comments")->nullable();
                }
                $table->json('history')->nullable();
            });

            DB::table($name)->update(['stage' => 'mentor']);
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropIndex([$name === 'urf_applications' ? 'stage' : 'stage']);
                $table->dropColumn([
                    'stage', 'history',
                    'mentor_approval', 'mentor_comments',
                    'adordc_approval', 'adordc_comments',
                    'dordc_approval', 'dordc_comments',
                ]);
            });
        }
    }
};

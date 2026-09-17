<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Every URF form is read in turn: student, mentor, ADORDC, DORDC. The columns
 * follow the PhD forms so the two read alike. Forms already filed start at the
 * mentor, where they would be had the chain existed.
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

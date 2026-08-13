<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

/**
 * Fill in and approve every form for the test student, give them a publication,
 * and put it on the three forms that show one, so the supervisor account has a
 * complete history to open.
 *
 * The work itself lives in the demo:forms command, which can be run again by
 * hand for a retake. This only exists so the same thing happens automatically
 * wherever the branch is deployed.
 *
 * It skips quietly on any database that does not have both accounts, which is
 * every fresh install and every test run, so it can never fail a deploy.
 *
 * Nothing here is destructive: finished forms are skipped and a publication that
 * is already linked is left alone, so running it a second time only fills in
 * what is missing. On a database where it has already been recorded as run, use
 *
 *   php artisan migrate:refresh --path=database/migrations/2026_08_13_120000_fill_demo_forms_for_test_student.php
 *
 * which is safe because down() below does nothing.
 */
return new class extends Migration
{
    private const STUDENT = 'teststu@gmail.com';
    private const SUPERVISOR = 'ajain3_be22@thapar.edu';

    public function up(): void
    {
        $student = User::where('email', self::STUDENT)->first();
        $supervisor = User::where('email', self::SUPERVISOR)->first();

        if (!$student?->student || !$supervisor?->faculty) {
            Log::info('Skipping the demo form fill: this database has no ' . self::STUDENT . ' student or ' . self::SUPERVISOR . ' faculty.');
            return;
        }

        $exitCode = Artisan::call('demo:forms', [
            '--student' => self::STUDENT,
            '--supervisor' => self::SUPERVISOR,
        ]);

        // A form that will not go through is worth knowing about, but it is demo
        // data, so it must not take the deployment down with it.
        Log::info('demo:forms finished with exit code ' . $exitCode . ":\n" . Artisan::output());
    }

    public function down(): void
    {
        // Nothing to undo. Rolling back would mean deleting the student's forms
        // and their committee, which is not something a migration should decide.
    }
};

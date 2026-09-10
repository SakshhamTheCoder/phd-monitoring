<?php

namespace App\Console\Commands;

use App\Http\Controllers\Traits\NotificationManager;
use App\Models\Notifications;
use App\Models\Student;
use App\Models\ThesisSubmission;
use Illuminate\Console\Command;

/**
 * Warns a scholar a month before their thesis deadline, while an extension can
 * still be applied for.
 *
 *   php artisan thesis:notify-deadlines
 *
 * Meant to run daily. It notifies anywhere inside the last month rather than on
 * the exact thirtieth day, so a skipped run does not silently swallow the only
 * warning; one notification per deadline is kept by checking for the existing
 * one first.
 */
class NotifyThesisDeadlines extends Command
{
    use NotificationManager;

    protected $signature = 'thesis:notify-deadlines';

    protected $description = 'Notify scholars whose thesis deadline is within a month';

    private const WARN_WITHIN_DAYS = 30;

    public function handle(): int
    {
        $sent = 0;

        Student::with('user')->whereNotNull('date_of_registration')->chunkById(200, function ($students) use (&$sent) {
            foreach ($students as $student) {
                if ($this->notify($student)) {
                    $sent++;
                }
            }
        }, 'roll_no');

        $this->info("Thesis deadline warnings sent: {$sent}");

        return self::SUCCESS;
    }

    private function notify(Student $student): bool
    {
        $window = $student->thesisWindow();
        if (!$window || !$student->user) {
            return false;
        }

        $daysLeft = $window['days_remaining'];
        if ($daysLeft < 0 || $daysLeft > self::WARN_WITHIN_DAYS) {
            return false;
        }

        if ($this->hasSubmitted($student)) {
            return false;
        }

        // The deadline is in the link, so a warning for a deadline that has
        // since moved is a different notification, not a duplicate.
        $link = '/forms/thesis-extension?deadline=' . $window['latest'];
        if (Notifications::where('user_id', $student->user->id)->where('link', $link)->exists()) {
            return false;
        }

        $this->sendNotification(
            $student->user,
            'Thesis deadline approaching',
            "Your thesis is due on {$window['latest']} ({$daysLeft} days left). Apply for a thesis extension if you cannot submit by then.",
            $link,
            null,
            true
        );

        return true;
    }

    private function hasSubmitted(Student $student): bool
    {
        return ThesisSubmission::where('student_id', $student->roll_no)
            ->where('student_lock', true)
            ->exists();
    }
}

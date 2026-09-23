<?php

namespace App\Console\Commands;

use App\Http\Controllers\Traits\NotificationManager;
use App\Models\Notifications;
use App\Models\UrfApplication;
use App\Models\UrfReportWindow;
use Illuminate\Console\Command;

/**
 * Tells the students of every selected URF project when a report round opens.
 *
 *   php artisan urf:announce-report-rounds
 *
 * Runs daily, and again whenever the office saves a round, so a round opening
 * today is announced at once and one opening later is announced on its day.
 * Any round that is open counts, not only one that opened today, so a skipped
 * run does not swallow the notice. The round and its opening day are in the
 * link, so each student is told once per round, and a round moved to new dates
 * is announced again.
 */
class AnnounceUrfReportRounds extends Command
{
    use NotificationManager;

    protected $signature = 'urf:announce-report-rounds';

    protected $description = 'Notify URF students when a report round they must file in opens';

    public function handle(): int
    {
        $sent = 0;

        foreach (UrfReportWindow::all()->filter->is_open as $round) {
            $name = $round->type === 'final' ? 'final report' : 'half-yearly progress report';
            $link = "/forms?urf_round={$round->id}-{$round->opens_on->toDateString()}";

            $projects = UrfApplication::where('session', $round->session)->where('status', 'selected')->get();
            foreach ($projects as $project) {
                foreach ($project->memberUsers() as $student) {
                    if (Notifications::where('user_id', $student->id)->where('link', $link)->exists()) {
                        continue;
                    }
                    $this->sendNotification(
                        $student,
                        "URF {$name} is open",
                        "File the {$name} for \"{$project->project_title}\" by {$round->closes_on->format('d M Y')}. One report is filed per project, by either student.",
                        $link,
                        null,
                        true
                    );
                    $sent++;
                }
            }
        }

        $this->info("URF report round notices sent: {$sent}");

        return self::SUCCESS;
    }
}

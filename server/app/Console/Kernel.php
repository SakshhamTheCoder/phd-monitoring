<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // This ensures scheduled emails are processed
        $schedule->command('queue:work --stop-when-empty')->everyMinute();

        // One pass a day is enough: the warning window is a month wide and the
        // command will not send the same warning twice.
        $schedule->command('thesis:notify-deadlines')->dailyAt('06:00');
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
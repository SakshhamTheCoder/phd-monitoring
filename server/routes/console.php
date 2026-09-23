<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

// Laravel 11 reads the schedule from here. It sat in app/Console/Kernel.php,
// which this version never loads, so neither of these ran from `schedule:run`:
// queued mail (bulk welcome and reset links) waited in the jobs table, and the
// daily thesis deadline notice never went out.
Schedule::command('queue:work --stop-when-empty')->everyMinute()->withoutOverlapping();

// One pass a day is enough: the warning window is a month wide and the command
// will not send the same warning twice.
Schedule::command('thesis:notify-deadlines')->dailyAt('06:00');

// A URF report round is announced on the day it opens. Saving a round also
// runs this, so today's rounds do not wait for tomorrow.
Schedule::command('urf:announce-report-rounds')->dailyAt('06:00');

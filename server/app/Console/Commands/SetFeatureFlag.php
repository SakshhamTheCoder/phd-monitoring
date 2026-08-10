<?php

namespace App\Console\Commands;

use App\Models\FeatureFlag;
use Illuminate\Console\Command;

/**
 * Turns one of the PR #9 modules on or off without a deploy.
 *
 *   php artisan feature:set job_openings off
 *
 * Takes effect on the next request. Nothing is cached, so there is no config
 * to rebuild and no worker to restart afterwards.
 */
class SetFeatureFlag extends Command
{
    protected $signature = 'feature:set {key : research_profile or job_openings} {state : on or off}';

    protected $description = 'Enable or disable a feature';

    public function handle(): int
    {
        $key = $this->argument('key');

        if (!in_array($key, FeatureFlag::FLAGS, true)) {
            $this->error("Unknown feature '{$key}'. Known features: " . implode(', ', FeatureFlag::FLAGS));
            return self::FAILURE;
        }

        $state = strtolower((string) $this->argument('state'));
        $on = ['on', 'enable', 'enabled', 'true', '1', 'yes'];
        $off = ['off', 'disable', 'disabled', 'false', '0', 'no'];

        if (!in_array($state, array_merge($on, $off), true)) {
            $this->error("Unknown state '{$state}'. Use on or off.");
            return self::FAILURE;
        }

        $enabled = in_array($state, $on, true);

        FeatureFlag::updateOrCreate(['key' => $key], ['enabled' => $enabled]);

        $this->info("{$key} is now " . ($enabled ? 'enabled' : 'disabled') . '.');

        return self::SUCCESS;
    }
}

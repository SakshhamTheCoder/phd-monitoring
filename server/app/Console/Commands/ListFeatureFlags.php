<?php

namespace App\Console\Commands;

use App\Models\FeatureFlag;
use Illuminate\Console\Command;

/**
 * Shows what is currently switched on. See SetFeatureFlag to change one.
 */
class ListFeatureFlags extends Command
{
    protected $signature = 'feature:list';

    protected $description = 'Show every feature and whether it is enabled';

    public function handle(): int
    {
        $rows = [];
        foreach (FeatureFlag::map() as $key => $enabled) {
            $rows[] = [$key, $enabled ? 'enabled' : 'disabled'];
        }

        $this->table(['Feature', 'State'], $rows);

        return self::SUCCESS;
    }
}

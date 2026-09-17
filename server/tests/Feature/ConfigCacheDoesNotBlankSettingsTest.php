<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * The deploy runs `php artisan config:cache`, and a cached configuration stops
 * Laravel from loading .env, so every env() call outside config/ reads null in
 * production. That silently unauthenticated the SMTP connection and blanked the
 * Google client id. Settings belong in config/, read with config().
 */
class ConfigCacheDoesNotBlankSettingsTest extends TestCase
{
    public function test_no_env_call_lives_outside_the_config_directory(): void
    {
        $offenders = [];
        $root = dirname(__DIR__, 2);

        foreach (['app', 'routes', 'database'] as $directory) {
            $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator("{$root}/{$directory}"));
            foreach ($files as $file) {
                if ($file->getExtension() !== 'php') {
                    continue;
                }
                foreach (file($file->getPathname()) as $number => $line) {
                    // Comments mentioning env() are how this rule is explained
                    // where it was broken, so only code counts.
                    $code = preg_replace('#//.*$#', '', $line);
                    if (preg_match('/(?<![\w>$])env\s*\(/', (string) $code)) {
                        $offenders[] = str_replace($root . DIRECTORY_SEPARATOR, '', $file->getPathname()) . ':' . ($number + 1);
                    }
                }
            }
        }

        $this->assertSame([], $offenders, "Read these through config() instead:\n" . implode("\n", $offenders));
    }
}

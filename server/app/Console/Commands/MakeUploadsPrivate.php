<?php

namespace App\Console\Commands;

use App\Http\Controllers\FileController;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Moves storage/app/public/uploads (served to anyone at /storage/uploads) to
 * storage/app/uploads on the private disk, then rewrites the stored paths
 * from '/app/public/uploads/...' to '/app/uploads/...'.
 *
 *   php artisan uploads:make-private --dry-run
 *   php artisan uploads:make-private
 *
 * Safe to run again: a file already on the private disk is not copied twice,
 * and only rows still holding the old prefix are rewritten. The rewrite is
 * skipped if any file failed to move, so no row points at a missing file.
 */
class MakeUploadsPrivate extends Command
{
    protected $signature = 'uploads:make-private {--dry-run : List what would move without touching files or rows}';

    protected $description = 'Move uploaded documents off the public disk and onto the private one';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $failed = $this->moveFiles($dryRun);
        if ($failed > 0) {
            $this->error("{$failed} file(s) could not be moved, so no stored paths were rewritten. Fix the errors above and run the command again.");
            return self::FAILURE;
        }

        $this->rewritePaths($dryRun);
        return self::SUCCESS;
    }

    /** Returns how many files failed to move. */
    private function moveFiles(bool $dryRun): int
    {
        $public = Storage::disk('public');
        $private = Storage::disk('local');
        $moved = 0;
        $failed = 0;

        foreach ($public->allFiles('uploads') as $relative) {
            if ($dryRun) {
                $this->line("would move: {$relative}");
                $moved++;
                continue;
            }

            // A copy left by an earlier, interrupted run is kept only if it is whole.
            if (!$private->exists($relative) || $private->size($relative) !== $public->size($relative)) {
                $private->writeStream($relative, $public->readStream($relative));
            }
            if (!$private->exists($relative) || $private->size($relative) !== $public->size($relative)) {
                $this->error("could not copy, left in place: {$relative}");
                $failed++;
                continue;
            }

            $public->delete($relative);
            $moved++;
        }

        $this->info(($dryRun ? 'Would move' : 'Moved') . " {$moved} file(s).");
        return $failed;
    }

    private function rewritePaths(bool $dryRun): void
    {
        foreach (FileController::COLUMNS as $model => $columns) {
            $table = (new $model())->getTable();
            foreach ($columns as $column) {
                $rows = DB::table($table)->where($column, 'like', '/app/public/uploads/%');
                $count = $dryRun
                    ? $rows->count()
                    : $rows->update([$column => DB::raw("REPLACE({$column}, '/app/public/uploads/', '/app/uploads/')")]);
                if ($count > 0) {
                    $this->info(($dryRun ? 'Would rewrite' : 'Rewrote') . " {$count} path(s) in {$table}.{$column}.");
                }
            }
        }
    }
}

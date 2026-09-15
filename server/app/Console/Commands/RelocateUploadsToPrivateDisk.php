<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

// Advertisement uploads stay excluded, PublicOpeningController::advertisement serves them publicly on purpose.
class RelocateUploadsToPrivateDisk extends Command
{
    protected $signature = 'uploads:relocate-to-private {--dry-run : Report what would move without touching anything}';

    protected $description = 'Move private uploads off the public disk and onto the private local disk (audit D12)';

    private const PATH_COLUMNS = [
        ['constitute_of_irb', 'irb_pdf'],
        ['irb_sub_forms', 'revised_irb_pdf'],
        ['patents', 'first_page'],
        ['publications', 'first_page'],
        ['projects', 'sanction_letter_link'],
        ['projects', 'gantt_chart_path'],
        ['project_documents', 'file_path'],
        ['presentations', 'presentation_pdf'],
        ['semesters', 'ppt_file'],
        ['student_leave_forms', 'supporting_document'],
        ['student_semester_off_forms', 'previous_approval_pdf'],
        ['student_semester_off_forms', 'proof_pdf'],
        ['synopsis_submissions', 'synopsis_pdf'],
        ['thesis_extentions_form', 'previous_extention_pdf'],
        ['thesis_submissions', 'thesis_pdf'],
        ['thesis_submissions', 'fee_receipt'],
        ['research_extentions_form', 'research_pdf'],
        ['position_applications', 'resume_path'],
    ];

    private const EXCLUDED_PREFIX = 'uploads/project_advertisement/';

    public function handle()
    {
        $dryRun = (bool) $this->option('dry-run');
        $this->moveFiles($dryRun);
        $this->rewriteColumns($dryRun);
        return self::SUCCESS;
    }

    private function moveFiles(bool $dryRun): void
    {
        $public = Storage::disk('public');
        $local = Storage::disk('local');

        $files = collect($public->allFiles('uploads'))
            ->reject(fn ($relative) => str_starts_with($relative, self::EXCLUDED_PREFIX));

        $moved = 0;
        $alreadyMoved = 0;
        $wouldMove = 0;

        foreach ($files as $relative) {
            if ($local->exists($relative)) {
                $alreadyMoved++;
                if (!$dryRun) {
                    $public->delete($relative);
                }
                continue;
            }

            if ($dryRun) {
                $wouldMove++;
                $this->line("would move: {$relative}");
                continue;
            }

            $local->writeStream($relative, $public->readStream($relative));
            if (!$local->exists($relative) || $local->size($relative) !== $public->size($relative)) {
                $this->error("copy verification failed, source kept: {$relative}");
                continue;
            }
            $public->delete($relative);
            $moved++;
            $this->line("moved: {$relative}");
        }

        if ($dryRun) {
            $this->info("dry run: {$wouldMove} file(s) would move, {$alreadyMoved} already at destination (source would be cleaned up).");
        } else {
            $this->info("{$moved} file(s) moved, {$alreadyMoved} already at destination.");
        }
    }

    private function rewriteColumns(bool $dryRun): void
    {
        foreach (self::PATH_COLUMNS as [$table, $column]) {
            $query = DB::table($table)->where($column, 'like', '/app/public/uploads/%');

            if ($dryRun) {
                $count = $query->count();
                if ($count > 0) {
                    $this->info("dry run: {$table}.{$column} has {$count} row(s) to rewrite.");
                }
                continue;
            }

            $updated = $query->update([
                $column => DB::raw("REPLACE({$column}, '/app/public/', '/app/')"),
            ]);
            if ($updated > 0) {
                $this->info("{$table}.{$column}: {$updated} row(s) rewritten.");
            }
        }
    }
}

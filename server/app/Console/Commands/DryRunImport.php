<?php

namespace App\Console\Commands;

use App\Http\Controllers\CourseController;
use App\Http\Controllers\StudentCourseController;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Runs a sheet through an import and then undoes it, so the office can read
 * what would happen before it happens.
 *
 * The imports report per row and refuse nothing lightly, which is right, but it
 * means a surprise is only found once the records are written. Everything here
 * happens inside a transaction that is always rolled back, so the answer costs
 * nothing but the time.
 *
 * The database is named first, because a rollback still takes locks and nobody
 * should discover afterwards that this ran against production.
 */
class DryRunImport extends Command
{
    protected $signature = 'import:dry-run
        {file : a CSV exported from the sheet}
        {--kind=courses : courses for the catalogue, coursework for the scholar tags}';

    protected $description = 'Read a sheet through an import and roll it back, reporting what it would do';

    public function handle(): int
    {
        $path = $this->argument('file');
        if (!is_file($path)) {
            $this->error("No file at {$path}");
            return self::FAILURE;
        }

        $rows = $this->rowsFrom($path);
        if (!$rows) {
            $this->error('That file has a header and no rows.');
            return self::FAILURE;
        }

        $columns = array_keys($rows[0]);
        $this->line('Database: ' . DB::connection()->getDatabaseName());
        $this->line('Rows in the file: ' . count($rows));
        $this->line('Columns: ' . implode(', ', array_filter($columns, fn ($name) => $name !== '_rowNumber')));
        $this->newLine();

        $office = User::whereHas('current_role', fn ($query) => $query->where('role', 'admin'))->first();
        if (!$office) {
            $this->error('No admin account on this database to run the import as.');
            return self::FAILURE;
        }
        Auth::login($office);

        DB::beginTransaction();
        try {
            $answer = $this->runImport($rows);
        } finally {
            DB::rollBack();
        }

        $this->report($answer);
        $this->newLine();
        $this->info('Rolled back. Nothing above was kept.');

        return self::SUCCESS;
    }

    /** @return array<int, array<string, string>> */
    private function rowsFrom(string $path): array
    {
        $handle = fopen($path, 'r');
        $header = fgetcsv($handle);
        if (!$header) {
            return [];
        }

        // A file saved from Excel starts with a byte order mark, which would
        // otherwise become part of the first column's name.
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $header[0]);

        $rows = [];
        $line = 2;
        while (($values = fgetcsv($handle)) !== false) {
            if ($values === [null] || $values === ['']) {
                $line++;
                continue;
            }

            $row = ['_rowNumber' => $line++];
            foreach ($header as $index => $name) {
                $row[(string) $name] = (string) ($values[$index] ?? '');
            }
            $rows[] = $row;
        }
        fclose($handle);

        return $rows;
    }

    /**
     * @param  array<int, array<string, string>>  $rows
     * @return array<string, mixed>
     */
    private function runImport(array $rows): array
    {
        [$path, $controller, $method] = match ($this->option('kind')) {
            'courses' => ['/api/courses/import', CourseController::class, 'importCoursesFromCSV'],
            'coursework' => ['/api/courses/student/bulk-import', StudentCourseController::class, 'bulkImportFromCSV'],
            default => [null, null, null],
        };

        if (!$path) {
            $this->error("No dry run for '{$this->option('kind')}' yet.");
            return [];
        }

        $request = Request::create($path, 'POST', ['rows' => $rows]);
        $request->setUserResolver(fn () => Auth::user());

        return app($controller)->{$method}($request)->getData(true);
    }

    /** @param array<string, mixed> $answer */
    private function report(array $answer): void
    {
        $data = $answer['data'] ?? [];
        $this->info($answer['message'] ?? 'no answer');
        $this->line('Would add: ' . ($data['success_count'] ?? 0));
        $this->line('Would update: ' . ($data['update_count'] ?? 0));
        $this->line('Would lose: ' . ($data['error_count'] ?? 0));

        $notes = $data['errors'] ?? [];
        if (!$notes) {
            $this->newLine();
            $this->info('Not one row to look at.');
            return;
        }

        $this->newLine();
        $this->line('Every row it would report (' . count($notes) . '):');
        foreach ($notes as $note) {
            $this->line('  ' . $note);
        }
    }
}

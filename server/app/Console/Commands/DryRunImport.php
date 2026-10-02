<?php

namespace App\Console\Commands;

use App\Http\Controllers\CourseController;
use App\Http\Controllers\FacultyController;
use App\Http\Controllers\PresentationController;
use App\Http\Controllers\StudentController;
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
 * happens inside a transaction that is rolled back, so the answer costs nothing
 * but the time. With --commit the same run is kept instead, which is how a sheet
 * of thousands of rows is imported at all: the page posts them in one request
 * and a web server will not wait that long.
 *
 * The database is named first, because a rollback still takes locks and nobody
 * should discover afterwards that this ran against production.
 */
class DryRunImport extends Command
{
    protected $signature = 'import:dry-run
        {file : a CSV exported from the sheet}
        {--kind=courses : courses, coursework, progress, scholars or faculty}
        {--out= : write what it would report as JSON, keyed by the row number in the sheet}
        {--commit : keep what the import does instead of rolling it back}';

    protected $description = 'Read a sheet through an import and report what it does, rolling back unless --commit';

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

        $keep = (bool) $this->option('commit');
        if ($keep && !$this->confirm('Keep what this import does to ' . DB::connection()->getDatabaseName() . '?')) {
            return self::FAILURE;
        }

        DB::beginTransaction();
        try {
            $answer = $this->runImport($rows);
            $keep ? DB::commit() : DB::rollBack();
        } catch (\Throwable $failed) {
            DB::rollBack();
            throw $failed;
        }

        $this->report($answer);

        if ($this->option('out')) {
            $this->write($answer, $this->option('out'));
        }

        $this->newLine();
        $this->info($keep ? 'Kept. Everything above is now on the database.'
            : 'Rolled back. Nothing above was kept.');

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
            'progress' => ['/api/presentation/import-progress', PresentationController::class, 'importProgress'],
            'scholars' => ['/api/students/bulk-upload', StudentController::class, 'bulkUpload'],
            'faculty' => ['/api/faculty/bulk-import', FacultyController::class, 'upload'],
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

    /**
     * What it would report, keyed by the sheet's own row number, for the marker
     * that colours those rows in a copy of the sheet.
     *
     * @param  array<string, mixed>  $answer
     */
    private function write(array $answer, string $path): void
    {
        $byRow = [];
        foreach ($answer['data']['errors'] ?? [] as $message) {
            if (preg_match('/^Row (\d+): (.*)$/s', (string) $message, $found)) {
                $byRow[$found[1]][] = $found[2];
                continue;
            }

            // A line about the run rather than a row, such as a count of the
            // rows that gave a standing total.
            $byRow['0'][] = (string) $message;
        }

        file_put_contents($path, json_encode($byRow, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        $this->newLine();
        $this->info(count($byRow) . ' rows written to ' . $path);
    }

    /** @param array<string, mixed> $answer */
    private function report(array $answer): void
    {
        $data = $answer['data'] ?? [];
        $this->info($answer['message'] ?? 'no answer');
        // Said in the past tense once the run is kept, because by now it has.
        $said = $this->option('commit') ? ['Added', 'Updated', 'Reported'] : ['Would add', 'Would update', 'Would lose'];
        $this->line("{$said[0]}: " . ($data['success_count'] ?? 0));
        $this->line("{$said[1]}: " . ($data['update_count'] ?? 0));
        $this->line("{$said[2]}: " . ($data['error_count'] ?? 0));

        $notes = $data['errors'] ?? [];
        if (!$notes) {
            $this->newLine();
            $this->info('Not one row to look at.');
            return;
        }

        $this->newLine();
        $this->line('Every row ' . ($this->option('commit') ? 'it reported' : 'it would report')
            . ' (' . count($notes) . '):');
        foreach ($notes as $note) {
            $this->line('  ' . $note);
        }
    }
}

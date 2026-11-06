<?php

namespace App\Http\Controllers;

use App\Models\Faculty;
use App\Models\Project;
use App\Models\User;
use App\Projects\ProjectWizard;
use App\Support\CsvRow;
use App\Support\ImportReport;
use App\Support\Navigation;
use App\Support\ProjectDuration;
use App\Support\ProjectRequestRules;
use App\Support\RowRejected;
use App\Support\SheetDate;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Projects from the office's spreadsheet: one row per project, the PI found by
 * email.
 *
 * Importing for other people's projects is a bigger power than creating your
 * own, so it is the office's (admin and DORDC) and everybody else keeps the
 * create wizard. The sheet is read a row at a time: a bad row is named and
 * left out, never a reason to refuse the file, and each project is written in
 * a transaction of its own so a failure leaves no half project and a long
 * sheet is not one request holding thousands of writes.
 *
 * A project the PI already has with the same title and start date is the same
 * project, so the same file can be loaded twice: it is updated from the cells
 * the row fills in and nothing is added.
 */
class ProjectImportController extends Controller
{
    private const HONORIFICS = ['dr', 'prof', 'professor', 'mr', 'mrs', 'ms', 'er', 'shri', 'smt'];

    private const DESCRIPTION_MAX = 2000;

    /** Who may import: the office, and only while they may manage projects at all. */
    public static function mayImport(?User $user): bool
    {
        return $user !== null && Navigation::allows($user, 'admin') && $user->may('can_manage_projects');
    }

    /**
     * The sheet's rows as the browser posts them, read into the cells the
     * import works from. Every header is matched by CsvRow, so the bracketed
     * hints in the template ("Category (In-house, ...)") and the short names
     * people save both land in the same place.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    public static function projectRows(array $rows): array
    {
        return array_map(function (array $row) {
            $coPis = [];
            foreach ([1, 2, 3] as $slot) {
                $coPis[] = [
                    'name' => CsvRow::column($row, "Co-PI {$slot} Name", "co_pi_{$slot}_name"),
                    'email' => CsvRow::column($row, "Co-PI {$slot} Email", "co_pi_{$slot}_email"),
                ];
            }

            $objectives = [];
            foreach ([1, 2, 3, 4, 5] as $number) {
                $objectives[] = CsvRow::column($row, "Objective {$number}", "objective_{$number}");
            }

            return [
                'title' => CsvRow::column($row, 'Project Title', 'title'),
                'pi_name' => CsvRow::column($row, 'PI Name', 'pi_name'),
                'pi_email' => CsvRow::column($row, 'PI Email', 'pi_email'),
                'category' => CsvRow::column($row, 'Category', 'category'),
                'status' => CsvRow::column($row, 'Status', 'status'),
                'funding_agency' => CsvRow::column($row, 'Funding Agency', 'funding_agency'),
                'amount' => CsvRow::column($row, 'Sanctioned Amount', 'Sanctioned Amount (Rs)', 'Amount', 'amount'),
                'tiet_share' => CsvRow::column($row, 'TIET Share', 'tiet_share'),
                'start_date' => CsvRow::column($row, 'Start Date', 'start_date'),
                'duration_years' => CsvRow::column($row, 'Duration Years', 'duration_years'),
                'duration_months' => CsvRow::column($row, 'Duration Months', 'duration_months'),
                'focus_area' => CsvRow::column($row, 'Focus Area', 'focus_area'),
                'grant_type' => CsvRow::column($row, 'Grant Type', 'grant_type'),
                'co_pis' => $coPis,
                'description' => CsvRow::column($row, 'Description', 'description'),
                'objectives' => array_values(array_filter($objectives, fn ($objective) => $objective !== '')),
                'sdgs' => CsvRow::column($row, 'SDGs', 'sdgs'),
                'sanction_letter_link' => CsvRow::column($row, 'Sanction Letter Link', 'sanction_letter_link'),
                'row_number' => $row['_rowNumber'] ?? $row['row_number'] ?? null,
            ];
        }, $rows);
    }

    public function import(Request $request)
    {
        if (!self::mayImport(Auth::user())) {
            return response()->json(['message' => 'You do not have permission to import projects'], 403);
        }

        $posted = $request->validate(['rows' => 'required|array|min:1'])['rows'];

        // The page posts the sheet as it is; a caller that already read it
        // (it carries row_number) is taken as read.
        $rows = [];
        foreach (array_values($posted) as $index => $row) {
            $row = (array) $row;
            $read = array_key_exists('row_number', $row) ? $row : self::projectRows([$row])[0];
            $read['row_number'] ??= $index + 2;
            $rows[] = $read;
        }

        $imported = 0;
        $updated = 0;
        $errors = [];
        $warnings = [];

        foreach ($rows as $row) {
            $line = $row['row_number'];
            try {
                $outcome = DB::transaction(fn () => $this->importRow($row, $line));
            } catch (RowRejected $rejected) {
                $errors[] = "Row {$line}: " . $rejected->getMessage();
                continue;
            } catch (\Throwable $failure) {
                report($failure);
                $errors[] = "Row {$line}: the project could not be saved.";
                continue;
            }

            $outcome['created'] ? $imported++ : $updated++;
            foreach ($outcome['warnings'] as $warning) {
                $warnings[] = "Row {$line}: {$warning}";
            }
        }

        $skipped = count($errors);
        $notes = array_merge($errors, $warnings);
        $plural = fn (int $n) => $n === 1 ? 'project' : 'projects';

        return response()->json([
            'success' => true,
            'message' => "Imported {$imported} {$plural($imported)}, updated {$updated}, skipped {$skipped}",
            // What the page tells the reader, in order.
            'messages' => ImportReport::withRowErrors([
                ['tone' => 'success', 'text' => "{$imported} {$plural($imported)} imported, {$updated} updated, {$skipped} skipped"],
            ], $notes),
            'data' => [
                'success_count' => $imported,
                // update_count is what a batched import adds up; updated_count says the same.
                'update_count' => $updated,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                // A row refused. Notes about a row that was taken are in errors too, so they are read, but they are not counted here.
                'error_count' => $skipped,
                'warning_count' => count($warnings),
                'errors' => $notes,
            ],
        ], 200);
    }

    /**
     * One project: read, checked, then created or updated with its Co-PIs.
     *
     * @return array{created: bool, warnings: array<int, string>}
     * @throws RowRejected
     */
    private function importRow(array $row, int|string $line): array
    {
        $warnings = [];

        // A title pasted from a document carries line breaks and non-breaking
        // spaces; two spellings of one title must be one project.
        $title = trim(preg_replace('/[\s\x{00A0}\x{200B}]+/u', ' ', (string) $row['title']));
        if ($title === '') {
            throw new RowRejected('Project Title is needed.');
        }
        if ($row['pi_email'] === '') {
            throw new RowRejected("PI Email is needed for '{$title}'.");
        }
        if ($row['start_date'] === '') {
            throw new RowRejected("Start Date is needed for '{$title}'.");
        }

        $start = self::date($row['start_date']);
        if ($start === '') {
            throw new RowRejected("Start Date '{$row['start_date']}' is not a date, write it as DD-MM-YYYY.");
        }

        $pi = self::internalFacultyByEmail($row['pi_email']);
        if (!$pi) {
            throw new RowRejected("no internal faculty member has the email {$row['pi_email']}.");
        }
        if ($row['pi_name'] !== '' && !self::sameName($row['pi_name'], $pi->user->name())) {
            $warnings[] = "PI name '{$row['pi_name']}' does not match {$pi->user->name()}, the account for {$row['pi_email']}. The account was used.";
        }

        $project = Project::where('pi_faculty_code', $pi->faculty_code)
            ->whereRaw('lower(title) = ?', [mb_strtolower($title)])
            ->whereDate('start_date', $start)
            ->first();
        $created = $project === null;

        // A new project needs the cells a project cannot do without. One that
        // exists is updated from whichever cells the row fills in.
        if ($created) {
            $missing = array_keys(array_filter([
                'Category' => $row['category'] === '',
                'Funding Agency' => $row['funding_agency'] === '',
                'Sanctioned Amount' => $row['amount'] === '',
                'Duration Years' => $row['duration_years'] === '' && $row['duration_months'] === '',
            ]));
            if ($missing) {
                throw new RowRejected(implode(', ', $missing) . ' ' . (count($missing) === 1 ? 'is' : 'are') . " needed to add '{$title}'.");
            }
        }

        $values = [];

        if ($row['category'] !== '') {
            $values['category'] = self::oneOf($row['category'], ProjectWizard::CATEGORIES)
                ?? throw new RowRejected("Category '{$row['category']}' is not one of " . implode(', ', ProjectWizard::CATEGORIES) . '.');
        }
        if ($row['status'] !== '') {
            $values['status'] = self::oneOf($row['status'], ProjectWizard::STATUSES)
                ?? throw new RowRejected("Status '{$row['status']}' is not one of " . implode(', ', ProjectWizard::STATUSES) . '.');
        } elseif ($created) {
            $values['status'] = 'Pending';
        }
        if ($row['funding_agency'] !== '') {
            $values['funding_agency'] = $row['funding_agency'];
        }
        if ($row['amount'] !== '') {
            $values['amount'] = self::rupees($row['amount'])
                ?? throw new RowRejected("Sanctioned Amount '{$row['amount']}' is not an amount in rupees.");
        }
        if ($row['tiet_share'] !== '') {
            $values['tiet_share'] = self::rupees($row['tiet_share'])
                ?? throw new RowRejected("TIET Share '{$row['tiet_share']}' is not an amount in rupees.");
        }
        foreach (['focus_area', 'grant_type'] as $text) {
            if ($row[$text] !== '') {
                $values[$text] = $row[$text];
            }
        }
        if ($row['description'] !== '') {
            if (mb_strlen($row['description']) > self::DESCRIPTION_MAX) {
                throw new RowRejected('Description is longer than ' . self::DESCRIPTION_MAX . ' characters.');
            }
            $values['description'] = $row['description'];
        }
        if ($row['objectives']) {
            $values['objectives'] = $row['objectives'];
        }
        if ($row['sdgs'] !== '') {
            $values['sdgs'] = self::goals($row['sdgs']);
        }
        if ($row['sanction_letter_link'] !== '') {
            if (!preg_match('#^https?://#i', $row['sanction_letter_link'])) {
                throw new RowRejected("Sanction Letter Link '{$row['sanction_letter_link']}' must start with http:// or https://.");
            }
            $values['sanction_letter_link'] = $row['sanction_letter_link'];
            $values['sanction_letter_name'] = 'Sanction Letter';
        }

        // The length: what the row says, over what is stored, over none.
        $years = self::count($row['duration_years'], 'Duration Years');
        $months = self::count($row['duration_months'], 'Duration Months');
        $years ??= $created ? 0 : (int) $project->duration_years;
        $months ??= $created ? 0 : (int) $project->duration_months;
        if ($created || $row['duration_years'] !== '' || $row['duration_months'] !== '') {
            if ($years + $months === 0) {
                throw new RowRejected("a duration is needed for '{$title}', give Duration Years or Duration Months.");
            }
            $values += ['duration_years' => $years, 'duration_months' => $months];
        }

        // What the create wizard checks, checked the same way here.
        $check = Validator::make([
            'title' => $title,
            'category' => $values['category'] ?? $project?->category,
            'pi_faculty_code' => $pi->faculty_code,
            'status' => $values['status'] ?? $project?->status,
            'duration_years' => $values['duration_years'] ?? null,
            'duration_months' => $values['duration_months'] ?? null,
            'sdgs' => $values['sdgs'] ?? null,
            'objectives' => $values['objectives'] ?? null,
        ], ProjectRequestRules::forStore());
        if ($check->fails()) {
            throw new RowRejected($check->errors()->first());
        }

        $project ??= new Project();
        $project->pi_faculty_code = $pi->faculty_code;
        $project->title = $title;
        $project->start_date = $start;
        $project->role = 'PI';
        foreach ($values as $column => $value) {
            $project->{$column} = $value;
        }
        // The end follows the start and the length, as it does in the wizard.
        if ($created || isset($values['duration_years'])) {
            $project->end_date = Carbon::parse($start)->addYearsNoOverflow($years)->addMonthsNoOverflow($months)->toDateString();
        }

        $coPis = $this->coPis($row, $pi, $warnings);
        if ($coPis) {
            $project->co_pis = self::merge($project->co_pis ?: [], $coPis);
        }

        $project->save();
        $project->syncCoPiAccess();

        return ['created' => $created, 'warnings' => $warnings];
    }

    /**
     * The Co-PIs a row names, as the project form writes them.
     *
     * One found among the faculty is recorded from the portal's own record of
     * them. One who is not is kept as an outside Co-PI, with a note. The PI
     * named again as their own Co-PI is dropped.
     *
     * @return array<int, array<string, mixed>>
     */
    private function coPis(array $row, Faculty $pi, array &$warnings): array
    {
        $found = [];
        foreach ($row['co_pis'] as $index => $slot) {
            $number = $index + 1;
            $name = trim((string) ($slot['name'] ?? ''));
            $email = trim((string) ($slot['email'] ?? ''));
            if ($name === '' && $email === '') {
                continue;
            }

            if ($email !== '') {
                $faculty = self::internalFacultyByEmail($email);
                if ($faculty) {
                    if ($faculty->faculty_code === $pi->faculty_code) {
                        $warnings[] = "Co-PI {$number} ({$email}) is the PI, left out of the Co-PIs.";
                        continue;
                    }
                    $found[] = [
                        'type' => 'internal',
                        'faculty_code' => $faculty->faculty_code,
                        'name' => $faculty->user->name(),
                        'department' => \App\Support\DepartmentLabel::of($faculty->department) ?? 'N/A',
                        'designation' => $faculty->designation,
                        'email' => $faculty->user->email,
                    ];
                    continue;
                }
                $warnings[] = "Co-PI {$number} ({$email}) is not internal faculty, added as an external Co-PI.";
            }

            $found[] = [
                'type' => 'external',
                'name' => $name !== '' ? $name : $email,
                'designation' => '',
                'institute' => '',
                'email' => $email,
                'mobile' => '',
                'website' => '',
            ];
        }

        return $found;
    }

    /**
     * Co-PIs already on the project stay; the sheet's are added to them. Sending
     * the same file again adds nobody twice.
     */
    private static function merge(array $stored, array $incoming): array
    {
        $same = function (array $a, array $b): bool {
            if (($a['type'] ?? null) === 'internal' || ($b['type'] ?? null) === 'internal') {
                return !empty($a['faculty_code']) && ($a['faculty_code'] ?? null) == ($b['faculty_code'] ?? null);
            }
            $email = strtolower(trim((string) ($a['email'] ?? '')));

            return $email !== ''
                ? $email === strtolower(trim((string) ($b['email'] ?? '')))
                : strtolower(trim((string) ($a['name'] ?? ''))) === strtolower(trim((string) ($b['name'] ?? '')));
        };

        foreach ($incoming as $person) {
            if (!collect($stored)->contains(fn ($each) => $same($each, $person))) {
                $stored[] = $person;
            }
        }

        return array_values($stored);
    }

    /** A person at the institute with this email: compared as written, not as cased. */
    private static function internalFacultyByEmail(string $email): ?Faculty
    {
        // Stray spaces, zero-width characters, a mailto: and a trailing comma or
        // full stop come with an address copied from a mail or a web page.
        $email = mb_strtolower(preg_replace('/[\s\x{00A0}\x{200B}\x{FEFF}<>]+/u', '', $email));
        $email = rtrim(preg_replace('/^mailto:/', '', $email), '.,;');

        return Faculty::with(['user', 'department'])
            ->whereHas('user', fn ($query) => $query->whereRaw('lower(email) = ?', [$email]))
            ->where('type', 'internal')
            ->first();
    }

    /** Whether two spellings of a name share a word, once titles and initials are set aside. */
    private static function sameName(string $written, string $account): bool
    {
        $words = fn (string $name) => array_values(array_filter(
            preg_split('/[^a-z]+/', mb_strtolower($name)),
            fn ($word) => strlen($word) > 1 && !in_array($word, self::HONORIFICS, true)
        ));

        return $words($written) === [] || array_intersect($words($written), $words($account)) !== [];
    }

    /** The menu's own spelling of a value written in any case, or null. */
    private static function oneOf(string $value, array $options): ?string
    {
        // "On-hold", "on hold" and "OnHold" are one status.
        $plain = fn (string $text) => preg_replace('/[^a-z0-9]+/', '', mb_strtolower($text));
        foreach ($options as $option) {
            if ($plain($value) === $plain($option)) {
                return $option;
            }
        }

        return null;
    }

    /**
     * Rupees as a sheet writes them: 4850000, 48,50,000, Rs. 48,50,000, ₹4850000,
     * or 4.85E+06 once it has been through Excel. Null for anything else,
     * and for a negative figure.
     */
    private static function rupees(string $value): ?int
    {
        $digits = preg_replace('/^(?:₹|rs\.?|inr)\s*/i', '', trim($value));
        // "5,07,000/-" and "5,07,000 only" are how a cheque amount is written.
        $digits = preg_replace('/(?:\/-|\s+only)\s*$/i', '', $digits);
        $digits = str_replace([',', ' ', "\u{00A0}"], '', $digits);

        return preg_match('/^\d+(\.\d+)?(e[+-]?\d+)?$/i', $digits) ? (int) round((float) $digits) : null;
    }

    /** A whole number of years or months; null when the cell is empty. */
    private static function count(string $value, string $column): ?int
    {
        if ($value === '') {
            return null;
        }
        if (!preg_match('/^\d+(\.0+)?$/', $value)) {
            throw new RowRejected("{$column} '{$value}' is not a whole number.");
        }
        $number = (int) $value;
        $limit = $column === 'Duration Years' ? ProjectDuration::MAX_YEARS : ProjectDuration::MAX_MONTHS;
        if ($number > $limit) {
            throw new RowRejected("{$column} '{$value}' is more than {$limit}.");
        }

        return $number;
    }

    /** The SDG numbers in a cell, in order, each once. */
    private static function goals(string $cell): array
    {
        $goals = [];
        foreach (preg_split('/[,;\s]+/', $cell, -1, PREG_SPLIT_NO_EMPTY) as $token) {
            if (!preg_match('/^\d{1,2}$/', $token) || (int) $token < 1 || (int) $token > 17) {
                throw new RowRejected("SDG '{$token}' is not a number from 1 to 17.");
            }
            $goals[(int) $token] = (int) $token;
        }

        return array_values($goals);
    }

    /**
     * Y-m-d from what the sheet shows: DD-MM-YYYY, D/M/YYYY, YYYY-MM-DD, or the
     * serial number Excel stores a date as. '' when it is none of those.
     */
    private static function date(string $value): string
    {
        $value = trim($value);
        if (preg_match('/^\d{5}(\.\d+)?$/', $value) && (float) $value > 20000 && (float) $value < 80000) {
            return Carbon::create(1899, 12, 30)->addDays((int) floor((float) $value))->toDateString();
        }

        return SheetDate::parse($value);
    }
}

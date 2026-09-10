<?php

namespace App\Support;

use App\Models\AppSetting;
use App\Models\Faculty;
use Illuminate\Support\Facades\DB;

/**
 * How many scholars a faculty member may guide, and how many they already do.
 *
 * The limit follows rank, not the person, so it is read from the designation.
 * Designations are free text and the institute writes them a dozen ways
 * ("Assistant Professor-II", "Professor (Term)", "Associate Professor (SLAS)"),
 * so they are matched to a tier rather than looked up exactly. Anything that
 * does not name a rank falls to its own configurable limit rather than being
 * assumed generous.
 */
class SupervisionCapacity
{
    public const TIERS = ['professor', 'associate_professor', 'assistant_professor', 'other'];

    /**
     * The tier a designation belongs to.
     *
     * Order matters: "Assistant Professor" contains "Professor", so the
     * narrower ranks have to be recognised first.
     */
    public static function tier(?string $designation): string
    {
        $designation = strtolower(trim((string) $designation));

        return match (true) {
            str_contains($designation, 'assistant') => 'assistant_professor',
            str_contains($designation, 'associate') => 'associate_professor',
            str_contains($designation, 'professor') => 'professor',
            default => 'other',
        };
    }

    /** The configured ceiling for this designation. */
    public static function limitFor(?string $designation): int
    {
        return AppSetting::value('supervision', 'max_' . self::tier($designation));
    }

    /**
     * Scholars this faculty member is guiding now.
     *
     * A scholar who has submitted their thesis is still on the supervisors
     * table, and always will be: nothing detaches them, and the record of who
     * guided whom is worth keeping. They are not a current commitment though,
     * so they do not occupy a slot.
     */
    public static function currentLoad(Faculty $faculty): int
    {
        return $faculty->currentlySupervisedStudents()->count();
    }

    /** Slots left, never negative: a supervisor over the line reads as full. */
    public static function remaining(Faculty $faculty): int
    {
        return max(0, self::limitFor($faculty->designation) - self::currentLoad($faculty));
    }

    /**
     * Current load for many faculty at once, keyed by faculty_code.
     *
     * One grouped query rather than a count per candidate: the recommender
     * scores every faculty member in a department, and asking the database
     * once per row turns a page load into five hundred queries.
     *
     * @param  iterable<int|string>  $facultyCodes
     * @return array<int,int>
     */
    public static function loadsFor(iterable $facultyCodes): array
    {
        $codes = array_values(array_unique(array_map('intval', iterator_to_array($facultyCodes, false))));
        if (!$codes) {
            return [];
        }

        return DB::table('supervisors')
            ->join('students', 'students.roll_no', '=', 'supervisors.student_id')
            ->whereIn('supervisors.faculty_id', $codes)
            ->whereNull('students.date_of_thesis')
            ->groupBy('supervisors.faculty_id')
            ->selectRaw('supervisors.faculty_id, COUNT(*) as total')
            ->pluck('total', 'supervisors.faculty_id')
            ->map(fn ($total) => (int) $total)
            ->all();
    }

    /** The same shape as describe(), from a load already counted in bulk. */
    public static function describeWithLoad(?string $designation, int $load): array
    {
        $limit = self::limitFor($designation);

        return [
            'limit' => $limit,
            'current' => $load,
            'remaining' => max(0, $limit - $load),
            'is_full' => $load >= $limit,
        ];
    }

    /** What a page needs to show the position without asking three questions. */
    public static function describe(Faculty $faculty): array
    {
        $limit = self::limitFor($faculty->designation);
        $load = self::currentLoad($faculty);

        return [
            'limit' => $limit,
            'current' => $load,
            'remaining' => max(0, $limit - $load),
            'is_full' => $load >= $limit,
        ];
    }
}

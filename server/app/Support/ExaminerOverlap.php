<?php

namespace App\Support;

use App\Models\ExaminersRecommendation;
use App\Models\Student;
use Illuminate\Support\Collection;

/**
 * How much of a proposed examiner list may repeat one a supervisor has already
 * submitted for another scholar.
 *
 * A supervisor who sends the same four names to every thesis is choosing the
 * panel once and reusing it, which is what the limit exists to stop. At most
 * half of a list may be people already proposed on any single earlier list, and
 * national and international are counted separately so filling one from a small
 * pool does not spend the allowance for the other.
 *
 * Compared against each earlier list on its own, never against all of them
 * pooled. Pooled, a supervisor's fourth scholar would have almost no one left to
 * propose, which is a different and much harsher rule than the one intended.
 */
final class ExaminerOverlap
{
    /** The largest share of a proposed list that may repeat one earlier list. */
    public const LIMIT = 0.5;

    /**
     * Earlier lists that this proposal repeats too much of.
     *
     * @param  array<int, string>  $proposedEmails  as typed on the form
     * @return array<int, array{roll_no:int, shared:array<int, string>}>
     */
    public static function breaches(Student $student, string $type, array $proposedEmails): array
    {
        $proposed = self::normalise($proposedEmails);
        if ($proposed === []) {
            return [];
        }

        $earlier = self::earlierLists($student, $type);
        $allowed = (int) floor(count($proposed) * self::LIMIT);

        $breaches = [];

        foreach ($earlier as $rollNo => $emails) {
            $shared = array_values(array_intersect($proposed, $emails));

            if (count($shared) > $allowed) {
                $breaches[] = ['roll_no' => (int) $rollNo, 'shared' => $shared];
            }
        }

        return $breaches;
    }

    /**
     * Every earlier list of this type by one of the scholar's supervisors, as
     * roll number => the addresses on it.
     *
     * Keyed on the recommendation's own `faculty_id`, which records who proposed
     * each name, rather than on the form: a form belongs to a scholar, and what
     * the limit follows is the supervisor.
     *
     * @return array<int|string, array<int, string>>
     */
    private static function earlierLists(Student $student, string $type): array
    {
        $supervisors = $student->supervisors->pluck('faculty_code');
        if ($supervisors->isEmpty()) {
            return [];
        }

        $rows = ExaminersRecommendation::query()
            ->where('type', $type)
            ->whereIn('faculty_id', $supervisors)
            // Someone DoRDC turned down never examined that thesis, so proposing
            // them again is not a repeat of anything.
            ->where(fn ($query) => $query->whereNull('recommendation')->orWhere('recommendation', '!=', 'rejected'))
            ->with(['examiner:id,email', 'listOfExaminers:id,student_id'])
            ->get()
            // The scholar's own form is not an earlier list, and neither is a
            // second form for them, so a resubmission is never blocked by what
            // it is replacing.
            ->filter(fn ($row) => $row->listOfExaminers
                && (int) $row->listOfExaminers->student_id !== (int) $student->roll_no)
            ->filter(fn ($row) => filled($row->examiner?->email));

        return $rows
            ->groupBy(fn ($row) => $row->listOfExaminers->student_id)
            ->map(fn (Collection $group) => array_values(array_unique(
                $group->map(fn ($row) => strtolower(trim($row->examiner->email)))->all()
            )))
            ->all();
    }

    /** @param array<int, string> $emails */
    private static function normalise(array $emails): array
    {
        return array_values(array_unique(array_filter(
            array_map(fn ($email) => strtolower(trim((string) $email)), $emails)
        )));
    }
}

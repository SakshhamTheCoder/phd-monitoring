<?php

namespace App\Support;

use App\Models\AppSetting;
use App\Models\Course;
use App\Models\Student;

/**
 * The credits a scholar must have passed before a synopsis can be raised.
 *
 * The institute sets this by cohort, not by how the scholar studies: which
 * school they are in, and when they were admitted. It was one configurable
 * number per status, which could not express any of that and left a 2019
 * engineering scholar measured against the same figure as a 2025 one.
 *
 * The bands are here because they are the regulation's shape; the figures are
 * in settings, where the office can correct one when the regulation moves,
 * on Configuration, Coursework credits.
 *
 * Where the institute writes a range (14 to 16 credits, 12 to 16 for the
 * executive programme), the lower figure is what is required, because this is
 * the gate: a scholar with 14 has met a 14 to 16 requirement.
 *
 * The institute's other two rules are decided on the qualification a scholar
 * was admitted with, which `students` now records. An executive candidate's
 * credits depend on whether they hold a postgraduate degree and, if not, on
 * their undergraduate percentage; a candidate admitted with a B.E. or B.Tech
 * owes eight masters level courses on top of their credits, which is a count of
 * courses rather than a total, and is answered by mastersCoursesFor().
 */
class CourseworkRequirement
{
    /**
     * The management school. LMTSM alone: DOM and SOM are mathematics, which
     * the first version of this read as the management school's older codes and
     * measured against the wrong figure.
     */
    private const MANAGEMENT = ['LMTSM'];

    private const LIBERAL_ARTS = ['TSLAS', 'SLAS'];

    /** July is when an academic year starts here, so the bands begin there. */
    private const JULY_2020 = '2020-07-01';
    private const JULY_2024 = '2024-07-01';

    /** A scholar with no admission date has no cohort; the middle band is the long-standing figure. */
    private const WITHOUT_AN_ADMISSION_DATE = 'min_credits_july_2020_to_june_2024';

    public static function for(Student $student): int
    {
        if ($student->current_status === 'executive') {
            return self::executive($student);
        }

        $code = strtoupper((string) ($student->department->code ?? ''));
        $admitted = $student->date_of_registration
            ? date('Y-m-d', strtotime((string) $student->date_of_registration))
            : null;

        if (in_array($code, self::LIBERAL_ARTS, true)) {
            return self::credits('min_credits_liberal_arts');
        }

        if ($admitted === null) {
            return self::credits(self::WITHOUT_AN_ADMISSION_DATE);
        }

        if (in_array($code, self::MANAGEMENT, true)) {
            return self::credits($admitted >= self::JULY_2024
                ? 'min_credits_management_from_july_2024'
                : 'min_credits_management_before_july_2024');
        }

        // Engineering, humanities and sciences: everything else.
        if ($admitted >= self::JULY_2024) {
            return self::credits('min_credits_from_july_2024');
        }

        return self::credits($admitted >= self::JULY_2020
            ? 'min_credits_july_2020_to_june_2024'
            : 'min_credits_before_july_2020');
    }

    /**
     * The executive programme, where the school does not matter but the degree
     * the candidate was admitted on does.
     *
     * Everyone owes the UGC figure of 12 to 16 credits. A candidate admitted on
     * a postgraduate degree owes that alone. One admitted on a four year
     * undergraduate degree owes more: twelve further masters level credits at
     * 75 per cent or above, and the 36 credit accelerated masters programme
     * between 60 and 75.
     *
     * A record with no qualification or no percentage on it owes the UGC figure
     * alone. The alternative is to charge somebody for a band nobody has said
     * they are in, and the blank is visible on their profile for the office to
     * fill.
     */
    private static function executive(Student $student): int
    {
        $base = self::credits('min_credits_executive');

        if ($student->highest_qualification !== 'bachelors') {
            return $base;
        }

        $percentage = $student->qualification_percentage;
        if ($percentage === null) {
            return $base;
        }

        if ((float) $percentage >= 75) {
            return $base + self::credits('min_credits_executive_ug_extra');
        }

        if ((float) $percentage >= 60) {
            return $base + self::credits('min_credits_executive_accelerated');
        }

        // Below 60 the institute states no route, so nothing is added to the
        // UGC figure and the admission is the office's to question.
        return $base;
    }

    /**
     * The masters level courses a scholar must pass, as a count rather than a
     * credit total: a candidate admitted with a B.E. or B.Tech owes eight,
     * whether they are full time or part time. An executive candidate is not
     * counted here, because executive() has already charged them for the same
     * rule in credits.
     *
     * Zero until the office has marked some courses as masters level. Nobody
     * can pass a masters level course while no course is one, and a
     * requirement nothing can satisfy would read as a scholar's failure rather
     * than as a column waiting to be filled. Drop the check once the levels are
     * in and the requirement stands on the setting alone.
     */
    public static function mastersCoursesFor(Student $student): int
    {
        if ($student->highest_qualification !== 'bachelors') return 0;
        if (!in_array($student->current_status, ['full-time', 'part-time'], true)) return 0;
        if (!Course::where('level', 'masters')->exists()) return 0;

        return self::credits('min_masters_courses_bachelors_entry');
    }

    private static function credits(string $key): int
    {
        return AppSetting::value('coursework', $key);
    }
}

<?php

namespace App\Support;

use App\Models\AppSetting;
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
 * Two of the institute's rules are not here, because the portal does not hold
 * what they are decided on. Candidates admitted with a B.E. or B.Tech must take
 * eight masters level courses, which is a count of courses and needs the entry
 * qualification. An executive candidate's extra credits depend on whether they
 * hold a PG degree and on their undergraduate percentage. Neither is a column
 * the portal has, so both stay with the office.
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
        // The executive programme is a UGC figure of 12 to 16 credits whatever
        // the school. What a particular executive candidate owes on top of it
        // depends on their degree and percentage, which nobody has recorded.
        if ($student->current_status === 'executive') {
            return self::credits('min_credits_executive');
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

    private static function credits(string $key): int
    {
        return AppSetting::value('coursework', $key);
    }
}

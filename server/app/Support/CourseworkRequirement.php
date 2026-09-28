<?php

namespace App\Support;

use App\Models\Student;

/**
 * The credits a scholar must have passed before a synopsis can be raised.
 *
 * The institute sets this by cohort, not by how the scholar studies: which
 * school they are in, and when they were admitted. It was one configurable
 * number per status, which could not express any of that and left a 2019
 * engineering scholar measured against the same figure as a 2025 one.
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
    /** The management school, under every code the portal has carried for it. */
    private const MANAGEMENT = ['LMTSM', 'DOM', 'SOM', 'SOM (Derabassi)'];

    private const LIBERAL_ARTS = ['TSLAS', 'SLAS'];

    /** July is when an academic year starts here, so the bands begin there. */
    private const JULY_2020 = '2020-07-01';
    private const JULY_2024 = '2024-07-01';

    /** A scholar whose admission date is missing, measured against the long-standing figure. */
    private const WITHOUT_AN_ADMISSION_DATE = 14;

    public static function for(Student $student): int
    {
        // The executive programme is a UGC figure of 12 to 16 credits whatever
        // the school. What a particular executive candidate owes on top of it
        // depends on their degree and percentage, which nobody has recorded.
        if ($student->current_status === 'executive') {
            return 12;
        }

        $code = strtoupper((string) ($student->department->code ?? ''));
        $admitted = $student->date_of_registration
            ? date('Y-m-d', strtotime((string) $student->date_of_registration))
            : null;

        if (in_array($code, self::LIBERAL_ARTS, true)) {
            return 45;
        }

        if ($admitted === null) {
            return self::WITHOUT_AN_ADMISSION_DATE;
        }

        if (in_array($code, self::MANAGEMENT, true)) {
            return $admitted >= self::JULY_2024 ? 36 : 48;
        }

        // Engineering, humanities and sciences: everything else.
        if ($admitted >= self::JULY_2024) {
            return 36;
        }

        return $admitted >= self::JULY_2020 ? 14 : 11;
    }
}

<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * The Institute's thesis submission window, counted from the date of admission.
 *
 * One place decides the window so no screen, guard or notification can disagree
 * about a student's dates. The year counts come from the 'thesis' settings
 * group; only who they apply to is written here: female and physically
 * handicapped students get the longer base period, everyone else the shorter
 * one. Granted extensions push the deadline out from there, and how many a
 * student may be granted is capped by the form itself, not by this class.
 */
final class ThesisDeadline
{
    public static function earliest(string $dateOfRegistration, int $minYears): string
    {
        return CarbonImmutable::parse($dateOfRegistration)->addYears($minYears)->toDateString();
    }

    /**
     * The base deadline pushed out by whatever extensions have been granted.
     * Extensions are recorded in months, so they are added as months.
     */
    public static function latest(string $dateOfRegistration, int $baseYears, int $grantedMonths = 0): string
    {
        return CarbonImmutable::parse($dateOfRegistration)
            ->addYears($baseYears)
            ->addMonths($grantedMonths)
            ->toDateString();
    }

    /** Which base applies. Gender is only consulted when the PH flag is off. */
    public static function baseYearsFor(?string $gender, bool $physicallyHandicapped, int $maleYears, int $femaleOrPhYears): int
    {
        return ($physicallyHandicapped || $gender === 'Female') ? $femaleOrPhYears : $maleYears;
    }

    /** Whole days from $today to $deadline. Negative once the deadline has passed. */
    public static function daysRemaining(string $deadline, string $today): int
    {
        return (int) CarbonImmutable::parse($today)->diffInDays(CarbonImmutable::parse($deadline), false);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A UG student's own details, asked for once at sign-up. */
class UgStudent extends Model
{
    /**
     * An institute address carries the programme and the year of admission:
     * sbhagat_be23@thapar.edu, or btech23 for the other spelling. That is what
     * marks the holder as an undergraduate, so it is who sign-up is open to,
     * and the two digits say when they started. A scholar or a member of staff
     * has no such address and is given an account by the office as before.
     */
    private const ELIGIBLE_EMAIL = '/(?:^|[^a-z])(?:be|btech)(\d{2})@thapar\.edu$/i';

    protected $fillable = ['roll_no', 'branch_id', 'admission_year', 'year'];

    /** Worked out rather than stored, so they are right in every session. */
    protected $appends = ['year_of_study', 'semester_of_study'];

    public static function eligibleEmail(?string $email): bool
    {
        return self::admissionYearFrom($email) !== null;
    }

    /** The year the address says they were admitted: be23 is 2023. */
    public static function admissionYearFrom(?string $email): ?int
    {
        return preg_match(self::ELIGIBLE_EMAIL, (string) $email, $matches)
            ? 2000 + (int) $matches[1]
            : null;
    }

    /**
     * Which year of the degree they are in now: what they corrected it to if
     * they did, otherwise counted from the year they were admitted.
     */
    public function getYearOfStudyAttribute(): ?int
    {
        if ($this->year) {
            return $this->year;
        }

        return $this->admission_year ? Semester::yearOfStudy($this->admission_year) : null;
    }

    /** Which semester of the degree that year is in, 1 to 8. */
    public function getSemesterOfStudyAttribute(): ?int
    {
        $year = $this->year_of_study;

        return $year ? ($year - 1) * 2 + Semester::currentTerm()['semester'] : null;
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function branch()
    {
        return $this->belongsTo(UgBranch::class, 'branch_id');
    }
}

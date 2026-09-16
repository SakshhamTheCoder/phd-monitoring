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
    private const ELIGIBLE_EMAIL = '/(?:^|[^a-z])(?:be|btech)\d{2}@thapar\.edu$/i';

    protected $fillable = ['roll_no', 'branch_id', 'year'];

    /** The one thing that follows from the year, so it is not stored twice. */
    protected $appends = ['semester_of_study'];

    public static function eligibleEmail(?string $email): bool
    {
        return (bool) preg_match(self::ELIGIBLE_EMAIL, (string) $email);
    }

    /**
     * Which semester of the degree they are in: their year, and whether the
     * term running now is the odd or the even one. A third year in an odd term
     * is in the fifth semester, and in the even one the sixth.
     */
    public function getSemesterOfStudyAttribute(): ?int
    {
        return $this->year ? ($this->year - 1) * 2 + Semester::currentTerm()['semester'] : null;
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

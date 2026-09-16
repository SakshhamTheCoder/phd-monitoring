<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A UG student's own details, asked for once at sign-up. */
class UgStudent extends Model
{
    /**
     * An institute address carries the programme and the year of admission:
     * sbhagat_be23@thapar.edu, or btech23 for the other spelling. That is what
     * marks the holder as an undergraduate, so it is who sign-up is open to.
     * A scholar or a member of staff has no such address and is given an
     * account by the office as before.
     */
    private const ELIGIBLE_EMAIL = '/(?:^|[^a-z])(?:be|btech)\d{2}@thapar\.edu$/i';

    protected $fillable = ['roll_no', 'department_id', 'year'];

    public static function eligibleEmail(?string $email): bool
    {
        return (bool) preg_match(self::ELIGIBLE_EMAIL, (string) $email);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UgStudent extends Model
{
    /**
     * An institute address carries the programme and the year of admission, as
     * in sbhagat_be23@thapar.edu. That is what marks the holder as an
     * undergraduate, so it is who sign-up is open to.
     */
    private const ELIGIBLE_EMAIL = '/(?:^|[^a-z])(?:be|btech)\d{2}@thapar\.edu$/i';

    protected $fillable = ['roll_no', 'branch_id', 'year'];

    protected $appends = ['semester_of_study'];

    public static function eligibleEmail(?string $email): bool
    {
        return (bool) preg_match(self::ELIGIBLE_EMAIL, (string) $email);
    }

    /**
     * The account behind a UG student, however it was made: signed up with a
     * password, vouched for by Google, or created by the office. Without a
     * password it gets one nobody knows and password_set_at stays null, so Set
     * Password asks for no current one.
     */
    public static function registerAccount(array $account, ?string $password = null, bool $verified = false): User
    {
        $role = Role::where('role', 'ug_student')->firstOrFail();

        $user = new User();
        $user->first_name = $account['first_name'];
        $user->last_name = $account['last_name'] ?? '';
        $user->email = $account['email'];
        $user->phone = $account['phone'] ?? null;
        $user->gender = $account['gender'] ?? null;
        $user->password = Hash::make($password ?? Str::random(40));
        $user->password_set_at = $password ? now() : null;
        $user->email_verified_at = $verified ? now() : null;
        $user->role_id = $role->id;
        $user->current_role_id = $role->id;
        $user->default_role_id = $role->id;
        $user->save();

        return $user;
    }

    /** Their year, plus whether the term running now is the odd or the even one. */
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

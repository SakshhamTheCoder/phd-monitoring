<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UrfApplication extends Model
{
    // An application is decided once: selected or rejected.
    public const STATUSES = ['applied', 'selected', 'rejected'];

    protected $fillable = [
        'project_title',
        'student1_name', 'student1_roll_no', 'student1_department_id', 'student1_year', 'student1_gender', 'student1_email', 'student1_phone',
        'student2_name', 'student2_roll_no', 'student2_department_id', 'student2_year', 'student2_gender', 'student2_email', 'student2_phone',
        'mentor1_faculty_code', 'mentor2_faculty_code',
    ];

    /** "3rd Year" for 3, or null when no year was given. */
    public static function yearLabel(?int $year): ?string
    {
        return $year ? $year . (['', 'st', 'nd', 'rd'][$year] ?? 'th') . ' Year' : null;
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function student1Department()
    {
        return $this->belongsTo(Department::class, 'student1_department_id');
    }

    public function student2Department()
    {
        return $this->belongsTo(Department::class, 'student2_department_id');
    }

    public function mentor1()
    {
        return $this->belongsTo(Faculty::class, 'mentor1_faculty_code', 'faculty_code');
    }

    public function mentor2()
    {
        return $this->belongsTo(Faculty::class, 'mentor2_faculty_code', 'faculty_code');
    }

    public function fellows()
    {
        return $this->hasMany(UrfFellow::class);
    }

    public function reports()
    {
        return $this->hasMany(UrfReport::class);
    }

    /**
     * The latest project a UG student is on, whether they filled the
     * application in or were named on it as the second student.
     */
    public static function forUser(User $user): ?self
    {
        return static::forMember($user)->latest('id')->first();
    }

    /**
     * Projects the user is on, as the student who applied or the second student.
     * Grouped, so a further where() narrows the members rather than widening them.
     */
    public function scopeForMember($query, User $user)
    {
        return $query->where(fn ($q) => $q->where('user_id', $user->id)->orWhere('student2_email', $user->email));
    }

    /** 2 when the user is the application's second student, 1 otherwise. */
    public function slotOf(User $user): int
    {
        return strcasecmp((string) $this->student2_email, $user->email) === 0 ? 2 : 1;
    }

    public function hasMember(User $user): bool
    {
        return $this->user_id === $user->id
            || strcasecmp((string) $this->student2_email, $user->email) === 0;
    }
}

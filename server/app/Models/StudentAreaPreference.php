<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * The three areas a scholar would like to work in, chosen on the supervisor
 * allocation form.
 *
 * These are preferences, not a settled research area: they exist to rank
 * faculty before a supervisor is assigned. The settled one is
 * `students.area_of_specialization_id`, written later from the IRB form.
 */
class StudentAreaPreference extends Model
{
    use HasFactory;

    protected $table = 'student_area_preferences';

    protected $fillable = [
        'student_id',
        'specialization_id',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'roll_no');
    }

    public function specialization()
    {
        return $this->belongsTo(AreaOfSpecialization::class, 'specialization_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * The areas a scholar says they would like to work in, from the supervisor
 * allocation form.
 *
 * Free text on purpose. This is written before a supervisor exists, when the
 * scholar is describing what they hope to pursue rather than choosing from
 * anything settled, and the only thing that reads it is the faculty
 * recommender, which matches words against a supervisor's expertise.
 *
 * It is deliberately not a link into `area_of_specializations`. That list is
 * what a department offers, and a scholar's hopes are not a statement about
 * that. The settled area, chosen from the list once the research is defined,
 * is `students.area_of_specialization_id`.
 */
class StudentAreaPreference extends Model
{
    use HasFactory;

    protected $table = 'student_area_preferences';

    protected $fillable = [
        'student_id',
        'broad_area',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'roll_no');
    }
}

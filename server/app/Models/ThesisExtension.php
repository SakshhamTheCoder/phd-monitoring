<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ThesisExtension extends Model
{
    use HasFactory;

    protected $table = 'thesis_extentions';

    protected $fillable = [
        'student_id',
        'period_of_extention',
        'reason',
        'form_id',
    ];

    // period_of_extention is a whole number of months, not a date.
    protected $casts = [
        'period_of_extention' => 'integer',
    ];

    /**
     * Define the relationship with the Student model.
     */
    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'roll_no');
    }
}

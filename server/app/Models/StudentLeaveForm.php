<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentLeaveForm extends Model
{
    use HasFactory;

    protected $table = 'student_leave_forms';

    protected $fillable = [
        'student_id', 'leave_type', 'from_date', 'to_date', 'day_part',
        'reason', 'supporting_document', 'status', 'stage', 'steps',
        'current_step', 'maximum_step', 'history',
        'student_comments', 'hod_comments', 'hod_approval',
        'student_lock', 'hod_lock',
    ];

    protected $casts = [
        'from_date' => 'date',
        'to_date' => 'date',
        'steps' => 'array',
        'history' => 'array',
        'hod_approval' => 'boolean',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'roll_no');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    /** A half-day still excuses the whole day; it only changes what it costs. */
    public function isHalfDay(): bool
    {
        return in_array($this->day_part, ['first_half', 'second_half'], true);
    }
}

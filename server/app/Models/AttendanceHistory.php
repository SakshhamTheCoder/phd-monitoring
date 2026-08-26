<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AttendanceHistory extends Model
{
    use HasFactory;

    protected $table = 'attendance_history';

    protected $fillable = [
        'attendance_id',
        'roll_no',
        'date',
        'lecture_id',
        'old_status',
        'new_status',
        'changed_by',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function attendance()
    {
        return $this->belongsTo(Attendance::class);
    }

    public function changedBy()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentStatusChange extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'student_id',
        'previous_status',
        'new_status',
        // Student::initialStatus() reads this; without it every change was
        // stored with a null type and read back as part-time.
        'type_of_change',
        'reason',
        'status',
        'date',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array
     */
    protected $casts = [
        'date' => 'date',
    ];

    /**
     * The attributes that should be hidden for arrays.
     *
     * @var array
     */
    protected $hidden = [
        'created_at',
        'updated_at',
    ];

    /**
     * Get the student associated with the status change.
     */
    public function student()
    {
        return $this->belongsTo(Student::class);
    }
}

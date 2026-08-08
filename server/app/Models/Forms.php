<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Forms extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'student_id',
        'form_type',
        'form_name',
        'department_id',
        'student_available',
        'supervisor_available',
        'hod_available',
        'phd_coordinator_available',
        'dordc_available',
        'dra_available',
        'director_available',
        'doctoral_available',
        'stage',
        'count',
        'max_count',
    ];

    /**
     * Get the student associated with the form.
     */
    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'roll_no');
    }

    /**
     * Get the department associated with the form.
     */
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /**
     * Scope a query to filter forms based on type.
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('form_type', $type);
    }

    /**
     * Scope a query to filter forms by student availability.
     */
    public function scopeStudentAvailable($query)
    {
        return $query->where('student_available', true);
    }

    /**
     * Scope a query to filter forms by supervisor availability.
     */
    public function scopeSupervisorAvailable($query)
    {
        return $query->where('supervisor_available', true);
    }

    /**
     * Step lists use the 'faculty' role name, but the stage enum uses 'supervisor'.
     * Normalize on write so 'faculty' can never reach the stage column.
     */
    public function setStageAttribute($value)
    {
        $this->attributes['stage'] = $value === 'faculty' ? 'supervisor' : $value;
    }

}

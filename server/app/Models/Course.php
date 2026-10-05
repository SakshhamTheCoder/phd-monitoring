<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    protected $table = 'courses';
    
    protected $fillable = [
        'course_code',
        'course_name',
        'credits',
        'level',
        'department_id',
    ];

    protected $casts = [
        'credits' => 'float',
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function studentCourses()
    {
        return $this->hasMany(StudentCourse::class, 'course_id');
    }

    public function students()
    {
        return $this->belongsToMany(Student::class, 'student_courses', 'course_id', 'student_id', 'id', 'roll_no')
            ->withPivot('status', 'semester', 'grade', 'created_at', 'updated_at');
    }
}

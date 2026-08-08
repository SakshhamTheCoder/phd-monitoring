<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;


class Department extends Model
{
    use HasFactory;
    protected $table = 'departments';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'name',
        'code',
        'hod_id',
        'hod_email',
        'adordc_id',
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
     * Get the head of department associated with the department.
     */
    public function hod()
    {
        return $this->belongsTo(Faculty::class, 'hod_id', 'faculty_code');
    }
    
    public function adordc()
    {
        return $this->belongsTo(Faculty::class, 'adordc_id', 'faculty_code');
    }
    /**
     * Get the students associated with the department.
     */
    public function students()
    {
        return $this->hasMany(Student::class);
    }

    public function phdCoordinators()
    {
        return $this->hasMany(PhdCoordinator::class, 'department_id');
    }

    public function broadAreaSpecializations()
    {
        return $this->hasMany(BroadAreaSpecialization::class);
    }

    public function checkCoordinates($facultyId)
    {
        return $this->phdCoordinators()->where('faculty_id', $facultyId)->exists();
    }
    
}

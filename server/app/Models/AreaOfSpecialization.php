<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One broad research area belonging to one department.
 *
 * This is the portal's only list of areas. Scholars pick up to three of them as
 * preferences on the supervisor allocation form and one as their settled area on
 * the IRB form; faculty pick one as their broad area. Nothing but the admin page
 * and the research area import adds a name, which is what keeps the list a fixed
 * per-department vocabulary rather than whatever anyone last typed into a form.
 */
class AreaOfSpecialization extends Model
{
    protected $fillable = [
        'department_id',
        'name',
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function students()
    {
        return $this->hasMany(Student::class, 'area_of_specialization_id');
    }

    public function faculty()
    {
        return $this->hasMany(Faculty::class, 'area_of_specialization_id');
    }

}

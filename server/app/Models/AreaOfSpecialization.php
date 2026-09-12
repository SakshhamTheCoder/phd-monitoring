<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One broad research area belonging to one department.
 *
 * It exists for one job: the broad area a faculty member is listed under, which
 * the institute's matrix sheet supplies as a fixed 10 to 13 per department.
 *
 * Scholars are not restricted to it. What a scholar types on the allocation and
 * IRB forms is a description of what they want to work on, so those are their
 * own words and this list is only offered to them as suggestions.
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

    public function faculty()
    {
        return $this->hasMany(Faculty::class, 'area_of_specialization_id');
    }

}

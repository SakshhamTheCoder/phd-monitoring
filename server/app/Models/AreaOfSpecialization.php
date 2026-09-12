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
        'outside_expert_id',
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

    /**
     * The external examiner the DoRDC adds to a doctoral committee when an IRB
     * in this area is approved.
     */
    public function outsideExpert()
    {
        return $this->belongsTo(OutsideExpert::class, 'outside_expert_id');
    }

    /**
     * The expert's faculty record, created on first use.
     *
     * The expert used to be six columns on this row, with their own account
     * creation that disagreed with the one on OutsideExpert about both the role
     * and the password. There is one expert table now, so there is one way to
     * turn an expert into a faculty record.
     */
    public function getExpertFaculty()
    {
        return $this->outsideExpert?->getFaculty();
    }
}

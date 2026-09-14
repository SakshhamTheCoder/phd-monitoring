<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    use HasFactory;
    protected $table = 'roles';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'role',
        'can_read_all_students',
        'can_read_all_faculties',
        'can_read_supervised_students',
        'can_read_department_students',
        'can_read_department_faculties',
        'can_manage_faculties',
        'can_manage_students',
        'can_edit_doctoral_committee',
        'can_delete_faculties',
        'can_delete_students',
        'can_edit_department',
        'can_add_department',
        'can_read_external',
        'can_edit_external',
        // Everything below was added after this table's original 28 columns.
        // Listed here in the order their migrations introduced them, so a mass
        // assignment through this model no longer silently drops them.
        'can_read_committee_students',
        'can_manage_users',
        'can_manage_form_levels',
        'can_manage_supervisor_records',
        'can_manage_clerks',
        'can_mark_attendance',
        'can_read_own_clerk_departments',
        'can_read_leave_reason',
        'can_manage_app_settings',
        'can_read_leave_settings',
        'can_resend_external_review',
        'can_propose_supervisor_changes',
        'can_manage_supervisor_changes',
        'can_manage_projects',
        'can_manage_all_projects',
        'can_manage_own_publications',
        'can_edit_own_student_profile',
        'can_read_own_leave_balance',
        'can_apply_for_leave',
        'can_suggest_examiners',
        'can_read_faculty_directory',
        'can_read_faculty_supervision',
        'can_read_faculty_phone',
        'can_manage_courses',
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

    public function setAllTrue()
    {
        $attributes = $this->getFillable();

        // Exclude the 'role' attribute
        $attributes = array_diff($attributes, ['role']);

        // Set all other attributes to true
        foreach ($attributes as $attribute) {
            $this->{$attribute} = true;
        }
    }
    /**
     * Override the save method to lowercase the role attribute.
     *
     * @param  array  $options
     * @return bool
     */
    public function save(array $options = [])
    {
        $this->role = strtolower($this->role);
        return parent::save($options);
    }

    /**
     * Override the update method to lowercase the role attribute.
     *
     * @param  array  $attributes
     * @param  array  $options
     * @return bool
     */
    public function update(array $attributes = [], array $options = [])
    {
        if (isset($attributes['role'])) {
            $attributes['role'] = strtolower($attributes['role']);
        }
        return parent::update($attributes, $options);
    }
}

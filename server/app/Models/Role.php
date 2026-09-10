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
        'can_edit_all_students',
        'can_edit_all_faculties',
        'can_edit_department_students',
        'can_edit_department_faculties',
        'can_edit_own_profile',
        'can_edit_phd_title',
        'can_add_department_students',
        'can_add_department_faculties',
        'can_manage_faculties',
        'can_manage_students',
        'can_read_supervisors',
        'can_read_doctoral_committee',
        'can_edit_supervisors',
        'can_edit_doctoral_committee',
        'can_delete_department_students',
        'can_delete_department_faculties',
        'can_delete_faculties',
        'can_delete_students',
        'can_manage_roles',
        'can_edit_department',
        'can_add_department',
        'can_read_external',
        'can_edit_external',
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

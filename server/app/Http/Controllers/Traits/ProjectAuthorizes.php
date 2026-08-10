<?php
namespace App\Http\Controllers\Traits;

trait ProjectAuthorizes {
    protected $privileged = ['dordc','adordc','dra','director','admin'];

    protected function canManage($user) {
        $role = optional($user->current_role)->role;
        return in_array($role, array_merge(['faculty','hod','phd_coordinator'], $this->privileged));
    }

    /** Write access: the PI, or an institute-wide role. */
    protected function owns($user, $project) {
        $role = optional($user->current_role)->role;
        if (in_array($role, $this->privileged)) return true;
        $code = optional($user->faculty)->faculty_code;
        return $code !== null && $code == $project->pi_faculty_code;
    }

    /**
     * The department a role answers for, or null if it answers for none. A HOD
     * and a coordinator have to be able to say what research runs in their
     * department, so they read all of it. They still only write their own.
     */
    protected function departmentScope($user) {
        $role = optional($user->current_role)->role;
        if (!in_array($role, ['hod', 'phd_coordinator'])) return null;
        return optional($user->faculty)->department_id;
    }

    /** Read access: anyone who may write, an internal Co-PI, or the department. */
    protected function canView($user, $project) {
        if ($this->owns($user, $project)) return true;
        $code = optional($user->faculty)->faculty_code;
        if ($code !== null && $project->coPiFaculty()->where('faculty.faculty_code', $code)->exists()) return true;
        $department = $this->departmentScope($user);
        return $department !== null && optional($project->pi)->department_id == $department;
    }
}

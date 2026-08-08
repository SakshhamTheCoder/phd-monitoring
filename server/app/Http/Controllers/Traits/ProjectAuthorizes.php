<?php
namespace App\Http\Controllers\Traits;

trait ProjectAuthorizes {
    protected $privileged = ['dordc','adordc','dra','director','admin'];

    protected function canManage($user) {
        $role = optional($user->current_role)->role;
        return in_array($role, array_merge(['faculty','hod','phd_coordinator'], $this->privileged));
    }
    protected function owns($user, $project) {
        $role = optional($user->current_role)->role;
        if (in_array($role, $this->privileged)) return true;
        $code = optional($user->faculty)->faculty_code;
        return $code !== null && $code == $project->pi_faculty_code;
    }
}

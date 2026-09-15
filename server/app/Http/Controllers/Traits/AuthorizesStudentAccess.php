<?php

namespace App\Http\Controllers\Traits;

use App\Models\Student;
use Illuminate\Support\Facades\Auth;

// Must mirror StudentController::get's scoping, or student data visibility drifts between endpoints.
trait AuthorizesStudentAccess
{
    private function canViewStudent(Student $student): bool
    {
        $user = Auth::user();

        if ($user->may('can_read_all_students')) {
            return true;
        }

        if ($user->may('can_read_department_students')) {
            $departmentIds = $user->current_role->role === 'adordc'
                ? $user->faculty->adordcDepartments->pluck('id')->all()
                : [$user->faculty->department_id];
            return in_array($student->department_id, $departmentIds, true);
        }

        if ($user->may('can_read_supervised_students') || $user->may('can_read_committee_students')) {
            $code = $user->faculty?->faculty_code;
            return $code && ($student->checkSupervises($code) || $student->checkDoctoralCommittee($code));
        }

        return false;
    }
}

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Student;
use App\Models\Faculty;

class HomeController extends Controller
{
    public function getHomeData(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role->role;

        if ($role === 'student') {
            $student = Student::with(['user', 'department', 'supervisors.user', 'doctoralCommittee.user'])
                ->where('user_id', $user->id)
                ->first();

            if (!$student) {
                return response()->json(['message' => 'Student record not found'], 404);
            }

            return response()->json([
                'type' => 'student',
                'data' => [
                    'name' => $student->user->name(),
                    'phd_title' => $student->phd_title,
                    'overall_progress' => $student->overall_progress,
                    'roll_no' => $student->roll_no,
                    'department' => $student->department->name,
                    'supervisors' => $student->supervisors->map(fn($s) => $s->user->name()),
                    'cgpa' => $student->cgpa,
                    'email' => $student->user->email,
                    'phone' => $student->user->phone,
                    'current_status' => $student->current_status,
                    'fathers_name' => $student->fathers_name,
                    'address' => $student->address,
                    'date_of_registration' => $student->date_of_registration,
                    'date_of_irb' => $student->date_of_irb,
                    'date_of_synopsis' => $student->date_of_synopsis,
                    'doctoral' => $student->doctoralCommittee->map(function ($faculty) {
                        return [
                            'faculty_code' => $faculty->faculty_code,
                            'designation' => $faculty->designation,
                            'name' => $faculty->user->name(),
                            'email' => $faculty->user->email,
                            'phone' => $faculty->user->phone,
                        ];
                    }),
                ],
            ]);
        }

        // For faculty and others
        $faculty = $user->faculty;

        // Office/admin roles (admin, dra, director, …) often have no faculty record.
        // Instead of 404-ing (which the client shows as an error + endless loader),
        // return a generic home so they land on an admin overview.
        if (!$faculty) {
            return response()->json([
                'type' => 'admin',
                'data' => [
                    'name' => $user->name(),
                    'email' => $user->email,
                    'role' => $role,
                ],
            ]);
        }

        $supervised = $faculty->supervisedStudents()->with('user')->get()->map(function ($student) {
            return [
                'name' => $student->user->name(),
                'roll_no' => $student->roll_no,
                'email' => $student->user->email,
                'phone' => $student->user->phone,
                'overall_progress' => $student->overall_progress,
            ];
        });

        $doctoral = $faculty->doctoredStudents()->with('user')->get()->map(function ($student) {
            return [
                'name' => $student->user->name(),
                'roll_no' => $student->roll_no,
                'email' => $student->user->email,
                'phone' => $student->user->phone,
                'overall_progress' => $student->overall_progress,
            ];
        });

        return response()->json([
            'type' => 'faculty',
            'data' => [
                'faculty_name' => $user->first_name,
                'faculty_code' => $faculty->faculty_code,
                'designation' => $faculty->designation,
                'email' => $user->email,
                'phone' => $user->phone,
                'supervised_students' => $supervised,
                'doctoral_committee_students' => $doctoral,
                'department' => $faculty->department->name,
                'supervised_outside' => $faculty->supervised_outside,
                'supervised_campus' => $faculty->supervised_campus,
            ]
        ]);
    }
}

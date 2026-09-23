<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\PagenationTrait;
use App\Models\Course;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class CourseController extends Controller
{
    use FilterLogicTrait, PagenationTrait;

    public function listFilters(Request $request)
    {
        return response()->json($this->getAvailableFilters("courses"));
    }

    /**
     * List all courses with pagination and filters (Admin view)
     */
    public function list(Request $request)
    {
        try {
            $loggedInUser = Auth::user();
            $role = $loggedInUser->current_role->role;
            
            $filtersJson = $request->query('filters');
            $filters = $filtersJson ? json_decode(urldecode($filtersJson), true) : $request->input('filters', []);
            
            $perPage = $request->input('rows', 15);
            $page = $request->input('page', 1);

            $query = Course::with('department');

            // A head or coordinator sees their own department's courses only,
            // and none when the account is not attached to a department.
            $scope = $this->departmentScope();
            if ($scope !== null) {
                $query->where('department_id', $scope);
            }

            // Apply dynamic filters
            if ($filters) {
                $query = $this->applyDynamicFilters($query, $filters, 'courses');
            }

            $courses = $query->paginate($perPage, ['*'], 'page', $page);

            $result = $courses->getCollection()->map(function ($course) {
                return [
                    'id' => $course->id,
                    'course_code' => $course->course_code,
                    'course_name' => $course->course_name,
                    'credits' => $course->credits,
                    'department_id' => $course->department_id,
                    'department_name' => $course->department->name ?? 'N/A',
                    'enrolled_count' => $course->studentCourses()->where('status', 'enrolled')->count(),
                    'created_at' => $course->created_at,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $result,
                'total' => $courses->total(),
                'per_page' => $courses->perPage(),
                'current_page' => $courses->currentPage(),
                'totalPages' => $courses->lastPage(),
                'role' => $role,
                'fields' => ['course_code', 'course_name', 'credits', 'department_name', 'enrolled_count'],
                'fieldsTitles' => ['Course Code', 'Course Name', 'Credits', 'Department', 'Enrolled Students'],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error listing courses: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    // Mirrors ACCESS.courseManagement on the client. add, update, delete and
    // import carried no check, so any signed-in account could change courses.
    private const COURSE_MANAGERS = ['admin', 'hod', 'phd_coordinator'];

    private function managesCourses(): bool
    {
        return in_array(Auth::user()?->current_role?->role, self::COURSE_MANAGERS, true);
    }

    /**
     * The one department a head or coordinator manages courses for, matching
     * what list() shows them. Null for admin, who manages every department;
     * 0 when the account is not attached to a department at all.
     */
    private function departmentScope(): ?int
    {
        $user = Auth::user();
        $role = $user->current_role->role;
        if (!in_array($role, ['hod', 'phd_coordinator'], true)) {
            return null;
        }
        // where('hod_id', null) matches a department with no head at all.
        $facultyCode = $user->faculty?->faculty_code;
        if (!$facultyCode) {
            return 0;
        }

        return match ($role) {
            'hod' => (int) Department::where('hod_id', $facultyCode)->value('id'),
            'phd_coordinator' => (int) \App\Models\PhdCoordinator::where('faculty_id', $facultyCode)->value('department_id'),
            default => null,
        };
    }

    /**
     * Add new course
     */

    public function add(Request $request)
    {
        if (!$this->managesCourses()) {
            return $this->refuse();
        }
        $scope = $this->departmentScope();
        if ($scope === 0) {
            return $this->refuse('You are not attached to a department.');
        }
        if ($scope) {
            $request->merge(['department_id' => $scope]);
        }
        try {
            $loggedInUser = Auth::user();
            
            $request->validate([
                'course_code' => 'required|string|unique:courses,course_code',
                'course_name' => 'required|string',
                'credits' => 'required|numeric|min:0',
                'department_id' => 'required|integer|exists:departments,id',
            ]);

            $course = new Course();
            $course->course_code = $request->course_code;
            $course->course_name = $request->course_name;
            $course->credits = $request->credits;
            $course->department_id = $request->department_id;
            $course->save();

            return response()->json([
                'success' => true,
                'message' => 'Course added successfully',
                'data' => $course
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error adding course: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update course
     */
    public function update(Request $request, $id)
    {
        if (!$this->managesCourses()) {
            return $this->refuse();
        }
        $scope = $this->departmentScope();
        if ($scope === 0) {
            return $this->refuse('You are not attached to a department.');
        }
        if ($scope) {
            $request->merge(['department_id' => $scope]);
        }
        try {
            $request->validate([
                'course_code' => 'required|string|unique:courses,course_code,' . $id,
                'course_name' => 'required|string',
                'credits' => 'required|numeric|min:0',
                'department_id' => 'required|integer|exists:departments,id',
            ]);

            $course = Course::find($id);
            if (!$course) {
                return response()->json([
                    'message' => 'Course not found'
                ], 404);
            }

            if ($scope && (int) $course->department_id !== $scope) {
                return $this->refuse('This course belongs to another department.');
            }

            $course->course_code = $request->course_code;
            $course->course_name = $request->course_name;
            $course->credits = $request->credits;
            $course->department_id = $request->department_id;
            $course->save();

            return response()->json([
                'success' => true,
                'message' => 'Course updated successfully',
                'data' => $course
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error updating course: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete course
     */
    public function delete($id)
    {
        if (!$this->managesCourses()) {
            return $this->refuse();
        }
        try {
            $course = Course::find($id);
            if (!$course) {
                return response()->json([
                    'message' => 'Course not found'
                ], 404);
            }

            $scope = $this->departmentScope();
            if ($scope !== null && (int) $course->department_id !== $scope) {
                return $this->refuse('This course belongs to another department.');
            }

            // Check if any students are enrolled
            $enrolledCount = $course->studentCourses()->count();
            if ($enrolledCount > 0) {
                return response()->json([
                    'message' => 'Cannot delete course with enrolled students'
                ], 400);
            }

            $course->delete();

            return response()->json([
                'success' => true,
                'message' => 'Course deleted successfully'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error deleting course: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all courses for dropdown (no pagination)
     */
    public function getAllCourses(Request $request)
    {
        try {
            $departmentId = $request->query('department_id');
            
            $query = Course::with('department');

            // The same courses list() shows, so a head or coordinator only
            // offers their own department's courses when tagging a scholar.
            $scope = $this->departmentScope();
            if ($scope !== null) {
                $query->where('department_id', $scope);
            }
            
            if ($departmentId) {
                $query->where('department_id', $departmentId);
            }
            
            $courses = $query->orderBy('course_name')->get();

            return response()->json([
                'success' => true,
                'data' => $courses
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Import courses from CSV
     */
    public function importCoursesFromCSV(Request $request)
    {
        if (!$this->managesCourses()) {
            return $this->refuse();
        }
        $scope = $this->departmentScope();
        if ($scope === 0) {
            return $this->refuse('You are not attached to a department.');
        }
        try {
            $request->validate([
                'csv_file' => 'required|file|mimes:csv,txt',
            ]);

            $file = $request->file('csv_file');
            $csvData = array_map('str_getcsv', file($file->getRealPath()));
            $header = array_shift($csvData);

            // Expected columns: course_code, course_name, credits, department_id
            $errors = [];
            $imported = 0;

            foreach ($csvData as $index => $row) {
                try {
                    if (count($row) < 4) {
                        $errors[] = "Row " . ($index + 2) . ": Insufficient columns";
                        continue;
                    }

                    $course = new Course();
                    $course->course_code = trim($row[0]);
                    $course->course_name = trim($row[1]);
                    $course->credits = floatval(trim($row[2]));
                    $course->department_id = $scope ?: intval(trim($row[3]));
                    $course->save();
                    $imported++;
                } catch (\Exception $e) {
                    $errors[] = "Row " . ($index + 2) . ": " . $e->getMessage();
                }
            }

            return response()->json([
                'success' => true,
                'message' => "$imported courses imported successfully",
                'imported_count' => $imported,
                'errors' => $errors
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error importing courses: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }
}

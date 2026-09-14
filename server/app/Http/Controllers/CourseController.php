<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\AuthorizesCapability;
use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\PagenationTrait;
use App\Models\Course;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * add, update, delete and importCoursesFromCSV are gated on can_manage_courses:
 * before this, any signed-in user, a student included, could rewrite or delete
 * any course in the catalog. list, listFilters and getAllCourses stay open:
 * they are catalog data used by student-facing screens.
 */
class CourseController extends Controller
{
    use FilterLogicTrait, PagenationTrait, AuthorizesCapability;

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

            // Apply role-based filtering
            if ($role === 'hod') {
                $facultyCode = $loggedInUser->faculty->faculty_code;
                $hodDepartment = Department::where('hod_id', $facultyCode)->first();
                if ($hodDepartment) {
                    $query->where('department_id', $hodDepartment->id);
                }
            } elseif ($role === 'phd_coordinator') {
                $facultyCode = $loggedInUser->faculty->faculty_code;
                $coordinator = \App\Models\PhdCoordinator::where('faculty_id', $facultyCode)->first();
                if ($coordinator) {
                    $query->where('department_id', $coordinator->department_id);
                }
            }

            // Apply dynamic filters
            if ($filters) {
                $query = $this->applyDynamicFilters($query, $filters);
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

    /**
     * Add new course
     */
    public function add(Request $request)
    {
        try {
            if ($denied = $this->denyUnlessMay('can_manage_courses', 'You do not have permission to manage courses. Contact your administrator if you believe this is a mistake.')) return $denied;

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
        try {
            if ($denied = $this->denyUnlessMay('can_manage_courses', 'You do not have permission to manage courses. Contact your administrator if you believe this is a mistake.')) return $denied;

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
        try {
            if ($denied = $this->denyUnlessMay('can_manage_courses', 'You do not have permission to manage courses. Contact your administrator if you believe this is a mistake.')) return $denied;

            $course = Course::find($id);
            if (!$course) {
                return response()->json([
                    'message' => 'Course not found'
                ], 404);
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
        try {
            if ($denied = $this->denyUnlessMay('can_manage_courses', 'You do not have permission to manage courses. Contact your administrator if you believe this is a mistake.')) return $denied;

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
                    $course->department_id = intval(trim($row[3]));
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

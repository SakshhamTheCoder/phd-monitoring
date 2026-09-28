<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\PagenationTrait;
use App\Models\Course;
use App\Models\Department;
use App\Support\CsvRow;
use App\Support\ImportReport;
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
                    // Everyone the subject has been tagged to, not only those
                    // without a grade yet. A scholar who has passed it still took
                    // it, and counting only the ungraded showed 0 against every
                    // subject of an imported catalogue, which reads as an import
                    // that did nothing.
                    'scholars_count' => $course->studentCourses()->count(),
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
                'fields' => ['course_code', 'course_name', 'credits', 'department_name', 'scholars_count'],
                'fieldsTitles' => ['Course Code', 'Course Name', 'Credits', 'Department', 'Scholars tagged'],
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
        // Course managers, and whoever tags scholars with courses from a profile.
        $user = $request->user();
        if (!\App\Support\Navigation::allows($user, 'courseManagement') && !$user->may('can_manage_students')) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

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
     * The course catalogue, as the office keeps it.
     *
     * One row per subject, not per scholar: the code, its name, what it is
     * worth and whose department teaches it. The coursework import creates a
     * subject it has never seen from a scholar's row, which gets the name and
     * credits but no department, since a scholar's row does not say who teaches
     * the subject. This is where that is filled in.
     *
     * Read by column name, like every other import, and matched on the code, so
     * sending a corrected file again fixes the subject rather than adding a
     * second one under the same code.
     */
    public static function courseRows(array $rows): array
    {
        return array_values(array_filter(array_map(fn (array $row) => [
            'course_code' => CsvRow::column($row, 'Course Code', 'Subject Code', 'course_code'),
            'course_name' => CsvRow::column($row, 'Course Name', 'Subject Name', 'Subject', 'course_name'),
            'credits' => CsvRow::column($row, 'Credits', 'credits'),
            'department_code' => CsvRow::column($row, 'Department Code', 'Department', 'department_code'),
            'row_number' => $row['_rowNumber'] ?? $row['row_number'] ?? null,
        ], $rows), fn (array $row) => $row['course_code'] !== ''));
    }

    /**
     * The subjects nobody has said what they are worth.
     *
     * A subject the coursework import met on a scholar's row was created from
     * what that row knew, which is a name and sometimes not even credits. This
     * is the catalogue's own gap list, in the columns this import reads: fill
     * the credits and the department and send the same file back.
     */
    public function coursesMissingDetails()
    {
        if (!$this->managesCourses()) {
            return $this->refuse();
        }

        $scope = $this->departmentScope();

        $rows = Course::with('department')
            ->where(fn ($query) => $query->where('credits', 0)->orWhereNull('department_id'))
            ->when($scope, fn ($query) => $query->where('department_id', $scope))
            ->orderBy('course_code')
            ->get()
            ->map(fn (Course $course) => [
                $course->course_code,
                $course->course_name,
                (float) $course->credits > 0 ? (string) $course->credits : '',
                optional($course->department)->code ?? '',
            ]);

        return response()->json([
            'headers' => ['Course Code', 'Course Name', 'Credits', 'Department Code'],
            'rows' => $rows,
            'count' => $rows->count(),
        ]);
    }

    public function importCoursesFromCSV(Request $request)
    {
        if (!$this->managesCourses()) {
            return $this->refuse();
        }

        $scope = $this->departmentScope();
        if ($scope === 0) {
            return $this->refuse('You are not attached to a department.');
        }

        if ($request->has('rows')) {
            $request->merge(['rows' => self::courseRows((array) $request->input('rows'))]);
        }

        $request->validate([
            'rows' => 'required|array',
            'rows.*.course_code' => 'required|string',
        ]);

        $created = 0;
        $updated = 0;
        // Rows that made no subject. Counted apart from $errors, which also
        // carries notes about rows that did land, so the number the office
        // reads is how many records were actually lost.
        $failed = 0;
        $errors = [];

        foreach ($request->rows as $row) {
            $rowNumber = $row['row_number'] ?? '?';
            $code = $row['course_code'];

            // The catalogue arrives in one file. Without this, one cell the
            // database refuses, a subject name past 255 characters say, ends
            // the request with a 500 and the office is told nothing about the
            // hundreds of rows that did land before it.
            try {
                $course = Course::where('course_code', $code)->first();

                // A head or coordinator files every course under their own
                // department; for the office the sheet says whose it is.
                $department = null;
                if ($scope) {
                    $department = $scope;
                } elseif ($row['department_code'] !== '') {
                    $department = optional(\App\Support\DepartmentCodes::resolve($row['department_code']))->id;
                    if (!$department) {
                        $errors[] = "Row {$rowNumber}: no department with the code '{$row['department_code']}'";
                        $failed++;
                        continue;
                    }
                }

                if (!$course && $row['course_name'] === '') {
                    $errors[] = "Row {$rowNumber}: '{$code}' is new, so the row needs the subject name";
                    $failed++;
                    continue;
                }

                if ($course && $scope && (int) $course->department_id !== $scope && $course->department_id !== null) {
                    $errors[] = "Row {$rowNumber}: '{$code}' belongs to another department";
                    $failed++;
                    continue;
                }

                // credits has no default in the table, so a new subject starts at
                // nothing and says so below rather than refusing the row.
                $course ??= new Course(['course_code' => $code, 'credits' => 0]);
                $isNew = !$course->exists;

                if ($row['course_name'] !== '') {
                    $course->course_name = $row['course_name'];
                }
                // A blank cell is not a statement that the subject is worth
                // nothing, so it leaves what is stored alone. Neither is a cell
                // holding a word: (float) 'Audit' is 0.0, which would have quietly
                // rewritten a subject that was worth four credits as worth none.
                if ($row['credits'] !== '') {
                    if (is_numeric(trim($row['credits']))) {
                        $course->credits = (float) $row['credits'];
                    } else {
                        $errors[] = "Row {$rowNumber}: credits read '{$row['credits']}', "
                            . "which is not a number, so the credits were left as they were";
                    }
                }
                if ($department) {
                    $course->department_id = $department;
                }
                $course->save();

                if ($isNew && (float) $course->credits === 0.0) {
                    $errors[] = "Row {$rowNumber}: '{$code}' was added worth 0 credits, "
                        . "since the row gives none";
                }

                $isNew ? $created++ : $updated++;
            } catch (\Throwable $e) {
                $errors[] = "Row {$rowNumber}: '{$code}' was not saved. " . $e->getMessage();
                $failed++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "{$created} courses added, {$updated} updated",
            // What the page tells the reader, in order. Capped at three row
            // warnings, since a bad sheet can carry hundreds.
            'messages' => ImportReport::withRowErrors(
                [['tone' => 'success', 'text' => "{$created} courses added, {$updated} updated"]],
                $errors
            ),
            'data' => [
                'success_count' => $created,
                'update_count' => $updated,
                'error_count' => $failed,
                'errors' => $errors,
            ],
        ], 200);
    }

}

<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\AuthorizesCapability;
use App\Models\StudentCourse;
use App\Models\Student;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class StudentCourseController extends Controller
{
    use AuthorizesCapability;

    /**
     * Get courses for logged-in student
     */
    public function getStudentCourses(Request $request)
    {
        try {
            $loggedInUser = Auth::user();
            $student = $loggedInUser->student;

            if (!$student) {
                return response()->json([
                    'message' => 'Student not found'
                ], 404);
            }

            $status = $request->query('status'); // 'enrolled' or 'completed'

            $query = StudentCourse::with('course.department')
                ->where('student_id', $student->roll_no);

            if ($status) {
                $query->where('status', $status);
            }

            $courses = $query->orderBy('semester', 'desc')->get();

            $result = $courses->map(function ($studentCourse) {
                return [
                    'id' => $studentCourse->id,
                    'course_code' => $studentCourse->course->course_code,
                    'course_name' => $studentCourse->course->course_name,
                    'credits' => $studentCourse->course->credits,
                    'department_name' => $studentCourse->course->department->name ?? 'N/A',
                    'semester' => $studentCourse->semester,
                    'status' => $studentCourse->status,
                    'grade' => $studentCourse->grade,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $result
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching student courses: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Tag student with course (Admin/HOD/Coordinator)
     */
    public function tagStudentWithCourse(Request $request)
    {
        try {
            if ($denied = $this->denyUnlessMay('can_manage_students', 'You do not have permission to manage student courses')) return $denied;

            $request->validate([
                'student_id' => 'required|integer',
                'course_id' => 'required|integer',
                'semester' => 'required|string',
                'status' => 'nullable|in:enrolled,completed',
                'grade' => 'nullable|string',
            ]);
           
            // Check if already enrolled
            $existing = StudentCourse::where('student_id', $request->student_id)
                ->where('course_id', $request->course_id)
                ->where('semester', $request->semester)
                ->first();

            if ($existing) {
                // Update existing record
                $existing->status = $request->status ?? $existing->status;
                if ($request->grade) {
                    $existing->grade = $request->grade;
                }
                $existing->save();

                return response()->json([
                    'success' => true,
                    'message' => 'Student course enrollment updated successfully',
                    'data' => $existing
                ], 200);
            }

            $studentCourse = new StudentCourse();
            $studentCourse->student_id = $request->student_id;
            $studentCourse->course_id = $request->course_id;
            $studentCourse->semester = $request->semester;
            $studentCourse->status = $request->status ?? 'enrolled';
            $studentCourse->grade = $request->grade;
            $studentCourse->save();

            return response()->json([
                'success' => true,
                'message' => 'Student tagged with course successfully',
                'data' => $studentCourse
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error tagging student with course: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update grade for student course
     */
    public function updateGrade(Request $request, $id)
    {
        try {
            if ($denied = $this->denyUnlessMay('can_manage_students', 'You do not have permission to manage student courses')) return $denied;

            $request->validate([
                'grade' => 'required|string',
                'status' => 'required|in:enrolled,completed',
            ]);

            $studentCourse = StudentCourse::find($id);
            if (!$studentCourse) {
                return response()->json([
                    'message' => 'Student course record not found'
                ], 404);
            }

            $studentCourse->grade = $request->grade;
            $studentCourse->status = $request->status;
            $studentCourse->save();

            return response()->json([
                'success' => true,
                'message' => 'Grade updated successfully',
                'data' => $studentCourse
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error updating grade: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get courses for specific student (Admin view)
     */
    public function getCoursesForStudent($studentId)
    {
        try {
            $student = Student::with('user')->find($studentId);
            if (!$student) {
                return response()->json([
                    'message' => 'Student not found'
                ], 404);
            }

            // A scholar reads their own; anyone else needs the capability.
            $isOwn = Auth::user()->student?->roll_no === $student->roll_no;
            if (!$isOwn && ($denied = $this->denyUnlessMay('can_manage_students', 'You do not have permission to manage student courses'))) return $denied;

            $courses = StudentCourse::with('course.department')
                ->where('student_id', $studentId)
                ->orderBy('semester', 'desc')
                ->get();

            $result = $courses->map(function ($studentCourse) {
                return [
                    'id' => $studentCourse->id,
                    'course_code' => $studentCourse->course->course_code,
                    'course_name' => $studentCourse->course->course_name,
                    'credits' => $studentCourse->course->credits,
                    'department_name' => $studentCourse->course->department->name ?? 'N/A',
                    'semester' => $studentCourse->semester,
                    'status' => $studentCourse->status,
                    'grade' => $studentCourse->grade,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $result,
                'student_name' => $student->user?->name(),
                'student_code' => $student->roll_no,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching courses for student: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove student from course
     */
    public function removeStudentFromCourse($id)
    {
        try {
            if ($denied = $this->denyUnlessMay('can_manage_students', 'You do not have permission to manage student courses')) return $denied;

            $studentCourse = StudentCourse::find($id);
            if (!$studentCourse) {
                return response()->json([
                    'message' => 'Student course record not found'
                ], 404);
            }

            $studentCourse->delete();

            return response()->json([
                'success' => true,
                'message' => 'Student removed from course successfully'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error removing student from course: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Load the institute's coursework sheet.
     *
     * One row per scholar per course: the registration number, the course code,
     * name and credits, the academic year, and the grade once it is in. The
     * courses themselves are not entered anywhere first; the sheet is where
     * they come from, so a code the portal does not have is created from the
     * row and one it does have is reused.
     *
     * A grade means the course is finished, a blank one means it is still being
     * taken. Re-importing updates the row rather than adding a second one.
     *
     * Rows arrive already split by the import modal every other page uses, so
     * the CSV is parsed in one place rather than once per importer.
     */
    public function bulkImportFromCSV(Request $request)
    {
        try {
            if ($denied = $this->denyUnlessMay('can_manage_students', 'You do not have permission to manage student courses')) return $denied;

            $request->validate([
                'rows' => 'required|array',
                'rows.*' => 'array',
            ]);

            $successCount = 0;
            $errorCount = 0;
            $errors = [];

            foreach ($request->rows as $data) {
                $rowNumber = $data['row_number'] ?? '?';

                try {
                    $rollNumber = $this->cell($data, 'Registration Number', 'Roll Number', 'roll_number');
                    $courseCode = $this->cell($data, 'Subject Code', 'Course Code', 'course_code');
                    $semester = $this->cell($data, 'Academic Year', 'Semester', 'semester');
                    $grade = $this->cell($data, 'Grade Earned', 'Grade', 'grade');

                    $student = Student::where('roll_no', $rollNumber)->first();
                    if (!$student) {
                        $errors[] = "Row {$rowNumber}: no scholar with registration number '{$rollNumber}'";
                        $errorCount++;
                        continue;
                    }

                    if ($courseCode === '' || $semester === '') {
                        $errors[] = "Row {$rowNumber}: the subject code and the academic year are both required";
                        $errorCount++;
                        continue;
                    }

                    $course = Course::where('course_code', $courseCode)->first();
                    if (!$course) {
                        $courseName = $this->cell($data, 'Subject', 'Course Name', 'course_name');
                        if ($courseName === '') {
                            $errors[] = "Row {$rowNumber}: '{$courseCode}' is new, so the row needs the subject name";
                            $errorCount++;
                            continue;
                        }

                        // No department: one code is taught to scholars of
                        // several departments, and the column is nullable.
                        $course = Course::create([
                            'course_code' => $courseCode,
                            'course_name' => $courseName,
                            'credits' => (float) ($this->cell($data, 'Credits', 'credits') ?: 0),
                        ]);
                    } else {
                        $credits = $this->cell($data, 'Credits', 'credits');
                        if ($credits !== '' && (float) $credits !== (float) $course->credits) {
                            $errors[] = "Row {$rowNumber}: '{$courseCode}' is worth {$course->credits} credits in the portal, "
                                . "the sheet says {$credits}. The portal's value is kept.";
                        }
                    }

                    // A grade is what says the course is over. The status column
                    // the old template carried said the same thing twice.
                    $status = $grade !== '' ? 'completed' : 'enrolled';

                    StudentCourse::updateOrCreate(
                        [
                            'student_id' => $student->roll_no,
                            'course_id' => $course->id,
                            'semester' => $semester,
                        ],
                        [
                            'status' => $status,
                            'grade' => $grade !== '' ? $grade : null,
                        ]
                    );

                    $successCount++;
                } catch (\Exception $e) {
                    $errors[] = "Row {$rowNumber}: " . $e->getMessage();
                    $errorCount++;
                }
            }

            return response()->json([
                'success' => true,
                'message' => "Import completed: {$successCount} rows, {$errorCount} errors",
                'data' => [
                    'success_count' => $successCount,
                    'error_count' => $errorCount,
                    'errors' => $errors,
                ]
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error importing student courses from CSV: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * A cell by any of the names its column goes by, ignoring case, spaces and
     * punctuation, so the institute's wording and the older template both read.
     *
     * The columns used to be read by position, so a sheet with its columns in a
     * different order imported silently wrong.
     *
     * @param  array<string, string|null>  $data
     */
    private function cell(array $data, string ...$aliases): string
    {
        // A bracketed aside is an instruction to whoever fills the sheet, not
        // part of the column's name: "Grade Earned (Leave Blank If Enrolled But
        // Not Cleared Yet)" is the Grade column.
        $normalise = fn ($name) => strtolower(preg_replace(
            ['/\([^)]*\)/', '/[^a-z0-9]+/i'],
            '',
            (string) $name
        ));

        $values = [];
        foreach ($data as $key => $value) {
            $values[$normalise($key)] = trim((string) $value);
        }

        foreach ($aliases as $alias) {
            if (!empty($values[$normalise($alias)])) {
                return $values[$normalise($alias)];
            }
        }

        return '';
    }
}

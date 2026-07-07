<?php

namespace App\Http\Controllers;

use App\Models\Forms;
use App\Models\Student;
use App\Models\ConstituteOfIRB;
use App\Models\IrbSubForm;
use App\Models\ResearchExtentionsForm;
use App\Models\ListOfExaminersForm;
use App\Models\Presentation;
use App\Models\StudentSemesterOffForm;
use App\Models\SupervisorChangeForm;
use App\Models\SupervisorAllocation;
use App\Models\StudentStatusChangeForms;
use App\Models\SynopsisSubmission;
use App\Models\ThesisExtentionForm;
use App\Models\ThesisSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AdminFormController extends Controller
{
    private $formModels = [
        
        'irb-constitution' => ConstituteOfIRB::class,
        'irb-submission' => IrbSubForm::class,
        'irb-extension' => ResearchExtentionsForm::class,
        'list-of-examiners' => ListOfExaminersForm::class,
        'presentation' => Presentation::class,
        'semester-off' => StudentSemesterOffForm::class,
        'status-change' => StudentStatusChangeForms::class,
        'supervisor-allocation' => SupervisorAllocation::class,
        'supervisor-change' => SupervisorChangeForm::class,
        'synopsis-submission' => SynopsisSubmission::class,
        'thesis-extension' => ThesisExtentionForm::class,
        'thesis-submission' => ThesisSubmission::class,
    ];

    public $formMetadata = [
        'supervisor-allocation' => [
            'form_name' => 'Supervisor Allocation Form',
            'max_count' => 1,
            'steps' => ['student', 'phd_coordinator', 'hod']
        ],
        'irb-constitution' => [
            'form_name' => 'IRB Constitution',
            'max_count' => 1,
            'steps' => ['student', 'faculty', 'hod','adordc' ,'dordc', 'complete']
        ],
        'irb-submission' => [
            'form_name' => 'Revised IRB',
            'max_count' => 1,
            'steps' => ['student', 'faculty','external','doctoral', 'hod','adordc' , 'dordc', 'complete']
        ],
        'irb-extension' => [
            'form_name' => 'IRB Extension',
            'max_count' => 10,
            'steps' => ['student', 'faculty', 'phd_coordinator','hod', 'dra', 'dordc', 'complete']
        ],
        'supervisor-change' => [
            'form_name' => 'Supervisor Change',
            'max_count' => 10,
            'steps' => ['student',  'phd_coordinator', 'hod','dordc', 'dra', 'complete']
        ],
        'status-change' => [
            'form_name' => 'Change of Status',
            'max_count' => 2,
            'steps' => ['student', 'faculty',  'phd_coordinator', 'hod', 'dra','dordc', 'complete']
        ],
        'semester-off' => [
            'form_name' => 'Semester Off',
            'max_count' => 10,
            'steps' => ['student', 'faculty','phd_coordinator','hod','dra','dordc','director', 'complete']
        ],
        'list-of-examiners' => [
            'form_name' => 'List of Examiners',
            'max_count' => 1,
            'steps' => [            'faculty',
            'hod',
            'dordc',
            'director',
            'complete']
        ],
        'synopsis-submission' => [
            'form_name' => 'Synopsis Submission',
            'max_count' => 1,
            'steps' => ['student', 'faculty',  'phd_coordinator', 'hod', 'dra','adordc' ,'dordc', 'director',  'complete']
        ],
        'thesis-submission' => [
            'form_name' => 'Thesis Submission',
            'max_count' => 1,
            'steps' => ['student', 'faculty',  'phd_coordinator','hod',  'dra','adordc','dordc', 'complete']
        ],
        'thesis-extension' => [
            'form_name' => 'Thesis Extension',
            'max_count' => 10,
            'steps' => ["student","faculty","phd_coordinator","hod","dra","dordc","complete"]
        ],
        // 'presentation' => [
        //     'form_name' => 'Presentation',
        //     'max_count' => 100,
        //     'steps' => ['student', 'external']
        // ],
    ];

    private $lockFields = [
        'student' => 'student_lock',
        'faculty' => 'supervisor_lock',
        'phd_coordinator' => 'phd_coordinator_lock',
        'hod' => 'hod_lock',
        'dordc' => 'dordc_lock',
        'dra' => 'dra_lock',
        'director' => 'director_lock',
        'doctoral' => 'doctoral_lock',
        'external' => 'external_lock',
    ];

    /**
     * Get all forms for a specific student
     */
    public function getStudentForms($student_id)
    {
        try {
            $student = Student::find($student_id);
            if (!$student) {
                return response()->json(['message' => 'Student not found'], 404);
            }

            // Get existing general forms
            $existingForms = Forms::where('student_id', $student_id)->get()->keyBy('form_type');
            
            $formsData = [];

            // Iterate through all available form types
            foreach ($this->formModels as $formType => $modelClass) {
                $generalForm = $existingForms->get($formType);
                $metadata = $this->formMetadata[$formType] ?? [];

                if ($generalForm) {
                    // Form exists in forms table
                    $formInstances = $modelClass::where('student_id', $student_id)->get();

                    $formsData[] = [
                        'form_type' => $formType,
                        'form_name' => $generalForm->form_name,
                        'exists_in_forms_table' => true,
                        'general_form' => [
                            'id' => $generalForm->id,
                            'stage' => $generalForm->stage,
                            'count' => $generalForm->count,
                            'max_count' => $generalForm->max_count,
                            'student_available' => $generalForm->student_available,
                            'supervisor_available' => $generalForm->supervisor_available,
                            'hod_available' => $generalForm->hod_available,
                            'phd_coordinator_available' => $generalForm->phd_coordinator_available,
                            'dordc_available' => $generalForm->dordc_available,
                            'dra_available' => $generalForm->dra_available,
                            'director_available' => $generalForm->director_available,
                            'doctoral_available' => $generalForm->doctoral_available,
                        ],
                        'instances' => $formInstances->map(function ($instance) {
                            return [
                                'id' => $instance->id,
                                'status' => $instance->status,
                                'stage' => $instance->stage,
                                'completion' => $instance->completion,
                                'current_step' => $instance->current_step,
                                'maximum_step' => $instance->maximum_step,
                                'steps' => $instance->steps,
                                'locks' => [
                                    'student' => $instance->student_lock,
                                    'supervisor' => $instance->supervisor_lock,
                                    'phd_coordinator' => $instance->phd_coordinator_lock,
                                    'hod' => $instance->hod_lock,
                                    'dordc' => $instance->dordc_lock,
                                    'dra' => $instance->dra_lock,
                                    'director' => $instance->director_lock,
                                    'doctoral' => $instance->doctoral_lock,
                                    'external' => $instance->external_lock,
                                ],
                                'approvals' => [
                                    'supervisor' => $instance->supervisor_approval,
                                    'phd_coordinator' => $instance->phd_coordinator_approval,
                                    'hod' => $instance->hod_approval,
                                    'dordc' => $instance->dordc_approval,
                                    'dra' => $instance->dra_approval,
                                    'director' => $instance->director_approval,
                                    'doctoral' => $instance->doctoral_approval,
                                    'external' => $instance->external_approval,
                                ],
                                'created_at' => $instance->created_at,
                                'updated_at' => $instance->updated_at,
                            ];
                        }),
                    ];
                } else {
                    // Form does not exist in forms table yet
                    $formsData[] = [
                        'form_type' => $formType,
                        'form_name' => $metadata['form_name'] ?? ucwords(str_replace('-', ' ', $formType)),
                        'exists_in_forms_table' => false,
                        'general_form' => [
                            'id' => null,
                            'stage' => 'student',
                            'count' => 0,
                            'max_count' => $metadata['max_count'] ?? 1,
                            'student_available' => false,
                            'supervisor_available' => false,
                            'hod_available' => false,
                            'phd_coordinator_available' => false,
                            'dordc_available' => false,
                            'dra_available' => false,
                            'director_available' => false,
                            'doctoral_available' => false,
                        ],
                        'instances' => [],
                    ];
                }
            }

            return response()->json([
                'success' => true,
                'student' => [
                    'roll_no' => $student->roll_no,
                    'name' => $student->user->name(),
                    'department' => $student->department->name,
                ],
                'forms' => $formsData,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching student forms: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Create a new form instance for a student
     */
    public function createFormInstance(Request $request)
    {
        $request->validate([
            'student_id' => 'required|integer|exists:students,roll_no',
            'form_type' => 'required|string',
            'stage' => 'nullable|string',
            'enable_form' => 'nullable|boolean', // Flag to create forms table entry
        ]);

        try {
            DB::beginTransaction();

            $student = Student::find($request->student_id);
            $modelClass = $this->formModels[$request->form_type] ?? null;

            if (!$modelClass) {
                return response()->json(['message' => 'Invalid form type'], 400);
            }

            // Check or create general form entry
            $generalForm = Forms::where('form_type', $request->form_type)
                ->where('student_id', $request->student_id)
                ->first();

            if (!$generalForm) {
                // Create new forms table entry
                $metadata = $this->formMetadata[$request->form_type] ?? [];
                // Step lists use the 'faculty' role name, but the forms table's stage enum
                // and availability flags use 'supervisor'. Normalize so both are valid
                // (e.g. list-of-examiners starts at 'faculty' -> stage 'supervisor').
                $steps = $metadata['steps'] ?? ['student'];
                $availableRoles = array_map(fn ($s) => $s === 'faculty' ? 'supervisor' : $s, $steps);

                $generalForm = new Forms([
                    'student_id' => $request->student_id,
                    'form_type' => $request->form_type,
                    'form_name' => $metadata['form_name'] ?? ucwords(str_replace('-', ' ', $request->form_type)),
                    'department_id' => $student->department_id,
                    'stage' => $availableRoles[0] ?? 'student',
                    'count' => 0,
                    'max_count' => $metadata['max_count'] ?? 1,
                    'student_available' => in_array('student', $availableRoles),
                    'supervisor_available' => in_array('supervisor', $availableRoles),
                    'hod_available' => in_array('hod', $availableRoles),
                    'phd_coordinator_available' => in_array('phd_coordinator', $availableRoles),
                    'dordc_available' => in_array('dordc', $availableRoles),
                    'dra_available' => in_array('dra', $availableRoles),
                    'director_available' => in_array('director', $availableRoles),
                    'doctoral_available' => in_array('doctoral', $availableRoles),
                    'external_available' => in_array('external', $availableRoles),
                ]);
                $generalForm->save();
            }

            // Check if max count reached
            if ($generalForm->count >= $generalForm->max_count) {
                return response()->json(['message' => 'Maximum form count reached'], 400);
            }

            // Create form instance only if enable_form is not just enabling the form
            if (!$request->enable_form) {
                $formInstance = new $modelClass([
                    'student_id' => $request->student_id,
                    'status' => 'pending',
                    'stage' => $request->stage ?? 'student',
                    'completion' => 'incomplete',
                    'current_step' => 0,
                    'maximum_step' => 0,
                    'steps' => $this->formMetadata[$request->form_type]['steps'] ?? ['student'],
                    'student_lock' => false,
                ]);

                $formInstance->save();

                // Update general form count
                $generalForm->count++;
                $generalForm->save();

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Form instance created successfully',
                    'form_id' => $formInstance->id,
                ], 201);
            } else {
                // Just enabling the form in forms table
                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Form enabled successfully',
                    'form_id' => $generalForm->id,
                ], 201);
            }
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error creating form instance: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Update form stage and locks
     */
    public function updateFormControl(Request $request)
    {
        $request->validate([
            'student_id' => 'required|integer|exists:students,roll_no',
            'form_type' => 'required|string',
            'form_id' => 'required|integer',
            'stage' => 'nullable|string',
            'current_step' => 'nullable|integer',
            'maximum_step' => 'nullable|integer',
            'locks' => 'nullable|array',
            'locks.*' => 'boolean',
        ]);

        try {
            $modelClass = $this->formModels[$request->form_type] ?? null;

            if (!$modelClass) {
                return response()->json(['message' => 'Invalid form type'], 400);
            }

            $formInstance = $modelClass::where('id', $request->form_id)
                ->where('student_id', $request->student_id)
                ->first();

            if (!$formInstance) {
                return response()->json(['message' => 'Form instance not found'], 404);
            }

            // Update stage
            if ($request->has('stage')) {
                if($request->stage=='faculty')
                    $formInstance->stage='supervisor';
                else
                $formInstance->stage = $request->stage;
            }

            // Update steps
            if ($request->has('current_step')) {
                $formInstance->current_step = $request->current_step;
            }

            if ($request->has('maximum_step')) {
                $formInstance->maximum_step = $request->maximum_step;
            }

            // Update locks
            if ($request->has('locks')) {
                foreach ($request->locks as $role => $lockValue) {
                    $lockField = $this->lockFields[$role] ?? null;
                    if ($lockField && in_array($lockField, $formInstance->getFillable())) {
                        $formInstance->$lockField = $lockValue;
                    }
                }
            }

            $formInstance->addHistoryEntry('Form control updated by admin', 'Admin');
            $formInstance->save();

            return response()->json([
                'success' => true,
                'message' => 'Form control updated successfully',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error updating form control: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Toggle general form availability for roles
     */
    public function toggleFormAvailability(Request $request)
    {
        $request->validate([
            'student_id' => 'required|integer|exists:students,roll_no',
            'form_type' => 'required|string',
            'role' => 'required|string',
            'available' => 'required|boolean',
        ]);

        try {
            $generalForm = Forms::where('form_type', $request->form_type)
                ->where('student_id', $request->student_id)
                ->first();

            if (!$generalForm) {
                return response()->json(['message' => 'Form not found'], 404);
            }

            $field = $request->role . '_available';
            if (in_array($field, $generalForm->getFillable())) {
                $generalForm->$field = $request->available;
                $generalForm->save();

                return response()->json([
                    'success' => true,
                    'message' => 'Form availability updated',
                ], 200);
            }

            return response()->json(['message' => 'Invalid role'], 400);
        } catch (\Exception $e) {
            Log::error('Error toggling form availability: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Update general form stage
     */
    public function updateGeneralFormStage(Request $request)
    {
        $request->validate([
            'student_id' => 'required|integer|exists:students,roll_no',
            'form_type' => 'required|string',
            'stage' => 'required|string',
        ]);

        try {
            $generalForm = Forms::where('form_type', $request->form_type)
                ->where('student_id', $request->student_id)
                ->first();

            if (!$generalForm) {
                return response()->json(['message' => 'Form not found'], 404);
            }

            $generalForm->stage = $request->stage;
            $generalForm->save();

            return response()->json([
                'success' => true,
                'message' => 'General form stage updated',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error updating general form stage: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete a form instance
     */
    public function deleteFormInstance(Request $request)
    {
        $request->validate([
            'student_id' => 'required|integer|exists:students,roll_no',
            'form_type' => 'required|string',
            'form_id' => 'required|integer',
        ]);

        try {
            DB::beginTransaction();

            $modelClass = $this->formModels[$request->form_type] ?? null;

            if (!$modelClass) {
                return response()->json(['message' => 'Invalid form type'], 400);
            }

            $formInstance = $modelClass::where('id', $request->form_id)
                ->where('student_id', $request->student_id)
                ->first();

            if (!$formInstance) {
                return response()->json(['message' => 'Form instance not found'], 404);
            }

            // Update general form count
            $generalForm = Forms::where('form_type', $request->form_type)
                ->where('student_id', $request->student_id)
                ->first();

            if ($generalForm && $generalForm->count > 0) {
                $generalForm->count--;
                $generalForm->save();
            }

            $formInstance->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Form instance deleted successfully',
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting form instance: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Disable a form for a student (removes from forms table)
     */
    public function disableForm(Request $request)
    {
        $request->validate([
            'student_id' => 'required|integer|exists:students,roll_no',
            'form_type' => 'required|string',
        ]);

        try {
            DB::beginTransaction();

            $generalForm = Forms::where('form_type', $request->form_type)
                ->where('student_id', $request->student_id)
                ->first();

            if (!$generalForm) {
                return response()->json(['message' => 'Form not found'], 404);
            }

            // Check if there are instances
            $modelClass = $this->formModels[$request->form_type] ?? null;
            if ($modelClass) {
                $instanceCount = $modelClass::where('student_id', $request->student_id)->count();
                if ($instanceCount > 0) {
                    return response()->json([
                        'message' => 'Cannot disable form with existing instances. Please delete all instances first.',
                    ], 400);
                }
            }

            // Delete the general form entry
            $generalForm->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Form disabled successfully',
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error disabling form: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Helper method to get form creation data with all required fields
     * This ensures consistency across the application
     */
    public function getFormCreationData($formType, $studentId, $departmentId)
    {
        $metadata = $this->formMetadata;
        $formMeta = $metadata[$formType] ?? null;

        if (!$formMeta) {
            return null;
        }

        $availableRoles = $formMeta['steps'] ?? ['student'];

        return [
            'student_id' => $studentId,
            'department_id' => $departmentId,
            'form_type' => $formType,
            'form_name' => $formMeta['form_name'],
            'max_count' => $formMeta['max_count'],
            'stage' => 'student',
            'count' => 0,
            'student_available' => in_array('student', $availableRoles),
            'supervisor_available' => in_array('faculty', $availableRoles),
            'hod_available' => in_array('hod', $availableRoles),
            'phd_coordinator_available' => in_array('phd_coordinator', $availableRoles),
            'dordc_available' => in_array('dordc', $availableRoles),
            'dra_available' => in_array('dra', $availableRoles),
            'director_available' => in_array('director', $availableRoles),
            'doctoral_available' => in_array('doctoral', $availableRoles),
            'external_available' => in_array('external', $availableRoles),
        ];
    }

}

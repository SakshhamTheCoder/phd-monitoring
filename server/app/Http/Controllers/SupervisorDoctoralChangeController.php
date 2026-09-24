<?php

namespace App\Http\Controllers;

use App\Models\SupervisorDoctoralChange;
use App\Models\Supervisor;
use App\Models\DoctoralCommittee;
use App\Models\Faculty;
use App\Models\IrbDoctoralApproval;
use App\Models\IrbSubForm;
use App\Models\OutsideExpert;
use App\Models\Presentation;
use App\Models\PresentationReview;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SupervisorDoctoralChangeController extends Controller
{
    /**
     * List all pending changes (for DORDC approval)
     */
    public function listPendingChanges(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role->role;

        if (!$user->may('can_manage_supervisor_changes')) {
            return response()->json([
                'message' => 'You do not have permission to view pending changes'
            ], 403);
        }

        $changes = SupervisorDoctoralChange::with([
            'student.user',
            'student.department',
            'requester',
            'oldFaculty.user',
            'newFaculty.user',
            'outsideExpert'
        ])
            ->where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->get();

        $result = $changes->map(function ($change) {
            $oldMember = null;
            $newMember = null;

            if ($change->old_faculty_code && $change->oldFaculty) {
                $oldMember = [
                    'name' => $change->oldFaculty->user->name(),
                    'email' => $change->oldFaculty->user->email,
                    'type' => $change->oldFaculty->type,
                ];
            }

            if ($change->faculty_type === 'external' && $change->outside_expert_id) {
                $expert = $change->outsideExpert;
                $newMember = [
                    'name' => $expert->first_name . ' ' . $expert->last_name,
                    'email' => $expert->email,
                    'type' => 'external',
                    'institution' => $expert->institution,
                ];
            } elseif ($change->new_faculty_code && $change->newFaculty) {
                $newMember = [
                    'name' => $change->newFaculty->user->name(),
                    'email' => $change->newFaculty->user->email,
                    'type' => $change->newFaculty->type,
                ];
            }

            return [
                'id' => $change->id,
                'student_name' => $change->student->user->name(),
                'student_roll_no' => $change->student->roll_no,
                'department' => $change->student->department->name,
                'change_type' => $change->change_type,
                'member_type' => $change->member_type,
                'faculty_type' => $change->faculty_type,
                'old_member' => $oldMember,
                'new_member' => $newMember,
                // The change in words, as the approvals page shows it.
                'change' => self::describe($change->change_type, $change->member_type, $change->faculty_type, $oldMember, $newMember),
                'reason' => $change->reason,
                'requested_by' => $change->requester->name(),
                'requested_at' => $change->created_at->format('Y-m-d H:i:s'),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $result
        ]);
    }

    /** "Replace Supervisor: A → B", and the like, for one proposed change. */
    private static function describe(?string $changeType, ?string $memberType, ?string $facultyType, ?array $old, ?array $new): string
    {
        $member = $memberType === 'supervisor' ? 'Supervisor' : 'Doctoral Committee Member';
        $oldName = $old['name'] ?? 'Unknown';
        $newName = $new['name'] ?? 'Unknown';

        return match ($changeType) {
            'add' => "Add {$member}: " . ($new['name'] ?? ($facultyType === 'internal' ? 'Internal Faculty' : 'External Expert')),
            'remove' => "Remove {$member}: {$oldName}",
            'replace' => "Replace {$member}: {$oldName} → {$newName}",
            default => 'Unknown Change',
        };
    }

    /**
     * Propose a change (by HOD/PhD Coordinator)
     */
    public function proposeChange(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role->role;

        if (!$user->may('can_propose_supervisor_changes')) {
            return response()->json([
                'message' => 'You do not have permission to propose changes'
            ], 403);
        }

        $request->validate([
            'student_id' => 'required|integer|exists:students,roll_no',
            'change_type' => 'required|in:add,remove,replace',
            'member_type' => 'required|in:supervisor,doctoral',
            'faculty_type' => 'required|in:internal,external',
            'old_faculty_code' => 'nullable',
            'new_faculty_code' => 'nullable',
            'reason' => 'nullable|string',
        ]);

        // Check if user has permission for this student's department
        $student = Student::where('roll_no', $request->student_id)->first();
        if (in_array($role, ['hod', 'phd_coordinator'])) {
            if ($student->department_id !== $user->faculty->department_id) {
                return response()->json([
                    'message' => 'You can only manage students from your department'
                ], 403);
            }
        } elseif ($role === 'doctoral') {
            // Every faculty-shaped role carries 'doctoral' (User::ROLE_GRANTS) and
            // RoleRequirements only checks for a Faculty record, so without this a
            // faculty member could switch to "Doctoral Committee" and apply this
            // change (below) to any scholar, not just one they sit on.
            if (!$student->checkDoctoralCommittee($user->faculty?->faculty_code)) {
                return response()->json([
                    'message' => 'You can only manage students on your doctoral committee'
                ], 403);
            }
        }

        // Validate based on change_type
        if ($request->change_type === 'remove' && !$request->old_faculty_code) {
            return response()->json([
                'message' => 'old_faculty_code is required for remove operation'
            ], 422);
        }

        if ($request->change_type === 'add') {
            if ($request->faculty_type === 'external' && !$request->outside_expert_id) {
                return response()->json([
                    'message' => 'outside_expert_id is required for external faculty'
                ], 422);
            }
            if ($request->faculty_type === 'internal' && !$request->new_faculty_code) {
                return response()->json([
                    'message' => 'new_faculty_code is required for internal faculty'
                ], 422);
            }
        }

        if ($request->change_type === 'replace') {
            if (!$request->old_faculty_code) {
                return response()->json([
                    'message' => 'old_faculty_code is required for replace operation'
                ], 422);
            }
            if ($request->faculty_type === 'external' && !$request->outside_expert_id) {
                return response()->json([
                    'message' => 'outside_expert_id is required for external faculty'
                ], 422);
            }
            if ($request->faculty_type === 'internal' && !$request->new_faculty_code) {
                return response()->json([
                    'message' => 'new_faculty_code is required for internal faculty'
                ], 422);
            }
        }

        // Before the IRB is constituted there is no committee for a supervisor
        // swap to disturb, so the HOD and the PhD coordinator make it outright
        // and no supervisor change form is raised. Once it is constituted the
        // change goes through the form and its chain instead.
        $beforeIrbConstituted = $request->member_type === 'supervisor'
            && in_array($role, ['hod', 'phd_coordinator'], true)
            && !$student->irbCompleted();

        // Admin, doctoral, and dordc can apply changes directly without approval
        if ($beforeIrbConstituted || $user->may('can_edit_doctoral_committee')) {
            DB::beginTransaction();
            try {
                // Create the change record
                $change = SupervisorDoctoralChange::create([
                    'student_id' => $request->student_id,
                    'change_type' => $request->change_type,
                    'member_type' => $request->member_type,
                    'faculty_type' => $request->faculty_type,
                    'old_faculty_code' => $request->old_faculty_code,
                    'new_faculty_code' => $request->new_faculty_code,
                    'outside_expert_id' => $request->outside_expert_id,
                    'reason' => $request->reason,
                    'requested_by' => $user->id,
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                ]);

                // Apply the change immediately
                if ($change->member_type === 'supervisor') {
                    $this->applySupervisorChange($change);
                } else {
                    $this->applyDoctoralChange($change);
                }

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Change applied successfully (' . $role . ' direct change)',
                    'data' => $change
                ], 201);
            } catch (\Exception $e) {
                DB::rollBack();
                Log::error('Error applying direct change: ' . $e->getMessage());
                return response()->json([
                    'message' => 'Failed to apply change: ' . $e->getMessage()
                ], 500);
            }
        }

        // For HOD/PhD Coordinator, create pending change request
        $change = SupervisorDoctoralChange::create([
            'student_id' => $request->student_id,
            'change_type' => $request->change_type,
            'member_type' => $request->member_type,
            'faculty_type' => $request->faculty_type,
            'old_faculty_code' => $request->old_faculty_code,
            'new_faculty_code' => $request->new_faculty_code,
            'outside_expert_id' => $request->outside_expert_id,
            'reason' => $request->reason,
            'requested_by' => $user->id,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Change request submitted successfully. Awaiting DORDC approval.',
            'data' => $change
        ], 201);
    }

    /**
     * Approve a change (by DORDC)
     */
    public function approveChange(Request $request, $changeId)
    {
        $user = Auth::user();
        $role = $user->current_role->role;

        if (!$user->may('can_manage_supervisor_changes')) {
            return response()->json([
                'message' => 'You do not have permission to approve changes'
            ], 403);
        }

        $change = SupervisorDoctoralChange::find($changeId);
        if (!$change) {
            return response()->json(['message' => 'Change request not found'], 404);
        }

        if ($change->status !== 'pending') {
            return response()->json([
                'message' => 'This change request has already been processed'
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Apply the change based on type
            if ($change->member_type === 'supervisor') {
                $this->applySupervisorChange($change);
            } else {
                $this->applyDoctoralChange($change);
            }

            // Update change status
            $change->status = 'approved';
            $change->approved_by = $user->id;
            $change->approved_at = now();
            $change->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Change approved and applied successfully'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error approving change: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to apply change: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reject a change (by DORDC)
     */
    public function rejectChange(Request $request, $changeId)
    {
        $user = Auth::user();
        $role = $user->current_role->role;

        if (!$user->may('can_manage_supervisor_changes')) {
            return response()->json([
                'message' => 'You do not have permission to reject changes'
            ], 403);
        }

        $request->validate([
            'rejection_reason' => 'required|string',
        ]);

        $change = SupervisorDoctoralChange::find($changeId);
        if (!$change) {
            return response()->json(['message' => 'Change request not found'], 404);
        }

        if ($change->status !== 'pending') {
            return response()->json([
                'message' => 'This change request has already been processed'
            ], 422);
        }

        $change->status = 'rejected';
        $change->approved_by = $user->id;
        $change->approved_at = now();
        $change->rejection_reason = $request->rejection_reason;
        $change->save();

        return response()->json([
            'success' => true,
            'message' => 'Change rejected successfully'
        ]);
    }

    /**
     * Apply supervisor change
     */
    private function applySupervisorChange($change)
    {
        if ($change->change_type === 'add') {
            $facultyCode = $this->getFacultyCode($change);
            Supervisor::create([
                'student_id' => $change->student_id,
                'faculty_id' => $facultyCode,
                'type' => $change->faculty_type,
            ]);
        } elseif ($change->change_type === 'remove') {
            Supervisor::where('student_id', $change->student_id)
                ->where('faculty_id', $change->old_faculty_code)
                ->delete();
        } elseif ($change->change_type === 'replace') {
            $supervisor = Supervisor::where('student_id', $change->student_id)
                ->where('faculty_id', $change->old_faculty_code)
                ->first();

            if ($supervisor) {
                $facultyCode = $this->getFacultyCode($change);
                $supervisor->faculty_id = $facultyCode;
                $supervisor->type = $change->faculty_type;
                $supervisor->save();
            }
        }
    }

    /**
     * Apply doctoral committee change
     */
    private function applyDoctoralChange($change)
    {
        if ($change->change_type === 'add') {
            $facultyCode = $this->getFacultyCode($change);
            DoctoralCommittee::create([
                'student_id' => $change->student_id,
                'faculty_id' => $facultyCode,
                'type' => $change->faculty_type,
            ]);
            $this->reconcileDoctoralApprovals($change->student_id, $facultyCode, null);
        } elseif ($change->change_type === 'remove') {
            DoctoralCommittee::where('student_id', $change->student_id)
                ->where('faculty_id', $change->old_faculty_code)
                ->delete();
            $this->reconcileDoctoralApprovals($change->student_id, null, $change->old_faculty_code);
        } elseif ($change->change_type === 'replace') {
            $doctoral = DoctoralCommittee::where('student_id', $change->student_id)
                ->where('faculty_id', $change->old_faculty_code)
                ->first();

            if ($doctoral) {
                $facultyCode = $this->getFacultyCode($change);
                $oldFacultyCode = $doctoral->faculty_id;
                $doctoral->faculty_id = $facultyCode;
                $doctoral->type = $change->faculty_type;
                $doctoral->save();
                $this->reconcileDoctoralApprovals($change->student_id, $facultyCode, $oldFacultyCode);
            }
        }
    }

    /**
     * IRB submissions and Presentations each seed one pending approval row per
     * doctoral committee member the moment their doctoral stage is entered, and
     * then decide the stage is done by comparing the approved-row count against
     * the *live* committee count. If the committee changes afterwards and these
     * rows are left alone, that comparison goes wrong in both directions: an
     * added member has no row to vote through (their submit reads a null row),
     * and a removed member's row keeps being counted (or keeps blocking) for
     * someone no longer on the committee. This keeps the rows a true mirror of
     * who is actually seated, for every doctoral-stage form still in flight for
     * the student, not just one of them - a scholar can have several
     * presentations open at once, one per semester.
     */
    private function reconcileDoctoralApprovals($studentId, $addFacultyCode, $removeFacultyCode)
    {
        $irbForms = IrbSubForm::where('student_id', $studentId)
            ->where('stage', 'doctoral')
            ->where('completion', '!=', 'complete')
            ->get();

        foreach ($irbForms as $form) {
            $seeded = IrbDoctoralApproval::where('irb_sub_form_id', $form->id)->exists();
            if (!$seeded) {
                continue;
            }
            if ($removeFacultyCode) {
                IrbDoctoralApproval::where('irb_sub_form_id', $form->id)
                    ->where('doctoral_id', $removeFacultyCode)
                    ->delete();
            }
            if ($addFacultyCode) {
                IrbDoctoralApproval::firstOrCreate(
                    ['irb_sub_form_id' => $form->id, 'doctoral_id' => $addFacultyCode],
                    ['status' => 'pending']
                );
            }
        }

        $presentations = Presentation::where('student_id', $studentId)
            ->where('stage', 'doctoral')
            ->where('completion', '!=', 'complete')
            ->get();

        foreach ($presentations as $presentation) {
            $seeded = PresentationReview::where('presentation_id', $presentation->id)
                ->where('is_supervisor', 0)
                ->exists();
            if (!$seeded) {
                continue;
            }
            if ($removeFacultyCode) {
                PresentationReview::where('presentation_id', $presentation->id)
                    ->where('is_supervisor', 0)
                    ->where('faculty_id', $removeFacultyCode)
                    ->delete();
            }
            if ($addFacultyCode) {
                PresentationReview::firstOrCreate(
                    ['presentation_id' => $presentation->id, 'is_supervisor' => 0, 'faculty_id' => $addFacultyCode],
                    ['comments' => '', 'review_status' => 'pending']
                );
            }
        }
    }

    /**
     * Get faculty code (create faculty from outside expert if needed)
     */
    private function getFacultyCode($change)
    {
        if ($change->faculty_type === 'external' && $change->outside_expert_id) {
            $expert = OutsideExpert::find($change->outside_expert_id);
            if ($expert) {
                $faculty = $expert->getFaculty();
                return $faculty->faculty_code;
            }
        }

        return $change->new_faculty_code;
    }

    /**
     * Get pending changes for a specific student
     */
    public function getStudentPendingChanges($studentId)
    {
        $user = Auth::user();
        $role = $user->current_role->role;

        $student = Student::where('roll_no', $studentId)->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }

        // Check permissions
        if (in_array($role, ['hod', 'phd_coordinator'])) {
            if ($student->department_id !== $user->faculty->department_id) {
                return response()->json([
                    'message' => 'You can only view students from your department'
                ], 403);
            }
        } elseif ($role === 'doctoral') {
            if (!$student->checkDoctoralCommittee($user->faculty?->faculty_code)) {
                return response()->json([
                    'message' => 'You can only view students on your doctoral committee'
                ], 403);
            }
        } elseif (!$user->may('can_manage_supervisor_changes')) {
            return response()->json([
                'message' => 'You do not have permission to view changes'
            ], 403);
        }

        $changes = SupervisorDoctoralChange::with([
            'oldFaculty.user',
            'newFaculty.user',
            'outsideExpert',
            'requester'
        ])
            ->where('student_id', $studentId)
            ->where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->get();

        $result = $changes->map(function ($change) {
            $oldMember = null;
            $newMember = null;

            if ($change->old_faculty_code && $change->oldFaculty) {
                $oldMember = [
                    'name' => $change->oldFaculty->user->name(),
                    'email' => $change->oldFaculty->user->email,
                ];
            }

            if ($change->faculty_type === 'external' && $change->outside_expert_id) {
                $expert = $change->outsideExpert;
                $newMember = [
                    'name' => $expert->first_name . ' ' . $expert->last_name,
                    'email' => $expert->email,
                    'institution' => $expert->institution,
                ];
            } elseif ($change->new_faculty_code && $change->newFaculty) {
                $newMember = [
                    'name' => $change->newFaculty->user->name(),
                    'email' => $change->newFaculty->user->email,
                ];
            }

            return [
                'id' => $change->id,
                'change_type' => $change->change_type,
                'member_type' => $change->member_type,
                'faculty_type' => $change->faculty_type,
                'old_member' => $oldMember,
                'new_member' => $newMember,
                'reason' => $change->reason,
                'requested_by' => $change->requester->name(),
                'requested_at' => $change->created_at->format('Y-m-d H:i:s'),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $result
        ]);
    }
}

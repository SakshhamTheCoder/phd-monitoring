<?php

namespace App\Support;

use App\Http\Controllers\AdminFormController;
use App\Models\Forms;
use App\Models\Student;

/**
 * What finishing one form makes available next.
 *
 * The three lists used to sit inline in SupervisorAllocationController,
 * IrbSubController and ScholarCommittee, each beside its own copy of the loop
 * that creates the rows. The students import needs the same lists to give an
 * imported scholar the forms their milestones have already earned, and a
 * fourth copy is how the four start disagreeing.
 *
 * Only the form type is read. getFormCreationData() builds the row from
 * AdminFormController's metadata, so a form name or a max count repeated here
 * beside the type would only be a second place for them to drift.
 */
class FormLadder
{
    public const OPENS = [
        'supervisor-allocation' => [
            'supervisor-change',
            'irb-constitution',
            'status-change',
            'list-of-examiners',
            'semester-off',
        ],
        'irb-constitution' => [
            'irb-submission',
            'irb-extension',
        ],
        'irb-submission' => [
            'synopsis-submission',
            'thesis-extension',
            'thesis-submission',
            // The title and objectives the revised IRB settled can be revised
            // from here on.
            'revise-title',
        ],
    ];

    /** Open everything the given form makes available, skipping what is open already. */
    public static function open(Student $student, string $completedFormType): void
    {
        foreach (self::OPENS[$completedFormType] ?? [] as $formType) {
            self::openOne($student, $formType);
        }
    }

    /**
     * One form, if the scholar does not have it yet.
     *
     * Never reopens: a row already there carries a count and a stage this has
     * no business resetting.
     */
    public static function openOne(Student $student, string $formType): void
    {
        $exists = Forms::where('student_id', $student->roll_no)
            ->where('form_type', $formType)
            ->exists();

        if ($exists) {
            return;
        }

        $formData = (new AdminFormController())->getFormCreationData(
            $formType,
            $student->roll_no,
            $student->department_id
        );

        if ($formData) {
            Forms::create($formData);
        }
    }
}

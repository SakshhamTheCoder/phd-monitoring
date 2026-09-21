<?php

namespace App\Support;

use App\Models\DoctoralCommittee;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\IRBCommittee;
use App\Models\OutsideExpert;
use App\Models\Student;

/**
 * The one place a scholar's committee is written.
 *
 * Named for the scholar rather than the IRB because App\Models\IRBCommittee
 * already exists and PHP matches class names case-insensitively, so the two
 * could not be imported into the same file.
 *
 * It lands in two tables. `doctoral_commitee` is the standing committee and is
 * what every rule in the portal actually reads: the `doctoral` step of every
 * form chain goes through Student::checkDoctoralCommittee(). `irb_committees`
 * holds the same internal members plus the outside expert, and is read in one
 * place, Student::outsideExpert().
 *
 * Two tables written from one method on purpose. They were being written from
 * three: the DORDC constituting the IRB wrote both, while the HOD's edit from
 * the scholar's page and the students import wrote only the first, so the pair
 * agreed until somebody changed a member. Whether the second table should exist
 * at all is a larger question, recorded in
 * committee-fix-notes-2026-09-20.md; until it is answered, nothing should be
 * writing one without the other.
 */
class ScholarCommittee
{
    /**
     * The IRB constitution form completing: these people join both committees.
     *
     * That is what the form has always done, and it is right for a scholar
     * whose IRB is constituted here. The cognate expert and the cognate experts
     * the HOD proposed become the scholar's standing doctoral committee, and
     * the same people plus the outside expert are the IRB committee.
     *
     * @param  array<int, int|string>  $facultyCodes
     */
    public static function constituted(Student $student, array $facultyCodes, ?OutsideExpert $outsideExpert = null): void
    {
        self::onTheDoctoralCommittee($student, $facultyCodes);
        self::onTheIrbCommittee($student, $facultyCodes, $outsideExpert);
    }

    /**
     * The doctoral committee only, leaving the IRB committee alone.
     *
     * This is a grant, not a record. `doctoral_commitee` decides who may answer
     * the `doctoral` step of every form chain, how many approvals an IRB
     * submission waits for, and how many reviewers each presentation gets, so
     * a name added here gains authority over the scholar's forms.
     *
     * Additive, and safe to call twice: (student, faculty) is unique, and a
     * plain insert on a member the scholar already has used to abort the whole
     * request with a raw SQL error.
     *
     * @param  array<int, int|string>  $facultyCodes
     */
    public static function onTheDoctoralCommittee(Student $student, array $facultyCodes): void
    {
        foreach (array_unique($facultyCodes) as $facultyCode) {
            DoctoralCommittee::firstOrCreate(
                ['student_id' => $student->roll_no, 'faculty_id' => $facultyCode],
                ['type' => 'internal']
            );
        }
    }

    /**
     * The IRB committee only, leaving the doctoral committee alone.
     *
     * This is what an import off the office's sheet does, because that sheet
     * lists the two separately and they are not the same people. Putting an IRB
     * member on the doctoral committee is not a tidier record, it is a grant of
     * authority: `doctoral_commitee` is what checkDoctoralCommittee() reads, so
     * it decides who may answer the `doctoral` step of every form chain. It
     * also sets how many approvals an IRB submission waits for
     * (IrbSubController: approvals->count() against doctoralCommittee->count())
     * and how many reviewers each presentation gets. A name added here by
     * mistake stalls the scholar's own forms.
     *
     * The doctoral committee has its own columns on the same sheet and its own
     * path in, through StudentController::syncSupervisionTeam().
     *
     * @param  array<int, int|string>  $facultyCodes
     */
    public static function onTheIrbCommittee(Student $student, array $facultyCodes, ?OutsideExpert $outsideExpert = null): void
    {
        // Additive. A scholar whose IRB is constituted a second time keeps the
        // members they already have, which is why every write is a
        // firstOrCreate: (student, member) is unique, and a plain insert used
        // to abort a whole DORDC approval as "could not be saved".
        foreach (array_unique($facultyCodes) as $facultyCode) {
            IRBCommittee::firstOrCreate(
                ['student_id' => $student->roll_no, 'member_type' => Faculty::class, 'member_id' => $facultyCode],
                ['type' => 'inside']
            );
        }

        if ($outsideExpert) {
            // No login account is made for them: the external review happens
            // through a signed email link (IrbSubForm::sendExternalReviewRequest
            // and ExternalReviewController), attributed to this record.
            IRBCommittee::firstOrCreate(
                ['student_id' => $student->roll_no, 'member_type' => OutsideExpert::class, 'member_id' => $outsideExpert->id],
                ['type' => 'outside']
            );
        }
    }
}

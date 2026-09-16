<?php

namespace App\Models\Concerns;

use App\Models\User;

/**
 * A URF form, approved in turn.
 *
 * The student files it, their mentor reads it, then the ADORDC of their
 * branch's department, then the DORDC, and then it is done. `stage` is the
 * cursor: it names who the form is waiting on, and becomes 'complete' when
 * nobody is left.
 *
 * A rejection is not a verdict on the project. It sends the form back to the
 * student with the reason, and resubmitting starts the reading again from the
 * mentor, because what the ADORDC and DORDC read has changed.
 *
 * The vocabulary is the PhD forms': stage, approvals, comments and a history of
 * every hop. The machinery is not, because a mentor is a relationship rather
 * than a role, and a UG student has no scholar record for those traits to read.
 */
trait UrfApprovable
{
    /** Who reads a form, in the order they read it. */
    public const CHAIN = ['student', 'mentor', 'adordc', 'dordc'];

    public const COMPLETE = 'complete';

    /** The steps that approve rather than file. */
    public const APPROVERS = ['mentor', 'adordc', 'dordc'];

    /** The application every step is about: itself, or the one it belongs to. */
    abstract public function approvalApplication();

    public function isComplete(): bool
    {
        return $this->stage === self::COMPLETE;
    }

    /** The step after $stage, or 'complete' when that was the last one. */
    public static function stageAfter(string $stage): string
    {
        $next = array_search($stage, self::CHAIN, true);

        return $next === false || !isset(self::CHAIN[$next + 1])
            ? self::COMPLETE
            : self::CHAIN[$next + 1];
    }

    /**
     * Which step this user is, on this form, or null when they are none of
     * them. The office is not a step: it reads everything and steps in only
     * where something has gone wrong.
     */
    public function stepFor(User $user): ?string
    {
        $application = $this->approvalApplication();
        if (!$application) {
            return null;
        }

        if ($application->hasMember($user)) {
            return 'student';
        }

        $code = $user->faculty?->faculty_code;
        if ($code && in_array($code, [$application->mentor1_faculty_code, $application->mentor2_faculty_code], false)) {
            return 'mentor';
        }

        $role = $user->current_role?->role;
        if ($role === 'dordc') {
            return 'dordc';
        }

        if ($role === 'adordc') {
            $department = $application->student1Branch?->department_id;
            $theirs = $user->faculty?->adordcDepartments->pluck('id') ?? collect();

            // A branch with no department yet sits with every ADORDC rather
            // than with none, so a form cannot be stranded by a missing link.
            return $department === null || $theirs->contains($department) ? 'adordc' : null;
        }

        return null;
    }

    /** Whether this user is the one the form is actually waiting on. */
    public function awaits(User $user): bool
    {
        return !$this->isComplete() && $this->stepFor($user) === $this->stage;
    }

    /**
     * Record a decision and move the cursor. An approval passes the form on; a
     * rejection sends it back to the student, whose next submission starts the
     * reading again.
     */
    public function recordDecision(User $user, string $step, bool $approved, ?string $comments): void
    {
        $this->{$step . '_approval'} = $approved;
        $this->{$step . '_comments'} = $comments;

        if ($approved) {
            $this->stage = self::stageAfter($step);
        } else {
            $this->stage = 'student';
            // What the later steps approved was the form as it stood. The
            // student is about to change it, so those approvals are spent.
            foreach (self::APPROVERS as $approver) {
                $this->{$approver . '_approval'} = false;
            }
        }

        $this->addHistory($user, $step, $approved, $comments);
        $this->save();
    }

    /** Back to the mentor, for a student who has just resubmitted. */
    public function backToTheStartOfTheChain(User $user): void
    {
        $this->stage = 'mentor';
        $this->addHistory($user, 'student', true, null);
        $this->save();
    }

    private function addHistory(User $user, string $step, bool $approved, ?string $comments): void
    {
        $history = $this->history ?? [];
        $history[] = [
            'step' => $step,
            'by' => $user->name(),
            'approved' => $approved,
            'comments' => $comments,
            'at' => now()->toIso8601String(),
        ];
        $this->history = $history;
    }
}

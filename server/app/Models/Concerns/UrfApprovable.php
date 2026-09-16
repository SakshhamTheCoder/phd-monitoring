<?php

namespace App\Models\Concerns;

use App\Models\User;

/**
 * A URF form, read in turn: `stage` names who it is waiting on, and becomes
 * 'complete' when nobody is left.
 *
 * The vocabulary is the PhD forms', but not the machinery: a mentor is a
 * relationship rather than a role, and a UG student has no scholar record for
 * those traits to read.
 */
trait UrfApprovable
{
    public const CHAIN = ['student', 'mentor', 'adordc', 'dordc'];

    public const COMPLETE = 'complete';

    public const APPROVERS = ['mentor', 'adordc', 'dordc'];

    abstract public function approvalApplication();

    public function isComplete(): bool
    {
        return $this->stage === self::COMPLETE;
    }

    public static function stageAfter(string $stage): string
    {
        $next = array_search($stage, self::CHAIN, true);

        return $next === false || !isset(self::CHAIN[$next + 1])
            ? self::COMPLETE
            : self::CHAIN[$next + 1];
    }

    /** Which step this user is on this form. The office is not a step. */
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

    public function awaits(User $user): bool
    {
        return !$this->isComplete() && $this->stepFor($user) === $this->stage;
    }

    /** 'approve' passes it on, 'send_back' returns it to the student, 'reject' ends it. */
    public function recordDecision(User $user, string $step, string $decision, ?string $comments): void
    {
        $this->{$step . '_approval'} = $decision === 'approve';
        $this->{$step . '_comments'} = $comments;

        if ($decision === 'approve') {
            $this->stage = self::stageAfter($step);
        } elseif ($decision === 'reject') {
            $this->stage = self::COMPLETE;
        } else {
            $this->stage = 'student';
            // What the later steps approved was the form as it stood. The
            // student is about to change it, so those approvals are spent.
            foreach (self::APPROVERS as $approver) {
                $this->{$approver . '_approval'} = false;
            }
        }

        $this->addHistory($user, $step, $decision, $comments);
        $this->save();
    }

    public function closeChain(User $user, string $decision): void
    {
        $this->stage = self::COMPLETE;
        $this->addHistory($user, 'office', $decision, null);
        $this->save();
    }

    public function backToTheStartOfTheChain(User $user): void
    {
        $this->stage = 'mentor';
        $this->addHistory($user, 'student', 'submitted', null);
        $this->save();
    }

    private function addHistory(User $user, string $step, string $decision, ?string $comments): void
    {
        $history = $this->history ?? [];
        $history[] = [
            'step' => $step,
            'by' => $user->name(),
            'decision' => $decision,
            'comments' => $comments,
            'at' => now()->toIso8601String(),
        ];
        $this->history = $history;
    }
}

<?php

namespace App\Pages;

use App\Forms\Field;
use App\Models\User;
use App\Support\Navigation;

/**
 * Supervisor and doctoral committee change approvals: the changes HoDs and
 * PhD coordinators propose, approved or rejected with a reason.
 */
final class SupervisorApprovalsPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'supervisorApprovals');
    }

    public function view(User $user, array $params = []): array
    {
        return self::page('Supervisor and doctoral committee change approvals', 'Review and approve/reject pending change requests from HOD and PhD coordinators.', [
            'table' => [
                'kind' => 'local',
                'endpoint' => '/supervisor-doctoral-changes/pending',
                // Drawn in a panel of its own, with a way to read it again.
                'panel' => ['title' => 'Pending changes', 'refresh' => 'Refresh'],
                'quiet' => true,
                'loading' => 'Loading pending changes',
                'failed' => 'Could not load the pending changes. Check your connection and try again.',
                'empty_title' => 'No pending changes to review',
                'inline' => true,
                'columns' => [
                    ['key' => 'student_name', 'title' => 'Student', 'empty' => 'Unknown'],
                    ['key' => 'student_roll_no', 'title' => 'Roll no', 'empty' => 'N/A'],
                    ['key' => 'department', 'title' => 'Department', 'empty' => 'N/A'],
                    ['key' => 'change', 'title' => 'Change description'],
                    ['key' => 'reason', 'title' => 'Reason', 'empty' => 'N/A'],
                    ['key' => 'requested_by', 'title' => 'Requested by', 'empty' => 'Unknown'],
                    ['key' => 'requested_at', 'title' => 'Requested date', 'format' => 'date'],
                ],
                'actions' => [
                    // The row's buttons stay off until the server answers, so a
                    // second press cannot send the decision twice.
                    ['label' => 'Approve', 'request' => [
                        'method' => 'PUT',
                        'path' => '/supervisor-doctoral-changes/approve/{id}',
                        'confirm' => 'Are you sure you want to approve this change?',
                        'done' => 'Change approved successfully',
                        'failed' => 'Failed to approve change',
                        'loader' => false,
                    ]],
                    ['label' => 'Reject', 'danger' => true, 'opens' => 'reject'],
                ],
            ],
            'dialogs' => [
                'reject' => $this->dialog([], [
                    self::heading('Reject change request', level: 3),
                    ['kind' => 'lines', 'class_name' => 'modal-note', 'lines' => [
                        ['label' => 'Student', 'key' => 'student_name'],
                        ['label' => 'Change', 'key' => 'change'],
                        ['label' => 'Requested by', 'key' => 'requested_by'],
                    ]],
                    Field::text('Reason for rejection')->key('rejection_reason')->value('')
                        ->hint('Please provide a reason for rejecting this change request...')->required()->open(),
                    self::buttons(
                        Field::submit('Reject change')->requiresFilled(['rejection_reason'], 'Please provide a reason for rejection')
                            ->with(['variant' => 'danger', 'held_while_sending' => true]),
                    ),
                ], [
                    'method' => 'PUT',
                    'path' => '/supervisor-doctoral-changes/reject/{id}',
                    'done' => 'Change rejected successfully',
                    'failed' => 'Failed to reject change',
                    'loader' => false,
                ]),
            ],
        ]);
    }
}

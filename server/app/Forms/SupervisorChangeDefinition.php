<?php

namespace App\Forms;

/**
 * A scholar asks to change one or more supervisors and names three they would
 * like instead; the PhD coordinator allots the new ones. The checks on who may
 * be named (three different faculty, only current supervisors changed, no one
 * who already supervises) stay in SupervisorChangeFormController.
 */
final class SupervisorChangeDefinition extends FormDefinition
{
    private const FACULTY = '/suggestions/faculty';

    public function title(): string
    {
        return 'Supervisor change';
    }

    // The coordinator's panel was drawn straight into its step.
    protected function unwrapped(): array
    {
        return ['phd_coordinator'];
    }

    protected function panels(array $data): array
    {
        $supervisors = self::plain($data['supervisors'] ?? []) ?? [];
        $toChange = self::plain($data['to_change'] ?? []) ?? [];
        $preferences = self::plain($data['prefrences'] ?? []) ?? [];
        $allotted = self::plain($data['new_supervisors'] ?? []) ?? [];

        // A form sent back is resubmitted as it was, so three slots are always
        // there to send, empty ones as null.
        $preferenceCodes = array_map(fn ($preference) => $preference['faculty_code'] ?? null, $preferences);
        $preferenceCodes = array_pad($preferenceCodes, 3, null);
        $allottedCodes = array_map(fn ($supervisor) => $supervisor['faculty_code'] ?? null, $allotted) ?: [null];

        $names = ['name' => 'Supervisor name', 'department' => 'Department'];

        return [
            'student' => [
                self::row([
                    Field::text('Roll number')->value($data['roll_no'] ?? null),
                    Field::text('Name')->value($data['name'] ?? null),
                ]),
                self::row([
                    Field::text('Date of admission')->value($data['date_of_registration'] ?? null)->format('date'),
                ]),
                self::row([
                    Field::text('Email')->value($data['email'] ?? null),
                    Field::text('Mobile number')->value($data['phone'] ?? null),
                ]),
                self::row([
                    Field::text('IRB completed')->value(!empty($data['irb_submitted']) ? 'Yes' : 'No'),
                ]),
                self::row([
                    Field::text('Title of PhD thesis')->value($data['phd_title'] ?? null),
                ], space: 2),
                self::row(self::supervisorFields($supervisors)),
                self::row([
                    Field::text('Date of allocation of supervisor')->value(self::plain($data['date_of_allocation'] ?? null))->format('date'),
                ]),
                self::row([
                    Field::text('Reason for supervisor change')
                        ->key('reason')
                        ->required()
                        ->editableBy('student')
                        ->rules('required|string')
                        ->value($data['reason'] ?? null),
                ], space: 2),
                Field::toggles('Select supervisors to change', array_map(
                    fn ($supervisor) => ['value' => $supervisor['faculty_code'] ?? null, 'title' => $supervisor['name'] ?? null],
                    $supervisors
                ))
                    ->key('to_change')
                    ->editableBy('student')
                    ->onlyWhile('editing', 'student')
                    ->rules('required|array')
                    ->value(array_values(array_filter(array_column($toChange, 'faculty_code')))),
                Field::list('Select 3 tentative names of supervisors (in order)')
                    ->key('prefrences')
                    ->editableBy('student')
                    ->onlyWhile('editing', 'student')
                    ->rules('required|array')
                    ->value($preferenceCodes)
                    ->with([
                        'fixed' => true,
                        'item' => 'suggest',
                        'item_label' => 'Preference',
                        'source' => self::FACULTY,
                        'displays' => array_map(fn ($index) => $preferences[$index]['name'] ?? null, array_keys($preferenceCodes)),
                    ]),
                self::row([
                    Field::submit('Submit')->editableBy('student'),
                ]),
                self::row([
                    Field::table('', $names, $toChange)->onlyWhile('reading', 'student'),
                ], space: 3, label: 'Supervisor(s) to be changed'),
                self::row([
                    Field::table('', $names, $preferences)->onlyWhile('reading', 'student'),
                ], space: 3, label: 'Student preferences'),
            ],
            'phd_coordinator' => [
                Field::list('Allot supervisors')
                    ->key('new_supervisors')
                    ->editableBy('phd_coordinator')
                    ->onlyWhile('editing', 'phd_coordinator')
                    ->rules('required|array')
                    ->value($allottedCodes)
                    ->with([
                        'item' => 'suggest',
                        'item_label' => 'Supervisor',
                        'add_label' => 'Add supervisor',
                        'source' => self::FACULTY,
                        'displays' => array_map(fn ($supervisor) => $supervisor['name'] ?? null, $allotted),
                    ]),
                // The coordinator's step has no recommendation of its own:
                // allotting is the approval.
                self::row([
                    Field::submit('Submit')->editableBy('phd_coordinator')->sends(['approval' => true]),
                ]),
                self::row([
                    Field::table('', ['name' => 'Name', 'department' => 'Department'], $allotted)->onlyWhile('reading', 'phd_coordinator'),
                ], space: 3, label: 'Supervisors allocated by PhD Coordinator'),
            ],
        ];
    }
}

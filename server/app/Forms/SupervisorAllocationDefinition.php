<?php

namespace App\Forms;

/**
 * The scholar's broad areas and six preferred supervisors, and the PhD
 * coordinator's allotment. The checks on either (six different faculty, no
 * one allotted twice, the longer chain for three or more supervisors) stay in
 * SupervisorAllocationController.
 */
final class SupervisorAllocationDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'Supervisor allocation';
    }

    // The coordinator's panel was drawn straight into its step.
    protected function unwrapped(): array
    {
        return ['phd_coordinator'];
    }

    protected function panels(array $data): array
    {
        $allotted = self::plain($data['supervisors'] ?? []) ?? [];

        return [
            // Recommendations fetched as the scholar types their areas, which
            // fill the preference boxes; see SupervisorPreferences on the web.
            'student' => self::custom('supervisor-preferences'),
            'phd_coordinator' => [
                Field::list('Allot supervisors')
                    ->key('supervisors')
                    ->editableBy('phd_coordinator')
                    ->onlyWhile('editing', 'phd_coordinator')
                    ->rules('required|array')
                    ->value(array_map(fn ($supervisor) => $supervisor['faculty_code'] ?? null, $allotted) ?: [null])
                    ->with([
                        'item' => 'suggest',
                        'item_label' => 'Supervisor',
                        'add_label' => 'Add supervisor',
                        'source' => '/suggestions/faculty',
                        'shows' => ['name', 'department'],
                        'displays' => array_map(fn ($supervisor) => $supervisor['name'] ?? null, $allotted),
                    ]),
                // Allotting is the coordinator's approval.
                self::row([
                    Field::submit('Submit')->editableBy('phd_coordinator')->sends(['approval' => true]),
                ]),
                self::row([
                    Field::table('', ['name' => 'Name', 'department' => 'Department', 'supervised_campus' => 'Students supervised'], $allotted)
                        ->onlyWhile('reading', 'phd_coordinator'),
                ], space: 3, label: 'Supervisors allocated by PhD Coordinator'),
            ],
        ];
    }
}

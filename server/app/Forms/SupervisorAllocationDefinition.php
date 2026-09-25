<?php

namespace App\Forms;

/**
 * The scholar's broad areas and six preferred supervisors, with supervisors
 * recommended for the areas as they are typed, and the PhD coordinator's
 * allotment. The checks on either (six different faculty, no
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

    private function scholar(array $data): array
    {
        // The scholar answers while the form is at their step and unsent.
        $editing = self::mayEdit($data, 'student') && ($data['stage'] ?? null) === 'student';
        $preferences = array_slice(self::plain($data['prefrences'] ?? []) ?? [], 0, 6);
        $codes = array_pad(array_map(fn ($preference) => $preference['faculty_code'] ?? null, $preferences), 6, null);
        $labels = array_map(
            fn ($index) => implode(' - ', array_filter([$preferences[$index]['name'] ?? '', $preferences[$index]['department'] ?? ''])),
            range(0, 5)
        );
        $areas = self::plain($data['broad_area_of_research'] ?? []) ?? [];

        return [
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
            // The scholar's own words; the department's areas are only offered.
            Field::list('Select 3 broad areas of research')
                ->key('broad_area_of_research')
                ->editableBy('student')
                ->lockedIf(!$editing)
                ->rules('required|array', 'nullable|string|max:255')
                ->value($areas)
                ->with([
                    'fixed' => true,
                    'slots' => 3,
                    'per_row' => 1,
                    'row_space' => 2,
                    'item' => 'suggest',
                    'free' => true,
                    'item_show_label' => false,
                    'source' => '/suggestions/specialization',
                ]),
            Field::recommender('Recommended supervisors (top 8)', '/faculty/recommend', 'broad_area_of_research', 'prefrences', [
                'department_id' => $data['department_id'] ?? null,
            ])
                ->onlyIf($editing)
                ->with([
                    'note' => 'Based on your broad areas. Free choice: pick anyone or use recommended.',
                    'empty_with_areas' => 'No strong matches yet. Try adding clearer areas or pick manually.',
                    'empty_without_areas' => 'Select your 3 broad areas above to see recommendations.',
                    'picked' => 'Preference {n} set to {name}',
                ]),
            Field::list('Select 6 tentative names of supervisors (in order)')
                ->key('prefrences')
                ->editableBy('student')
                ->onlyIf($editing)
                // Six different faculty, checked by the controller.
                ->rules('required|array', 'nullable|integer')
                ->value($codes)
                ->with([
                    'fixed' => true,
                    'per_row' => 3,
                    'item' => 'suggest',
                    'item_label' => 'Preference',
                    'source' => '/suggestions/faculty',
                    'shows' => ['name', 'department'],
                    'displays' => $labels,
                    'unique' => true,
                    'unique_message' => 'This faculty already selected in another slot',
                ]),
            self::row([
                Field::submit('Submit')->editableBy('student')->onlyIf($editing),
            ]),
            self::row([
                Field::table('', ['name' => 'Supervisor name', 'email' => 'Email', 'department' => 'Department'], self::plain($data['prefrences'] ?? []) ?? [])
                    ->onlyIf(!$editing),
            ], space: 3, label: 'Student preferences'),
        ];
    }

    protected function panels(array $data): array
    {
        $allotted = self::plain($data['supervisors'] ?? []) ?? [];

        return [
            'student' => $this->scholar($data),
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

<?php

namespace App\Forms;

/**
 * The scholar's panel of the revise-title form, and what every approver reads
 * above their own recommendation.
 *
 * The current title and objectives stay on the profile until the DORDC
 * approves (ReviseTitleController::applyRevision); this form only carries the
 * proposed ones until then.
 */
final class ReviseTitleDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'Revise title or objectives';
    }

    protected function panels(array $data): array
    {
        $current = collect($data['objectives'] ?? [])->values()->all();
        $revised = $data['revised_objectives'] ?? [];
        $asRows = fn (array $objectives) => array_map(fn ($objective) => ['objective' => $objective], $objectives);

        return [
            'student' => [
                self::row([
                    Field::text('Roll number')->value($data['roll_no'] ?? null),
                    Field::text('Name')->value($data['name'] ?? null),
                    Field::text('Date of revised IRB')->value($data['date_of_irb'] ?? null)->format('date'),
                ]),
                self::row([
                    Field::text('Date of admission')->value($data['date_of_registration'] ?? null)->format('date'),
                    Field::text('Department')->value($data['department'] ?? null),
                    Field::text('Current status')->value($data['current_status'] ?? null),
                ]),
                self::row([
                    Field::text('Address of correspondence')->value($data['address'] ?? null),
                ], space: 2),
                self::row([
                    Field::text('Current title of PhD thesis')->value($data['phd_title'] ?? null),
                ], space: 2),
                self::row([
                    Field::table('Current objectives', ['objective' => 'Objective'], $asRows($current)),
                ], space: 3),
                self::row([
                    Field::text('Revised title of PhD thesis')
                        ->key('revised_title')
                        ->required()
                        ->editableBy('student')
                        ->rules('required|string|max:1000')
                        ->value($data['revised_title'] ?? null)
                        // A form sent back keeps what was proposed; a new one
                        // starts from the current title, since most revisions
                        // change a few words.
                        ->draft(self::firstFilled($data['revised_title'] ?? null, $data['phd_title'] ?? null) ?? ''),
                ], space: 2),
                Field::list('Revised objectives')
                    ->key('revised_objectives')
                    ->required()
                    ->editableBy('student')
                    ->rules('required|array|min:1', 'required|string|max:2000')
                    ->value($revised)
                    ->draft(self::firstFilled($revised, $current) ?? [''])
                    ->with([
                        'item_label' => 'Revised objective',
                        'add_label' => 'Add objective',
                        'column' => 'Objective',
                        'each' => 3,
                        'note' => 'Clear a box to drop that objective.',
                    ]),
                self::row([
                    Field::submit('Submit revision')->editableBy('student'),
                ]),
            ],
        ];
    }
}

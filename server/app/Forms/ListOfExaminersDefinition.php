<?php

namespace App\Forms;

/**
 * The supervisor's national and international examiners for the thesis, the
 * DoRDC's decision on each, and the Director's approval. The chain starts at
 * the supervisor, so the scholar's details head the form as a section of
 * their own.
 *
 * The supervisor searches, adds through a dialog and removes saved examiners
 * at once (the examiners block); the DoRDC accepts or rejects each row.
 * ListOfExaminersController checks what they send.
 */
final class ListOfExaminersDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'List of examiners';
    }

    protected function lead(array $data): ?array
    {
        return [
            'title' => 'Student',
            'rows' => [
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
                    Field::table('', ['name' => 'Name', 'department' => 'Department', 'designation' => 'Designation'], self::plain($data['supervisors'] ?? []) ?? []),
                ], space: 2, label: 'Supervisors'),
            ],
        ];
    }

    // The DoRDC's panel was drawn straight into its step.
    protected function unwrapped(): array
    {
        return ['dordc'];
    }

    // The Director may send the list back as well as approve it.
    protected function stepOptions(): array
    {
        return ['director' => ['allow_rejection' => true]];
    }

    /**
     * The supervisor's national and international examiners. The DoRDC reads
     * the same lists in their own panel, so the tables are left out for them.
     */
    private function nominations(array $data): array
    {
        $editing = self::mayEdit($data, 'faculty');
        $list = fn (string $key, string $type) => Field::examiners(
            "$type examiners",
            '/suggestions/examiner',
            '/forms/list-of-examiners/' . ($data['form_id'] ?? '') . '/examiners/{id}',
            ['national', 'international']
        )
            ->key($key)
            ->editableBy('faculty')
            ->value(self::plain($data[$key] ?? []) ?? [])
            ->with([
                'add_label' => 'Add new ' . strtolower($type) . ' examiner',
                'editable' => $editing,
                'table' => ($data['role'] ?? null) !== 'dordc',
            ]);

        return [
            $list('national', 'National'),
            $list('international', 'International'),
            // The examiners' details are checked by the controller.
            self::row([
                Field::submit('Submit')->editableBy('faculty'),
            ]),
        ];
    }

    /**
     * The DoRDC accepts or rejects each examiner, while the form is at their
     * step; anyone else, or later, sees nothing here.
     */
    private function decisions(array $data): array
    {
        if (($data['role'] ?? null) !== 'dordc' || ($data['stage'] ?? null) !== 'dordc') {
            return [];
        }
        $national = self::plain($data['national'] ?? []) ?? [];
        $international = self::plain($data['international'] ?? []) ?? [];
        $all = array_merge($national, $international);
        $ids = fn (string $decision) => array_values(array_map(
            fn ($row) => $row['id'],
            array_filter($all, fn ($row) => ($row['recommendation'] ?? null) === $decision)
        ));
        $columns = ['name' => 'Name', 'email' => 'Email', 'department' => 'Department', 'designation' => 'Designation', 'institution' => 'Institution'];
        $table = fn (array $rows) => Field::decisions('', $columns, $rows, 'approvals', 'rejections', 'Status')
            ->editableBy('dordc')
            ->value($ids('approved'))
            ->with(['rejected' => $ids('rejected')]);

        return [
            self::group([
                self::row([$table($national)], space: 3, label: 'National examiners'),
                self::row([$table($international)], space: 3, label: 'International examiners'),
            ], className: 'reveal'),
            // Deciding is the DoRDC's approval.
            self::row([
                Field::submit('Submit')->editableBy('dordc')->sends(['approval' => true]),
            ]),
        ];
    }

    protected function panels(array $data): array
    {
        return [
            'faculty' => $this->nominations($data),
            'dordc' => $this->decisions($data),
        ];
    }
}

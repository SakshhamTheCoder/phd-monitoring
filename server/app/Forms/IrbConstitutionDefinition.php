<?php

namespace App\Forms;

/**
 * Constitution of the Institute Research Board: the scholar's proposal, the
 * supervisor's three cognate nominees, the HOD's outside and chairman's
 * experts, and the DoRDC's pick of one of each.
 *
 * Only the scholar's answers are checked from here. The supervisor, HOD and
 * DoRDC answer inside a recommendation, and ConstituteOfIRBController checks
 * their picks only when they recommend, so those rules stay there.
 */
final class IrbConstitutionDefinition extends FormDefinition
{
    private const NOMINEES = 'List of nominees of the DoRDC in cognate area from the institute';
    private const OUTSIDE = 'List of 3 outside experts proposed by the HOD';
    private const CHAIRMAN = 'Expert(s) recommended by chairman board of the studies of concerned department in cognate area of department:';

    public function title(): string
    {
        return 'Constitution of Institute Research Board';
    }

    // Every panel of this form was drawn straight into its step.
    protected function unwrapped(): array
    {
        return ['student', 'faculty', 'hod', 'dordc'];
    }

    /**
     * An IRB constituted before the portal. The form exists because other
     * checks read it, but nobody answered a step in it, so the known facts are
     * shown instead of a chain of blank recommendations.
     */
    protected function summary(array $data): ?array
    {
        if (empty($data['carried_over_at'])) {
            return null;
        }
        $expert = self::plain($data['outside_expert'] ?? null);

        return [
            'note' => (!empty($data['date_of_irb'])
                    ? 'This IRB was constituted on {date_of_irb}, before the portal.'
                    : 'This IRB was constituted before the portal.')
                . " The record was brought in from the office's sheet on {carried_over_at}, so no step here was answered.",
            'dates' => [
                'date_of_irb' => $data['date_of_irb'] ?? null,
                'carried_over_at' => $data['carried_over_at'],
            ],
            'rows' => array_values(array_filter([
                self::row([
                    Field::table('', ['name' => 'Name', 'designation' => 'Designation', 'email' => 'Email'], self::plain($data['doctoral'] ?? []) ?? []),
                ], space: 3, label: 'Committee'),
                $expert ? self::row([
                    Field::table('', ['name' => 'Name', 'designation' => 'Designation', 'institution' => 'Institution', 'email' => 'Email'], [$expert]),
                ], space: 3, label: 'External expert') : null,
            ])),
        ];
    }

    protected function panels(array $data): array
    {
        return [
            'student' => $this->scholar($data),
            'faculty' => $this->supervisor($data),
            'hod' => $this->hod($data),
            'dordc' => $this->dordc($data),
        ];
    }

    private function scholar(array $data): array
    {
        $storedPdf = $data['irb_pdf'] ?? null;
        $objectives = self::plain($data['objectives'] ?? null);
        $subdomains = self::plain($data['subdomains'] ?? null);
        // Everyone but the scholar reads the lists as tables.
        $listsAs = ($data['role'] ?? null) === 'student' ? 'inputs' : 'table';
        $anyReaderOpen = self::mayEdit($data, 'student', anyReader: true);

        return [
            self::row([
                Field::text('Date of form submission')->value(self::plain($data['created_at'] ?? null))->format('date'),
                Field::text('Date of admission')->value($data['date_of_registration'] ?? null)->format('date'),
            ]),
            self::row([
                Field::text('Roll number')->value($data['roll_no'] ?? null),
                Field::text('Name')->value($data['name'] ?? null),
            ]),
            self::row([
                Field::text('Department')->value($data['department'] ?? null),
                // Asked for only while the scholar's profile has none.
                Field::select('Gender', ['Male', 'Female'])
                    ->key('gender')
                    ->required()
                    ->editableBy('student', anyReader: true)
                    ->rules((empty($data['gender']) ? 'required' : 'nullable') . '|string|in:Male,Female')
                    ->value($data['gender'] ?? null),
            ]),
            self::row([
                Field::text('Chairman, Board of Studies of the concerned department')->value($data['chairman']['name'] ?? null),
            ], space: 2),
            self::row(self::supervisorFields(self::plain($data['supervisors'] ?? []) ?? [])),
            self::row([
                Field::text('CGPA')
                    ->key('cgpa')
                    ->required()
                    ->editableBy('student', anyReader: true)
                    ->rules((empty($data['cgpa']) ? 'required' : 'nullable') . '|numeric')
                    ->value($data['cgpa'] ?? null),
            ]),
            self::row([
                Field::text('Address of correspondence')
                    ->key('address')
                    ->required()
                    ->editableBy('student', anyReader: true)
                    ->rules('required|string')
                    ->value($data['address'] ?? null),
            ], space: 2),
            self::row([
                Field::text('Title of PhD thesis')
                    ->key('title')
                    ->required()
                    ->editableBy('student', anyReader: true)
                    ->rules('required|string')
                    ->value($data['phd_title'] ?? null),
            ], space: 2),
            self::row([
                // The scholar's own words; the department's areas are offered
                // only as a start.
                Field::suggest('Broad area of research', '/suggestions/specialization')
                    ->key('broad_area_of_research')
                    ->required()
                    ->free()
                    ->hint('Type your broad area of research')
                    ->editableBy('student', anyReader: true)
                    ->rules('nullable|string|max:255')
                    ->display($data['broad_area_of_research'] ?? null)
                    ->value(($data['broad_area_of_research'] ?? null) ?: null),
            ], space: 2),
            Field::list('Objectives of research')
                ->key('objectives')
                ->required()
                ->editableBy('student', anyReader: true)
                ->rules('required|array')
                ->value($objectives ?? [])
                ->with([
                    'add_label' => 'Add objective',
                    'addable' => $anyReaderOpen,
                    'item_hint' => 'Enter objective {n} here',
                    'each' => 3,
                    'as' => $listsAs,
                    'table' => ['space' => 2, 'labelled' => false, 'keep_add_row' => true],
                    'column' => 'Objective',
                ]),
            Field::list('Subdomain')
                ->key('subdomains')
                ->editableBy('student', anyReader: true)
                ->rules('nullable|array', 'string')
                ->value($subdomains ?? [])
                ->with([
                    'item' => 'suggest',
                    'free' => true,
                    'source' => '/suggestions/subdomain',
                    'item_show_label' => false,
                    'item_hint' => 'Enter keyword {n}',
                    'add_label' => 'Add subdomain',
                    'addable' => $anyReaderOpen,
                    'each' => 1,
                    'as' => $listsAs,
                    'table' => ['space' => 2, 'labelled' => false, 'keep_add_row' => true],
                    'column' => 'Subdomain',
                ]),
            self::row([
                // A resubmission keeps the stored PDF unless a new one comes.
                Field::file('')
                    ->key('irb_pdf')
                    ->required(!$storedPdf)
                    ->hideLabel()
                    ->editableBy('student', anyReader: true)
                    ->lockedIf(($data['form_type'] ?? null) === 'revised')
                    ->rules(($storedPdf ? 'nullable' : 'required') . '|file|mimes:pdf|max:20480')
                    ->value($storedPdf),
            ], label: 'Upload IRB PDF file'),
            self::row([
                Field::submit('Submit')->editableBy('student'),
            ]),
        ];
    }

    private function supervisor(array $data): array
    {
        $nominees = self::plain($data['nominee_cognates'] ?? []) ?? [];
        $codes = array_map(fn ($nominee) => $nominee['faculty_code'] ?? null, $nominees);
        // Three unpicked boxes until three are on record.
        if (count($codes) !== 3 || $codes[0] === null) {
            $codes = [-1, -1, -1];
        }
        $answered = !self::mayEdit($data, 'faculty', anyReader: true);

        return [
            $answered && count($nominees) === 3
                ? self::row([
                    Field::table('', ['name' => 'Name', 'department' => 'Department', 'designation' => 'Designation'], $nominees),
                ], space: 3, label: self::NOMINEES)
                : Field::list(self::NOMINEES)
                    ->key('nominee_cognates')
                    ->editableBy('faculty', anyReader: true)
                    ->value($codes)
                    ->with([
                        'fixed' => true,
                        'item' => 'suggest',
                        'source' => '/suggestions/faculty',
                        'shows' => ['name', 'department'],
                        'item_show_label' => false,
                        'displays' => array_map(fn ($index) => $nominees[$index]['name'] ?? null, [0, 1, 2]),
                    ]),
            // Nominating is the supervisor's approval.
            self::row([
                Field::submit('Submit')->editableBy('faculty')->sends(['approval' => true]),
            ]),
        ];
    }

    private function hod(array $data): array
    {
        $outside = self::plain($data['outside_experts'] ?? []) ?? [];
        $outsideIds = array_map(fn ($expert) => $expert['id'] ?? null, $outside);
        if (count($outsideIds) !== 3 || $outsideIds[0] === null) {
            $outsideIds = [-1, -1, -1];
        }
        $chairman = self::plain($data['chairman_experts'] ?? []) ?? [];
        $chairmanCodes = array_map(fn ($expert) => $expert['faculty_code'] ?? null, $chairman);
        if (!$chairmanCodes || $chairmanCodes[0] === null) {
            $chairmanCodes = [-1];
        }
        $answered = !self::mayEdit($data, 'hod', anyReader: true);

        return [
            Field::recommendation('hod')
                ->editableBy('hod')
                ->value(self::stepAnswered($data, 'hod') ? ($data['approvals']['hod'] ?? null) : null)
                ->with(['sends_comments' => true, 'comments' => $data['comments']['hod'] ?? null]),
            // Kept on the page while hidden, so picks made before a change of
            // mind are still the ones on screen.
            self::group([
                $answered && count($outside) === 3
                    ? self::row([
                        Field::table('', ['name' => 'Name', 'institution' => 'Institution', 'department' => 'Department', 'designation' => 'Designation'], $outside),
                    ], space: 3, label: self::OUTSIDE)
                    : Field::list(self::OUTSIDE)
                        ->key('outside_experts')
                        ->editableBy('hod', anyReader: true)
                        ->value($outsideIds)
                        ->with([
                            'fixed' => true,
                            'item' => 'suggest',
                            'source' => '/suggestions/outside-expert',
                            'item_show_label' => false,
                            'displays' => array_map(fn ($index) => $outside[$index]['name'] ?? null, [0, 1, 2]),
                        ]),
                $answered
                    ? self::row([
                        Field::table('', ['name' => 'Name', 'department' => 'Department', 'designation' => 'Designation'], $chairman),
                    ], space: 3, label: self::CHAIRMAN)
                    : Field::list(self::CHAIRMAN)
                        ->key('chairman_experts')
                        ->editableBy('hod', anyReader: true)
                        ->value($chairmanCodes)
                        ->with([
                            'item' => 'suggest',
                            'item_label' => 'Expert',
                            'source' => '/suggestions/faculty',
                            'params' => ['department_id' => $data['department_id'] ?? null],
                            'displays' => array_map(fn ($expert) => $expert['name'] ?? null, $chairman),
                            'add_label' => 'Add expert',
                            'addable' => !$answered,
                            'keep_add_slot' => true,
                            'max' => 2,
                            'max_message' => 'You can only add max 2 experts',
                            'as' => 'inputs',
                        ]),
            ], hiddenUnless: 'approval'),
            self::row([
                Field::submit('Submit')
                    ->editableBy('hod')
                    ->requires('approval', 'Choose Recommend or Not Recommend first.'),
            ]),
        ];
    }

    private function dordc(array $data): array
    {
        $cognate = self::plain($data['cognate_expert'] ?? null);
        $expert = self::plain($data['outside_expert'] ?? null);
        $picked = function (Field $field, ?array $choice, string $idKey) {
            return $choice ? $field->display($choice['name'] ?? null)->value($choice[$idKey] ?? null) : $field;
        };

        return [
            Field::recommendation('dordc')
                ->editableBy('dordc')
                ->value(self::stepAnswered($data, 'dordc') ? ($data['approvals']['dordc'] ?? null) : null)
                ->with([
                    'sends_comments' => true,
                    'comments' => $data['comments']['dordc'] ?? null,
                    'is_locked' => !self::mayEdit($data, 'dordc'),
                ]),
            // The two nominations are asked for, and checked, only on Recommend.
            self::group([
                self::row([
                    $picked(Field::select('Nominee of the DoRDC in the cognate area, from the institute', array_map(
                        fn ($nominee) => ['value' => $nominee['faculty_code'] ?? null, 'title' => $nominee['name'] ?? null],
                        self::plain($data['nominee_cognates'] ?? []) ?? []
                    ))->key('cognate_expert')->required()->editableBy('dordc'), $cognate, 'faculty_code'),
                ]),
                self::row([
                    $picked(Field::select('Expert from the IRB panel of outside experts of the concerned department', array_map(
                        fn ($outside) => ['value' => $outside['id'] ?? null, 'title' => $outside['name'] ?? null],
                        self::plain($data['outside_experts'] ?? []) ?? []
                    ))->key('outside_expert')->required()->editableBy('dordc'), $expert, 'id'),
                ]),
            ], hiddenUnless: 'approval'),
            self::row([
                Field::submit('Submit')
                    ->editableBy('dordc')
                    ->requires('approval', 'Record your recommendation before submitting.')
                    ->requiresWhen('approval', ['cognate_expert', 'outside_expert'], 'Nominate one cognate expert and one outside expert.'),
            ]),
        ];
    }
}

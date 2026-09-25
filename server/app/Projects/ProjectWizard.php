<?php

namespace App\Projects;

use App\Support\ProjectBudget;
use App\Support\ProjectDuration;

/**
 * What the project proposal wizard asks, step by step, and what its review
 * step says about the answers. The page (App\Pages\ProjectWizardPage) sends
 * the steps; ProjectWizardController reviews and saves.
 *
 * The wizard's values keep the names the web form has always used
 * (fundingAgency, coPIs, ...); toProjectBody() turns them into the project
 * endpoint's fields.
 */
final class ProjectWizard
{
    public const CATEGORIES = ['In-house', 'Research', 'Consultancy', 'Industry', 'International', 'Other'];

    // The four the projects table allows. A new project starts Pending.
    public const STATUSES = ['Pending', 'Active', 'On Hold', 'Completed'];

    public const ROLES = ['PI', 'Co-PI'];

    public const MILESTONE_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Delayed'];

    private const EMPTY = 'N/A';

    /** @return array<int, array<string, mixed>> */
    public static function steps(): array
    {
        $options = fn (array $values) => array_map(fn ($value) => ['value' => $value, 'title' => $value], $values);

        return [
            [
                'label' => 'Basic info',
                'title' => 'Step 1: Basic information',
                'description' => 'Initialize your research project by providing the mandatory core administrative details.',
                'blocks' => [['kind' => 'fields', 'fields' => [
                    ['key' => 'title', 'id' => 'create-project-project-title', 'label' => 'Project title', 'input' => 'text', 'required' => true, 'full' => true, 'placeholder' => 'Enter the full formal title of the research project'],
                    ['key' => 'category', 'id' => 'create-project-category', 'label' => 'Category', 'input' => 'select', 'required' => true, 'choose' => 'Select category', 'options' => $options(self::CATEGORIES)],
                    ['key' => 'status', 'id' => 'create-project-status', 'label' => 'Status', 'input' => 'select', 'options' => $options(self::STATUSES)],
                    ['key' => 'fundingAgency', 'id' => 'create-project-funding-agency', 'label' => 'Funding agency', 'input' => 'text', 'required' => true, 'placeholder' => 'e.g. DST, CSIR, ISRO'],
                    ['key' => 'focusArea', 'id' => 'create-project-focus-area', 'label' => 'Focus area', 'input' => 'text', 'placeholder' => 'e.g. AI/ML & IoT'],
                    ['key' => 'grantType', 'id' => 'create-project-grant-type', 'label' => 'Grant type', 'input' => 'text', 'placeholder' => 'e.g. CRG (Core Research Grant)'],
                    ['key' => 'description', 'id' => 'create-project-project-description', 'label' => 'Project description', 'input' => 'textarea', 'full' => true, 'rows' => '4', 'max' => 2000, 'placeholder' => 'Provide a brief abstract or summary of the research objectives and expected outcomes...'],
                    ['key' => 'startDate', 'id' => 'create-project-start-date', 'label' => 'Start date', 'input' => 'date', 'required' => true],
                    // The end date follows from the start and the duration.
                    ['key' => 'durationYears', 'months' => 'durationMonths', 'id' => 'create-project-duration', 'label' => 'Duration', 'input' => 'duration', 'required' => true, 'ends' => ['from' => 'startDate', 'key' => 'endDate']],
                    ['key' => 'endDate', 'id' => 'create-project-end-date', 'label' => 'End date', 'input' => 'date', 'read_only' => true, 'only_if_filled' => true],
                ]]],
            ],
            [
                'label' => 'Team',
                'title' => 'Step 2: PI / Co-PI information',
                'description' => 'Define the project team structure and investigators.',
                'blocks' => [
                    ['kind' => 'pi', 'title' => 'Principal investigator', 'badge' => 'PI', 'none' => 'No faculty record is linked to your account, so no PI can be set.', 'fields' => [
                        ['key' => 'role', 'id' => 'create-project-role-on-this-project', 'label' => 'Role on this project', 'input' => 'select', 'options' => $options(self::ROLES)],
                    ]],
                    ['kind' => 'copis', 'title' => 'Co-investigators', 'add_external' => 'Add external Co-PI', 'search' => ['label' => 'Search internal faculty', 'hint' => 'Type faculty name, code or email...', 'path' => '/suggestions/faculty'], 'external' => [
                        'badge' => 'External partner',
                        'add' => 'Add Co-PI',
                        'fields' => [
                            ['key' => 'name', 'id' => 'create-project-full-name', 'label' => 'Full name', 'input' => 'text', 'placeholder' => 'e.g. Prof. Robert Miller'],
                            ['key' => 'designation', 'id' => 'create-project-designation', 'label' => 'Designation', 'input' => 'text', 'placeholder' => 'e.g. Associate Professor'],
                            ['key' => 'institute', 'id' => 'create-project-institute-organization', 'label' => 'Institute / Organization', 'input' => 'text', 'full' => true, 'placeholder' => 'e.g. MIT, Cambridge'],
                            ['key' => 'email', 'id' => 'create-project-email-address', 'label' => 'Email address', 'input' => 'email'],
                            ['key' => 'mobile', 'id' => 'create-project-mobile-number', 'label' => 'Mobile number', 'input' => 'text'],
                            ['key' => 'website', 'id' => 'create-project-website', 'label' => 'Website', 'input' => 'url', 'full' => true],
                        ],
                    ]],
                ],
            ],
            [
                'label' => 'Budget',
                'title' => 'Step 3: Funding details',
                'description' => 'Configure the project budget and funding breakdown.',
                'blocks' => [
                    ['kind' => 'section', 'title' => 'Funding information', 'blocks' => [['kind' => 'fields', 'fields' => [
                        ['key' => 'fundingAgency', 'id' => 'create-project-funding-agency-2', 'label' => 'Funding agency', 'input' => 'text', 'read_only' => true],
                        ['key' => 'sanctionAmount', 'id' => 'create-project-total-sanctioned-amount', 'label' => 'Total sanctioned amount (₹)', 'input' => 'number', 'step' => '1', 'min' => '0', 'required' => true, 'placeholder' => 'e.g. 4850000'],
                        ['key' => 'tietShare', 'id' => 'create-project-tiet-share', 'label' => 'TIET share (₹)', 'input' => 'number'],
                        ['key' => 'sanctionLetterLink', 'id' => 'create-project-sanction-letter-link', 'label' => 'Sanction letter link', 'input' => 'url', 'placeholder' => 'https://...'],
                        ['key' => 'sanctionLetterFile', 'name_key' => 'sanctionLetterFileName', 'id' => 'create-project-sanction-letter-upload', 'label' => 'Sanction letter upload', 'input' => 'file', 'accept' => '.pdf,.doc,.docx'],
                    ]]]],
                    ['kind' => 'budget'],
                ],
            ],
            [
                'label' => 'Objectives',
                'title' => 'Step 4: Research objectives',
                'description' => 'Define clear, measurable goals and the SDGs this project contributes to.',
                'blocks' => [
                    ['kind' => 'objectives', 'title' => 'Objectives', 'add' => 'Add objective', 'placeholder' => 'To develop ABC so as to improve XYZ.', 'max' => 500],
                    ['kind' => 'sdgs', 'title' => 'Sustainable development goals', 'count' => '{n} selected'],
                ],
            ],
            [
                'label' => 'Milestones',
                'title' => 'Step 5: Project milestones',
                'description' => 'Track timeline and deliverables.',
                'progress' => ['label' => 'Proposal completion', 'suffix' => '% Structured'],
                'blocks' => [
                    ['kind' => 'gantt', 'title' => 'Gantt chart', 'description' => 'The schedule behind the milestones below. PDF, image, spreadsheet or document, up to 10 MB.', 'accept' => '.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx', 'key' => 'ganttFile', 'name_key' => 'ganttFileName'],
                    ['kind' => 'milestones', 'title' => 'Milestones', 'add' => 'Add milestone row', 'columns' => ['Milestone', 'Deliverable', 'Due date', 'Status', 'Action'], 'placeholders' => ['name' => 'e.g. Literature Review', 'deliverable' => 'e.g. Draft Summary Report']],
                ],
            ],
            [
                'label' => 'Review',
                'title' => 'Step 6: Review and submit',
                'description' => 'Review all details before submission.',
                'blocks' => [['kind' => 'review']],
            ],
        ];
    }

    private static function blankMilestone(): array
    {
        return ['name' => '', 'deliverable' => '', 'dueDate' => '', 'status' => 'Not Started'];
    }

    /** A budget with no money in it, for the first three years. */
    private static function emptyBudget(): array
    {
        $years = ['year1', 'year2', 'year3'];
        $lines = (object) array_fill_keys($years, []);
        return array_merge(
            [ProjectBudget::KEY_SUBITEMS => (object) [], ProjectBudget::KEY_MANPOWER => $lines, ProjectBudget::KEY_EQUIPMENT => clone $lines, ProjectBudget::KEY_OTHER => clone $lines, ProjectBudget::KEY_HEADAMT => (object) []],
            array_fill_keys($years, (object) []),
        );
    }

    public static function emptyValues(): array
    {
        return [
            'title' => '', 'category' => '', 'status' => 'Pending', 'role' => 'PI', 'focusArea' => '', 'grantType' => '',
            'fundingAgency' => '', 'description' => '',
            'startDate' => '', 'durationYears' => 1, 'durationMonths' => 0, 'endDate' => '',
            'sdgs' => [],
            'coPIs' => [],
            'sanctionAmount' => '', 'tietShare' => '', 'sanctionLetterLink' => '',
            'sanctionLetterFile' => null, 'sanctionLetterFileName' => '',
            'ganttFile' => null, 'ganttFileName' => '',
            'budget' => self::emptyBudget(),
            'objectives' => [''],
            'milestones' => [self::blankMilestone()],
        ];
    }

    /**
     * A stored project as the wizard's values. `$budget` is the project's
     * budget as decoded objects, so an empty year stays {} rather than [].
     */
    public static function valuesFrom(array $project, mixed $budget): array
    {
        $link = (string) ($project['sanction_letter_link'] ?? '');
        $objectives = $project['objectives'] ?? [];

        return [
            'title' => $project['title'] ?: '',
            'category' => $project['category'] ?: '',
            'status' => $project['status'] ?: 'Pending',
            'role' => $project['role'] ?: 'PI',
            'focusArea' => $project['focus_area'] ?: '',
            'grantType' => $project['grant_type'] ?: '',
            'fundingAgency' => $project['funding_agency'] ?: '',
            'description' => $project['description'] ?: '',
            'startDate' => $project['start_date'] ?: '',
            'durationYears' => $project['duration_years'] ?? 1,
            'durationMonths' => $project['duration_months'] ?: 0,
            'endDate' => $project['end_date'] ?: '',
            'sdgs' => $project['sdgs'] ?: [],
            'coPIs' => $project['co_pis'] ?: [],
            'sanctionAmount' => $project['amount'] !== null ? (string) $project['amount'] : '',
            'tietShare' => $project['tiet_share'] !== null ? (string) $project['tiet_share'] : '',
            // Only an external URL belongs in the link box; a stored file is a path, not a link.
            'sanctionLetterLink' => preg_match('#^https?://#i', $link) ? $link : '',
            'sanctionLetterFile' => null,
            'sanctionLetterFileName' => '',
            'ganttFile' => null,
            'ganttFileName' => $project['gantt_chart_name'] ?: '',
            'budget' => $budget && count((array) $budget) ? $budget : self::emptyBudget(),
            'objectives' => array_map(
                fn ($objective) => is_string($objective) ? $objective : implode(': ', array_filter([$objective['title'] ?? null, $objective['description'] ?? null])),
                $objectives ?: [''],
            ),
            'milestones' => ($project['milestones'] ?? [])
                ? array_map(fn ($m) => ['id' => $m['id'], 'name' => $m['name'], 'deliverable' => $m['deliverable'], 'dueDate' => $m['due_date'], 'status' => $m['status']], $project['milestones'])
                : [self::blankMilestone()],
        ];
    }

    /**
     * The first answer a project cannot be saved without, as the step it is
     * on and what to say. The project endpoint only names a missing field as
     * "Validation failed".
     */
    public static function missing(array $values): ?array
    {
        $labels = array_column(self::steps(), 'label');
        $miss = match (true) {
            trim((string) ($values['title'] ?? '')) === '' => ['the project title', 0],
            ($values['category'] ?? '') === '' => ['a category', 0],
            // Whole rupees: a blank would be saved as 0 and a decimal cut short.
            !preg_match('/^\d+$/', trim((string) ($values['sanctionAmount'] ?? ''))) => ['the total sanctioned amount in whole rupees', 2],
            default => null,
        };
        return $miss ? ['step' => $miss[1], 'message' => "Enter {$miss[0]} on the {$labels[$miss[1]]} step before submitting."] : null;
    }

    /** The wizard's values as the project endpoint's fields. */
    public static function toProjectBody(array $values): array
    {
        $int = fn ($value) => (int) (is_numeric($value) ? $value : (int) $value);

        return [
            'title' => $values['title'] ?? '',
            'category' => $values['category'] ?? '',
            'status' => ($values['status'] ?? '') ?: 'Pending',
            'role' => ($values['role'] ?? '') ?: '',
            'focus_area' => ($values['focusArea'] ?? '') ?: '',
            'grant_type' => ($values['grantType'] ?? '') ?: '',
            'funding_agency' => $values['fundingAgency'] ?? '',
            'description' => $values['description'] ?? '',
            'start_date' => ($values['startDate'] ?? '') ?: null,
            'end_date' => ($values['endDate'] ?? '') ?: null,
            'duration_years' => $int($values['durationYears'] ?? 0),
            'duration_months' => $int($values['durationMonths'] ?? 0),
            'amount' => $int($values['sanctionAmount'] ?? 0),
            'tiet_share' => ($values['tietShare'] ?? '') === '' || ($values['tietShare'] ?? null) === null ? null : $int($values['tietShare']),
            'co_pis' => $values['coPIs'] ?? [],
            'sdgs' => $values['sdgs'] ?? [],
            'objectives' => array_values(array_filter(
                array_map(fn ($o) => is_string($o) ? $o : (string) ($o['title'] ?? ''), $values['objectives'] ?? []),
                fn ($o) => trim($o) !== '',
            )),
            'budget' => $values['budget'] ?? [],
        ];
    }

    /**
     * The review step: every figure phrased and summed here. A date is sent
     * as {date} for the reader's own calendar to print.
     */
    public static function review(array $values, ?array $pi): array
    {
        $years = max(1, min(5, (int) ($values['durationYears'] ?? 1) ?: 1));
        $budgetYears = array_map(fn ($i) => "year{$i}", range(1, $years));
        $budget = is_array($values['budget'] ?? null) ? $values['budget'] : [];
        $yearTotal = fn ($year) => array_sum(array_map(fn ($head) => ProjectBudget::headTotal($budget, $year, $head['head']), ProjectBudget::heads()));
        $milestones = $values['milestones'] ?? [];
        $named = array_values(array_filter($milestones, fn ($m) => ($m['name'] ?? '') !== ''));
        $sdgs = collect(config('sdgs.goals'))->keyBy('id');
        $description = (string) ($values['description'] ?? '');
        $coPis = $values['coPIs'] ?? [];
        $row = fn (string $label, mixed $value, array $extra = []) => ['label' => $label, 'value' => is_array($value) ? $value : [(string) $value]] + $extra;

        return [
            ['title' => 'Basic information', 'full' => true, 'rows' => [
                $row('Title', ($values['title'] ?? '') ?: self::EMPTY),
                $row('Category', ($values['category'] ?? '') ?: self::EMPTY),
                $row('Status', $values['status'] ?? ''),
                $row('Funding agency', ($values['fundingAgency'] ?? '') ?: self::EMPTY),
                $row('Duration', array_merge(
                    [ProjectDuration::format((int) ($values['durationYears'] ?? 0), (int) ($values['durationMonths'] ?? 0))],
                    ($values['startDate'] ?? '') ? [' · ', ['date' => $values['startDate']], ' to ', ['date' => $values['endDate'] ?? '']] : [],
                )),
                $row('SDGs', ($values['sdgs'] ?? []) ? implode(', ', array_filter(array_map(fn ($id) => $sdgs[$id]['label'] ?? null, $values['sdgs']))) : self::EMPTY),
                $row('Description', $description === '' ? self::EMPTY : (mb_strlen($description) > 150 ? mb_substr($description, 0, 150) . '...' : $description), ['value_class' => 'cp-review-long']),
            ]],
            ['title' => 'Team', 'rows' => array_merge(
                [$row('PI', $pi['name'] ?? self::EMPTY), $row('Your role', ($values['role'] ?? '') ?: self::EMPTY)],
                $coPis
                    ? array_map(fn ($c, $i) => $row('Co-PI ' . ($i + 1), "{$c['name']} (" . (($c['type'] ?? '') === 'internal' ? 'Int' : 'Ext') . ')'), $coPis, array_keys($coPis))
                    : [$row('Co-PIs', 'None')],
            )],
            ['title' => 'Funding', 'rows' => array_merge(
                [
                    $row('Sanctioned', '₹' . self::rupees((int) ($values['sanctionAmount'] ?? 0))),
                    $row('TIET share', ($values['tietShare'] ?? '') === '' ? self::EMPTY : '₹' . self::rupees((int) $values['tietShare'])),
                ],
                array_map(fn ($year, $i) => $row('Year ' . ($i + 1) . ' budget', '₹' . self::rupees($yearTotal($year))), $budgetYears, array_keys($budgetYears)),
                [$row('Total budget', '₹' . self::rupees(array_sum(array_map($yearTotal, $budgetYears))))],
            )],
            ['title' => 'Objectives', 'rows' => [
                $row('Objectives', count(array_filter($values['objectives'] ?? [], fn ($o) => trim((string) $o) !== '')) . ' listed'),
            ]],
            ['title' => 'Milestones', 'rows' => array_merge(
                [$row('Overall progress', self::progress($milestones) . '%')],
                $named
                    ? array_map(fn ($m) => $row($m['name'], $m['status'] ?? '', ['label_class' => 'cp-review-clip']), array_slice($named, 0, 3))
                    : [$row('Milestones', 'None')],
                count($named) > 3 ? [$row('', '+' . (count($named) - 3) . ' more')] : [],
            )],
        ];
    }

    /** Share of milestones completed, as a whole percent. */
    public static function progress(array $milestones): int
    {
        if (!$milestones) {
            return 0;
        }
        $done = count(array_filter($milestones, fn ($m) => ($m['status'] ?? '') === 'Completed'));
        return (int) round($done / count($milestones) * 100);
    }

    /** Rupees grouped the Indian way: 48,50,000. */
    public static function rupees(int $amount): string
    {
        $sign = $amount < 0 ? '-' : '';
        $digits = (string) abs($amount);
        if (strlen($digits) <= 3) {
            return $sign . $digits;
        }
        $last = substr($digits, -3);
        $rest = substr($digits, 0, -3);
        return $sign . ltrim(strrev(implode(',', str_split(strrev($rest), 2))), ',') . ',' . $last;
    }
}

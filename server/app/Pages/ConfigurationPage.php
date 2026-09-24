<?php

namespace App\Pages;

use App\Models\User;
use App\Support\Navigation;

/**
 * Admin, Configuration: values the app reads at runtime, one tab per group.
 * A settings group is described here (its fields, the checks a save must pass
 * and what is said), and read and saved through its own settings endpoint.
 * UG branches and the synopsis checklist are lists of their own, drawn by
 * blocks each client implements once.
 *
 * Shape: { version, title, description, sections: [ { value, label, section } ] }
 *   section = { kind: 'settings', group, fields, checks, done, note?, load_failed?,
 *     save_needs_load? } | { block }
 *   field = { key, id, label, input: 'number' | 'select', width, min?, max?,
 *     hint?, options?, placeholder? }
 *   check = { keys, message, filled?, integer?, min?, max?, below? }: fails when a
 *     key is left blank (filled), is not a whole number within min and max, or
 *     is not below every key named in below; the first failing check is said
 */
final class ConfigurationPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'admin');
    }

    public function view(User $user, array $params = []): array
    {
        $months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        $numbers = fn (array $labels, int $min, int $max, string $width, array $hints = []) => array_map(fn ($key, $label) => array_filter([
            'key' => $key,
            'id' => $key,
            'label' => $label,
            'input' => 'number',
            'min' => $min,
            'max' => $max,
            'width' => $width,
            'hint' => $hints[$key] ?? null,
        ], fn ($value) => $value !== null), array_keys($labels), $labels);

        return self::page('Configuration', 'Values the app reads at runtime. A change here applies to everyone immediately.', [
            'sections' => [
                ['value' => 'leave', 'label' => 'Leave quotas', 'section' => [
                    'kind' => 'settings',
                    'group' => 'leave',
                    'fields' => [
                        ['key' => 'academic_quota', 'id' => 'leave-quotas-academic-quota', 'label' => 'Academic quota', 'input' => 'number', 'min' => 0, 'max' => 365, 'width' => '160'],
                        ['key' => 'casual_quota', 'id' => 'leave-quotas-casual-quota', 'label' => 'Casual quota', 'input' => 'number', 'min' => 0, 'max' => 365, 'width' => '160'],
                        ['key' => 'year_start_month', 'id' => 'leave-quotas-quota-year-starts-in', 'label' => 'Quota year starts in', 'input' => 'select', 'width' => '190',
                            'placeholder' => 'Select a month',
                            'options' => array_map(fn ($name, $index) => ['value' => $index + 1, 'title' => $name], $months, array_keys($months))],
                    ],
                    // A blank is refused rather than saved as 0, as the other groups do.
                    'checks' => [
                        ['keys' => ['academic_quota'], 'filled' => true, 'integer' => true, 'min' => 0, 'max' => 365, 'message' => 'Academic quota must be a whole number between 0 and 365.'],
                        ['keys' => ['casual_quota'], 'filled' => true, 'integer' => true, 'min' => 0, 'max' => 365, 'message' => 'Casual quota must be a whole number between 0 and 365.'],
                        ['keys' => ['year_start_month'], 'filled' => true, 'integer' => true, 'min' => 1, 'max' => 12, 'message' => 'Quota year start month must be between January and December.'],
                    ],
                    'done' => 'Leave quota settings saved',
                ]],
                ['value' => 'thesis', 'label' => 'Thesis duration', 'section' => [
                    'kind' => 'settings',
                    'group' => 'thesis',
                    'fields' => $numbers([
                        'min_years' => 'Minimum years before submission',
                        'base_years_male' => 'Submission deadline, male (years)',
                        'base_years_female_ph' => 'Submission deadline, female or physically handicapped (years)',
                    ], 1, 15, '220', [
                        'min_years' => 'Same for full-time and part-time.',
                        'base_years_male' => 'Before any extension.',
                        'base_years_female_ph' => 'Before any extension.',
                    ]),
                    'checks' => [
                        ['keys' => ['min_years', 'base_years_male', 'base_years_female_ph'], 'integer' => true, 'min' => 1, 'message' => 'Every limit must be a whole number of years, at least 1.'],
                        ['keys' => ['min_years'], 'below' => ['base_years_male', 'base_years_female_ph'], 'message' => 'The minimum must be shorter than both deadlines.'],
                    ],
                    'done' => 'Thesis duration limits saved',
                ]],
                ['value' => 'supervision', 'label' => 'Supervision limits', 'section' => [
                    'kind' => 'settings',
                    'group' => 'supervision',
                    'fields' => $numbers([
                        'max_professor' => 'Professor',
                        'max_associate_professor' => 'Associate Professor',
                        'max_assistant_professor' => 'Assistant Professor',
                        'max_other' => 'Other designations',
                    ], 0, 50, '220', ['max_other' => 'Designations that name no rank, such as an administrative post.']),
                    'checks' => [
                        // A blank would be read as 0 and pass the range check.
                        ['keys' => ['max_professor', 'max_associate_professor', 'max_assistant_professor', 'max_other'], 'filled' => true, 'message' => 'Fill in every field before saving.'],
                        ['keys' => ['max_professor', 'max_associate_professor', 'max_assistant_professor', 'max_other'], 'integer' => true, 'min' => 0, 'max' => 50, 'message' => 'Every limit must be a whole number between 0 and 50.'],
                    ],
                    'done' => 'Supervision limits saved',
                    'note' => 'The limit counts scholars a faculty member is currently guiding. Once a thesis is submitted, it no longer occupies a slot.',
                    'load_failed' => 'Could not load the supervision limits. Check your connection and try again.',
                    // Save stays off until the stored figures arrived, so a failed
                    // load cannot be followed by saving the blank form over them.
                    'save_needs_load' => true,
                ]],
                ['value' => 'branches', 'label' => 'UG branches', 'section' => ['block' => 'ug-branches']],
                ['value' => 'coursework', 'label' => 'Coursework credits', 'section' => [
                    'kind' => 'settings',
                    'group' => 'coursework',
                    'fields' => $numbers([
                        'min_credits_full_time' => 'Full time',
                        'min_credits_part_time' => 'Part time',
                        'min_credits_executive' => 'Executive',
                    ], 0, 100, '200'),
                    'checks' => [
                        ['keys' => ['min_credits_full_time', 'min_credits_part_time', 'min_credits_executive'], 'filled' => true, 'message' => 'Fill in every field before saving.'],
                        ['keys' => ['min_credits_full_time', 'min_credits_part_time', 'min_credits_executive'], 'integer' => true, 'min' => 0, 'max' => 100, 'message' => 'Every requirement must be a whole number between 0 and 100.'],
                    ],
                    'done' => 'Coursework requirements saved',
                    'note' => "A scholar's total is the credits of the courses marked complete on their profile. Until they reach the figure for their status, the synopsis cannot be raised, and their profile says how far off they are.",
                    'load_failed' => 'Could not load the coursework requirements. Check your connection and try again.',
                    'save_needs_load' => true,
                ]],
                ['value' => 'checklist', 'label' => 'Synopsis checklist', 'section' => ['block' => 'synopsis-checklist']],
            ],
        ]);
    }
}

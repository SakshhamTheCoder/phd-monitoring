<?php

namespace App\Support;

/**
 * The validation the create and edit endpoints share.
 *
 * Kept beside the duration and budget rules it enforces, so the bounds the
 * dropdown offers and the bounds the API accepts are the same two constants.
 */
final class ProjectRequestRules
{
    /** @return array<string, mixed> */
    public static function forStore(): array
    {
        return array_merge([
            'title' => 'required|string',
            'category' => 'required|in:In-house,Research,Consultancy,Industry,International,Other',
            'pi_faculty_code' => 'sometimes|integer|exists:faculty,faculty_code',
        ], self::shared());
    }

    /**
     * @param int|null $currentDurationYears The project's duration_years as
     *   currently stored, so a legacy out-of-range value that the request
     *   leaves untouched isn't rejected by a field the user never edited. A
     *   NEW out-of-range value is still rejected.
     * @return array<string, mixed>
     */
    public static function forUpdate(?int $currentDurationYears = null): array
    {
        return array_merge([
            'title' => 'sometimes|string',
            'category' => 'sometimes|in:In-house,Research,Consultancy,Industry,International,Other',
        ], self::shared($currentDurationYears));
    }

    /** @return array<string, mixed> */
    private static function shared(?int $currentDurationYears = null): array
    {
        return [
            'status' => 'nullable|in:Active,Completed,Pending,On Hold',

            'duration_years' => [
                'nullable',
                'integer',
                'min:' . ProjectDuration::MIN_YEARS,
                function ($attribute, $value, $fail) use ($currentDurationYears) {
                    if ($value === null) return;
                    if ((int) $value > ProjectDuration::MAX_YEARS && (int) $value === $currentDurationYears) {
                        // Unchanged legacy value: let it pass through untouched.
                        return;
                    }
                    if ((int) $value > ProjectDuration::MAX_YEARS) {
                        $fail('The duration years must not be greater than ' . ProjectDuration::MAX_YEARS . '.');
                    }
                },
            ],
            'duration_months' => 'nullable|integer|min:0|max:' . ProjectDuration::MAX_MONTHS,

            'sdgs' => 'nullable|array',
            'sdgs.*' => 'integer|min:1|max:17',

            'objectives' => 'nullable|array',
            'objectives.*' => 'nullable|string|max:500',

            'budget' => 'nullable|array',
            'budget.__manpower' => 'nullable|array',
            'budget.__manpower.*' => 'nullable|array',
            // A legacy category is still readable, so the category is not
            // constrained to the menu here; the UI offers only the five.
            'budget.__manpower.*.*.category' => 'nullable|string|max:100',
            'budget.__manpower.*.*.count' => 'nullable|integer|min:0|max:999',
            // Reconciliation can legitimately emit a negative "Unallocated
            // (legacy total)" line when a migrated head disagrees with its
            // breakdown; that value must round-trip on save, not be rejected.
            'budget.__manpower.*.*.amount' => 'nullable|integer',
            'budget.__equipment' => 'nullable|array',
            'budget.__equipment.*.*.item' => 'nullable|string|max:200',
            'budget.__equipment.*.*.amount' => 'nullable|integer',
            'budget.__other' => 'nullable|array',
            'budget.__other.*.*.label' => 'nullable|string|max:200',
            'budget.__other.*.*.amount' => 'nullable|integer',

            'gantt_chart' => 'nullable|file|mimes:pdf,png,jpg,jpeg,xlsx,xls,doc,docx|max:10240',
        ];
    }
}

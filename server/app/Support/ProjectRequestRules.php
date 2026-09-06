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

    /** @return array<string, mixed> */
    public static function forUpdate(): array
    {
        return array_merge([
            'title' => 'sometimes|string',
            'category' => 'sometimes|in:In-house,Research,Consultancy,Industry,International,Other',
        ], self::shared());
    }

    /** @return array<string, mixed> */
    private static function shared(): array
    {
        return [
            'status' => 'nullable|in:Active,Completed,Pending,On Hold',

            'duration_years' => 'nullable|integer|min:' . ProjectDuration::MIN_YEARS . '|max:' . ProjectDuration::MAX_YEARS,
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
            'budget.__manpower.*.*.amount' => 'nullable|integer|min:0',
            'budget.__equipment' => 'nullable|array',
            'budget.__equipment.*.*.item' => 'nullable|string|max:200',
            'budget.__equipment.*.*.amount' => 'nullable|integer|min:0',
            'budget.__other' => 'nullable|array',
            'budget.__other.*.*.label' => 'nullable|string|max:200',
            'budget.__other.*.*.amount' => 'nullable|integer|min:0',

            'gantt_chart' => 'nullable|file|mimes:pdf,png,jpg,jpeg,xlsx,xls,doc,docx|max:10240',
        ];
    }
}

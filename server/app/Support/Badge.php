<?php

namespace App\Support;

/**
 * Which tone a status or category is drawn in, keyed by the literal value
 * the API returns. Sent beside the value so every client colours it alike.
 */
final class Badge
{
    private const TONES = [
        // Project status
        'Active' => 'success',
        'Completed' => 'success',
        'Pending' => 'warning',
        'On Hold' => 'danger',

        // Project category. Told apart by colour rather than meaning anything by it.
        'In-house' => 'info',
        'Research' => 'accent',
        'Consultancy' => 'warning',
        'Industry' => 'success',
        'International' => 'purple',
        'Other' => 'neutral',

        // Application status, in the order an application moves through them
        'Applied' => 'info',
        'Shortlisted' => 'warning',
        'Interview Scheduled' => 'blue',
        'Selected' => 'success',
        'Rejected' => 'danger',

        // Milestone status
        'Not Started' => 'neutral',
        'In Progress' => 'warning',
        'Delayed' => 'danger',

        // Position status
        'Open' => 'success',
        'Closed' => 'neutral',
    ];

    public static function tone(?string $value): string
    {
        return self::TONES[$value] ?? 'neutral';
    }

    /** A value and its tone, as a client draws a badge. */
    public static function of(?string $value): array
    {
        return ['text' => $value, 'tone' => self::tone($value)];
    }
}

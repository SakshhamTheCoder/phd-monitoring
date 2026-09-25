<?php

namespace App\Pages;

use App\Http\Controllers\SemesterController;
use App\Models\User;
use App\Support\Navigation;
use Illuminate\Support\Carbon;

/**
 * The evaluation semester above the progress monitoring lists: the latest
 * one, or the one a list is for (params.semester). What it shows is worked
 * out here from the reader's role and today's date, so every client agrees:
 *
 *  - none       no semester yet; the office is asked to create the first
 *  - completed  the latest has ended; the office is asked to create the next
 *  - stats      its dates, the counts for the roles that read them, and
 *               the actions this role has on it
 *  - hidden     nothing, for everyone else in the first two cases
 *
 * Creating, editing and scheduling stay dialogs of the card's own.
 */
final class SemesterCardPage extends PageDefinition
{
    // Who reads the leave and scheduling counts, which the endpoint only
    // sends them anyway.
    private const READS_COUNTS = ['admin', 'hod', 'dordc', 'phd_coordinator'];

    private const TOGGLES_FILTERS = ['admin', 'dordc', 'faculty', 'phd_coordinator'];

    private const SCHEDULES = ['faculty', 'phd_coordinator'];

    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'presentations');
    }

    public function view(User $user, array $params = []): array
    {
        $named = ($params['semester'] ?? null) ?: null;
        $role = $user->current_role?->role ?? 'student';
        $office = in_array($role, ['admin', 'dordc'], true);

        $answer = app(SemesterController::class)->getRecent(request(), $named);
        if ($answer->getStatusCode() === 404) {
            return self::page('No evaluation semester found', null, ['state' => $office ? 'none' : 'hidden']);
        }
        abort_if($answer->getStatusCode() !== 200, $answer->getStatusCode());
        $semester = json_decode(json_encode($answer->getData()), true)['data'];
        $name = $semester['semester_name'];

        // Compared as instants, as the card did in the browser: a semester
        // ends at the start of its end date.
        $now = now();
        $inSemester = $now->gte(Carbon::parse($semester['start_date'])) && $now->lte(Carbon::parse($semester['end_date']));
        $upcoming = $now->lt(Carbon::parse($semester['start_date']));
        $completed = Carbon::parse($semester['end_date'])->lt($now);

        // A list for a past semester still shows its figures; only the latest,
        // once over, asks for the next.
        if ($completed && !$named) {
            return self::page('Evaluation semester completed', null, ['state' => $office ? 'completed' : 'hidden', 'semester_name' => $name]);
        }

        $open = $inSemester || $upcoming;

        return self::page("{$name} semester stats", null, [
            'state' => 'stats',
            'semester_name' => $name,
            // Kept as two runs of text, as the card has always drawn them.
            'title_parts' => [$name, ' semester stats'],
            'badge' => $inSemester ? ['text' => 'Active', 'tone' => 'success'] : ($upcoming ? ['text' => 'Upcoming', 'tone' => 'info'] : null),
            'actions' => array_values(array_filter([
                $inSemester && !$named ? ['label' => 'View current semester details', 'variant' => 'secondary', 'navigate_below' => "/semester/{$name}"] : null,
                in_array($role, self::TOGGLES_FILTERS, true) ? ['toggles_filters' => true] : null,
                // One filled button: scheduling or editing, whichever this role has.
                $open && in_array($role, self::SCHEDULES, true) ? ['label' => 'Schedule progress monitoring', 'opens' => 'schedule'] : null,
                $open && $office ? ['label' => 'Edit evaluation semester', 'opens' => 'edit'] : null,
            ])),
            'facts' => array_merge([
                ['label' => 'Start date', 'date' => $semester['start_date']],
                ['label' => 'End date', 'date' => $semester['end_date']],
            ], in_array($role, self::READS_COUNTS, true) ? [
                ['label' => 'Leaves scheduled', 'text' => $semester['leave'] ?? null],
                ['label' => 'Scheduled', 'text' => $semester['scheduled'] ?? null],
                ['label' => 'Unscheduled', 'text' => $semester['unscheduled'] ?? null],
            ] : []),
            'edits' => $office,
            'edit_values' => $office ? [
                'start_date' => $semester['start_date'],
                'end_date' => $semester['end_date'],
                'notification' => $semester['notification'] ?? null,
                'ppt_file' => ($semester['ppt_file'] ?? null) ?: null,
            ] : null,
        ]);
    }
}

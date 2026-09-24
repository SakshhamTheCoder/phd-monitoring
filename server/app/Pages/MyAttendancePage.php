<?php

namespace App\Pages;

use App\Http\Controllers\ClerkController;
use App\Http\Controllers\StudentController;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * A scholar's own attendance: the all-time figures, the same records by
 * month and by session, their leave balance for the quota year and their
 * leave applications, every figure and label phrased here. Applying for
 * leave and reading an application stay the page's own.
 *
 * A scholar with no student record, or whose records cannot be read, gets
 * `error` to show in place of the tables.
 */
final class MyAttendancePage extends PageDefinition
{
    private const DAY_PARTS = ['full' => 'Full day', 'first_half' => 'First half', 'second_half' => 'Second half'];

    private const LEAVE_TYPES = ['casual' => 'Casual leave', 'academic' => 'Academic leave'];

    private const EMPTY = 'N/A';

    public function allows(User $user): bool
    {
        return $user->current_role?->role === 'student';
    }

    public function view(User $user, array $params = []): array
    {
        $me = app(StudentController::class)->me();
        $roll = $me->getStatusCode() === 200 ? ($me->getData(true)['profile']['roll_no'] ?? null) : null;
        if (!$roll) {
            return self::page('My attendance', null, ['error' => 'Could not load your student record. Please try again later.']);
        }
        $answer = app(ClerkController::class)->studentAttendance(request(), $roll);
        if ($answer->getStatusCode() !== 200) {
            return self::page('My attendance', null, ['error' => 'Could not load your attendance records. Please try again later.']);
        }
        $data = json_decode(json_encode($answer->getData()), true);
        $summary = $data['summary'];
        $month = $data['current_month']['label'] ?? null;

        return self::page('My attendance', null, [
            'summary' => [
                'title' => 'Summary',
                'caption' => ($month ? "{$month} · " : '') . 'All-time figures for ' . (($data['student']['name'] ?? null) ?: 'you'),
                'stats' => [
                    ['label' => 'Sessions', 'value' => $summary['total']],
                    ['label' => 'Present', 'tone' => 'present', 'value' => $summary['present']],
                    ['label' => 'Absent', 'tone' => 'absent', 'value' => $summary['absent']],
                    ['label' => 'Attendance', 'value' => $summary['percent'] !== null ? "{$summary['percent']}%" : self::EMPTY],
                ],
            ],
            'months' => self::months($data['records']),
            'sessions' => array_map(fn ($record) => [
                'key' => "{$record['date']}-{$record['lecture_id']}",
                'date' => self::day($record['date']),
                'session' => (int) $record['lecture_id'] === 0 ? 'Full day' : "Session {$record['lecture_id']}",
                'present' => $record['status'] === 'present',
                'status' => $record['status'] === 'present' ? 'Present' : 'Absent',
            ], $data['records']),
            'balance' => self::balance($data['balance'] ?? null),
            'leaves' => array_map(fn ($leave) => [
                'id' => $leave['id'],
                'type' => ($leave['leave_type'] ?? null) ?: self::EMPTY,
                'from' => self::day($leave['from_date']) ?: self::EMPTY,
                'to' => self::day($leave['to_date']) ?: self::EMPTY,
                'part' => self::DAY_PARTS[$leave['day_part'] ?? ''] ?? (($leave['day_part'] ?? null) ?: self::EMPTY),
                'status' => $leave['status'],
                'hod_comments' => ($leave['hod_comments'] ?? null) ?: self::EMPTY,
            ], $data['leaves']),
        ]);
    }

    /** Each month the records fall in, newest first, with its counts. */
    private static function months(array $records): array
    {
        $months = [];
        foreach ($records as $record) {
            $key = substr(self::day($record['date']), 0, 7);
            $months[$key] ??= ['month' => $key, 'present' => 0, 'absent' => 0, 'total' => 0];
            if (in_array($record['status'], ['present', 'absent'], true)) {
                $months[$key][$record['status']]++;
            }
            $months[$key]['total']++;
        }
        krsort($months);

        // A month only exists here when a record made it, so it always has a session.
        return array_values(array_map(fn ($month) => $month + ['percent' => round($month['present'] / $month['total'] * 100) . '%'], $months));
    }

    /**
     * Used against quota per type, and how far over or how much is left.
     * Leave is counted in halves, so 2 prints as 2 and a half as 0.5.
     */
    private static function balance(?array $balance): ?array
    {
        if (!$balance) {
            return null;
        }
        $window = $balance['window'] ?? null;

        return [
            'title' => 'Leave balance',
            'caption' => $window ? "Quota year: {$window['start']} to {$window['end']}" : null,
            'stats' => array_map(function ($key, $label) use ($balance) {
                $type = $balance[$key] ?? ['quota' => 0, 'used' => 0, 'remaining' => 0];
                $over = max(0, (float) $type['used'] - (float) $type['quota']);
                return [
                    'label' => $label,
                    'value' => self::days($type['used']) . ' / ' . self::days($type['quota']),
                    'note' => $over > 0
                        ? ['text' => self::days($over) . ' over quota', 'tone' => 'danger']
                        : ['text' => self::days($type['remaining']) . ' remaining', 'tone' => 'neutral'],
                ];
            }, array_keys(self::LEAVE_TYPES), self::LEAVE_TYPES),
        ];
    }

    private static function days(mixed $count): string
    {
        $value = (float) $count;
        return floor($value) === $value ? (string) (int) $value : number_format($value, 1, '.', '');
    }

    /** The day a date-cast value falls on where the portal runs. */
    private static function day(?string $value): string
    {
        return $value ? Carbon::parse($value)->setTimezone(config('app.timezone'))->toDateString() : '';
    }
}

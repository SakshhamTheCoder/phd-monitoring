<?php

namespace Tests\Feature;

use App\Http\Controllers\ClerkController;
use App\Http\Controllers\StudentController;
use App\Models\User;
use App\Pages\MyAttendancePage;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * A scholar's attendance as the server phrases it: months counted on the
 * portal's own calendar, and leave in halves.
 */
class MyAttendanceViewTest extends TestCase
{
    private function viewOf(?array $attendance, bool $hasRecord = true): array
    {
        $this->app->instance(StudentController::class, new class($hasRecord) extends StudentController {
            public function __construct(private bool $hasRecord)
            {
            }

            public function me()
            {
                return $this->hasRecord ? response()->json(['profile' => ['roll_no' => '102203456']]) : response()->json([], 404);
            }
        });
        $this->app->instance(ClerkController::class, new class($attendance) extends ClerkController {
            public function __construct(private ?array $attendance)
            {
            }

            public function studentAttendance(Request $request, $roll_no)
            {
                return $this->attendance ? response()->json($this->attendance) : response()->json([], 403);
            }
        });

        return (new MyAttendancePage())->view(new User());
    }

    private function attendance(): array
    {
        return [
            'student' => ['name' => 'Test Scholar'],
            'summary' => ['total' => 3, 'present' => 2, 'absent' => 1, 'percent' => 66.7],
            'current_month' => ['label' => 'September 2026'],
            // Midnight on the 1st in Asia/Kolkata, as a date cast sends it.
            'records' => [
                ['date' => '2026-08-31T18:30:00.000000Z', 'lecture_id' => 0, 'status' => 'present'],
                ['date' => '2026-08-13T18:30:00.000000Z', 'lecture_id' => 2, 'status' => 'absent'],
                ['date' => '2026-07-30T18:30:00.000000Z', 'lecture_id' => 1, 'status' => 'present'],
            ],
            'balance' => [
                'window' => ['start' => '2026-01-01', 'end' => '2026-12-31'],
                'casual' => ['quota' => 8, 'used' => 9.5, 'remaining' => 0],
                'academic' => ['quota' => 10, 'used' => 2, 'remaining' => 8],
            ],
            'leaves' => [['id' => 1, 'leave_type' => null, 'from_date' => '2026-09-08T18:30:00.000000Z', 'to_date' => null, 'day_part' => 'first_half', 'status' => 'pending']],
        ];
    }

    public function test_months_fall_on_the_portal_calendar(): void
    {
        config(['app.timezone' => 'Asia/Kolkata']);
        $view = $this->viewOf($this->attendance());

        $this->assertSame([['2026-09', 1, '100%'], ['2026-08', 1, '0%'], ['2026-07', 1, '100%']], array_map(fn ($month) => [$month['month'], $month['total'], $month['percent']], $view['months']));
        $this->assertSame(['2026-09-01', 'Full day', 'Present'], [$view['sessions'][0]['date'], $view['sessions'][0]['session'], $view['sessions'][0]['status']]);
        $this->assertSame('September 2026 · All-time figures for Test Scholar', $view['summary']['caption']);
        $this->assertSame('66.7%', $view['summary']['stats'][3]['value']);
    }

    public function test_leave_is_counted_in_halves(): void
    {
        $balance = $this->viewOf($this->attendance())['balance']['stats'];

        $this->assertSame(['9.5 / 8', '1.5 over quota', 'danger'], [$balance[0]['value'], $balance[0]['note']['text'], $balance[0]['note']['tone']]);
        $this->assertSame(['2 / 10', '8 remaining'], [$balance[1]['value'], $balance[1]['note']['text']]);
    }

    public function test_an_unreadable_record_says_so(): void
    {
        $this->assertSame('Could not load your student record. Please try again later.', $this->viewOf(null, false)['error']);
        $this->assertSame('Could not load your attendance records. Please try again later.', $this->viewOf(null)['error']);
    }
}

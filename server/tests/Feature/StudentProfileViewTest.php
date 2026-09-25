<?php

namespace Tests\Feature;

use App\Http\Controllers\ClerkController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\StudentCourseController;
use App\Models\User;
use App\Pages\StudentProfilePage;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * The PhD profile as the server describes it: the words it phrases itself,
 * and what a locked title keeps out of a save.
 */
class StudentProfileViewTest extends TestCase
{
    private function viewOf(array $profile, array $envelope = []): array
    {
        $answer = response()->json(['profile' => $profile, 'is_self' => true, 'can_edit' => true, 'can_manage' => false, 'can_tag_courses' => false] + $envelope);
        $this->app->instance(StudentController::class, new class($answer) extends StudentController {
            public function __construct(private $answer)
            {
            }

            public function me()
            {
                return $this->answer;
            }

            public function publications(Request $request, $roll_no)
            {
                return response()->json([], 403);
            }
        });
        $this->app->instance(StudentCourseController::class, new class extends StudentCourseController {
            public function getCoursesForStudent($studentId)
            {
                return response()->json(['data' => [
                    ['id' => 1, 'course_code' => 'UCH001', 'status' => 'enrolled'],
                    ['id' => 2, 'course_code' => 'UCH002', 'status' => 'completed'],
                ]]);
            }
        });
        $this->app->instance(ClerkController::class, new class extends ClerkController {
            public function studentAttendance(Request $request, $roll_no)
            {
                return response()->json(['summary' => ['present' => 3, 'total' => 4, 'percent' => 75], 'current_month' => ['present' => 0, 'total' => 0, 'percent' => 0, 'label' => 'September 2026']]);
            }
        });

        return (new StudentProfilePage())->view(new User());
    }

    private function profile(array $overrides = []): array
    {
        return array_merge([
            'id' => '102203456', 'database_id' => null, 'roll_no' => '102203456', 'name' => 'Test Scholar',
            'phd_title' => 'Modelling', 'phd_title_locked' => false, 'irb_completed' => false, 'tentative_desc' => null,
            'strengths' => null, 'help_needed' => null, 'broad_area' => null, 'physically_handicapped' => false,
            'is_jrf' => null, 'net_gate' => null, 'overall_progress' => null, 'department' => 'CSED',
            'supervisors' => [], 'doctoral' => [], 'cgpa' => 0, 'completed_credits' => 0, 'required_credits' => 12,
            'email' => 'teststu@gmail.com', 'phone' => null, 'current_status' => 'part-time', 'fathers_name' => null,
            'address' => null, 'date_of_registration' => '2024-07-01', 'date_of_irb' => null, 'date_of_synopsis' => null,
            'date_of_thesis' => null, 'date_of_thesis_awarded' => null, 'irb_outside_expert' => null,
            'thesis_window' => ['latest' => '2030-07-01', 'days_remaining' => -3, 'extensions_granted' => 2],
        ], $overrides);
    }

    private static function detail(array $view, string $label): array
    {
        return collect($view['sections'][0]['rows'])->firstWhere('label', $label);
    }

    public function test_it_phrases_the_details_as_the_profile_did(): void
    {
        $view = $this->viewOf($this->profile());

        $this->assertSame('Tentative PhD Title', $view['sections'][0]['lines'][0]['label']);
        $this->assertSame(0, $view['sections'][0]['progress']);
        $this->assertSame('0 of 12 credits', self::detail($view, 'Coursework')['boxed']);
        $this->assertNull(self::detail($view, 'JRF')['value']);
        $this->assertSame('(overdue by 3 days, 2 extensions granted)', self::detail($view, 'Thesis Deadline')['deadline']['note']);
        $this->assertSame(['3/4 (75%)', ['No sessions recorded this month.']], [self::detail($view, 'Attendance')['attendance']['value'], self::detail($view, 'Attendance')['attendance']['month_lines']]);
        // A CGPA of 0 starts the field empty, as the profile's editor did.
        $this->assertSame('', $view['edit']['values']['cgpa']);
    }

    public function test_a_locked_title_is_kept_out_of_a_save(): void
    {
        $open = $this->viewOf($this->profile());
        $locked = $this->viewOf($this->profile(['phd_title_locked' => true]));

        $this->assertSame([], $open['edit']['sent_without']);
        $this->assertSame(['phd_title', 'tentative_desc'], $locked['edit']['sent_without']);
        $this->assertTrue($locked['sections'][0]['edit_lines'][0]['disabled']);
    }

    public function test_courses_split_by_status_and_publications_stay_off_when_refused(): void
    {
        $view = $this->viewOf($this->profile());
        $tables = collect($view['sections'])->keyBy(fn ($section) => $section['title'] ?? $section['kind']);

        $this->assertSame(['UCH001'], array_column($tables['Enrolled courses']['rows'], 'course_code'));
        $this->assertSame(['UCH002'], array_column($tables['Completed courses']['rows'], 'course_code'));
        $this->assertArrayNotHasKey('publications', $tables->all());
        // A scholar reading their own profile is not offered the forms of someone else's.
        $this->assertSame([['edit' => true]], $view['actions']);
    }
}

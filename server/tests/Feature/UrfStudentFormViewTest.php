<?php

namespace Tests\Feature;

use App\Http\Controllers\UrfController;
use App\Models\User;
use App\Pages\UrfStudentFormPage;
use App\Pages\UrfStudentFormsPage;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Which URF form a UG student fills in and which they read as filed. The
 * stage a form has reached is the whole of what decides it: once it is with
 * the mentor it is read, and once a step sends it back it is theirs again.
 */
class UrfStudentFormViewTest extends TestCase
{
    private function user(): User
    {
        return (new User())->forceFill(['id' => 42, 'email' => 'one@thapar.edu']);
    }

    private function project(array $overrides = []): array
    {
        return array_merge([
            'id' => 1, 'session' => 2026, 'status' => 'selected', 'stage' => 'complete',
            'project_title' => 'Lock project', 'student2_email' => null, 'fellows' => [], 'reports' => [],
        ], $overrides);
    }

    private function mine(array $application, ?array $windows = null): void
    {
        $mine = [
            'applications_open' => true, 'session' => 2026, 'student' => [],
            'report_windows' => $windows ?? [['type' => 'half_yearly', 'session' => 2026, 'is_open' => true, 'opens_on' => '2026-01-01', 'closes_on' => '2026-12-31', 'notes' => null]],
            'applications' => [$application],
        ];
        $this->app->instance(UrfController::class, new class($mine) extends UrfController {
            public function __construct(private array $mine)
            {
            }

            public function mine()
            {
                return response()->json($this->mine);
            }
        });
    }

    private function body(string $type, array $application, ?array $windows = null): array
    {
        $this->mine($application, $windows);
        return (new UrfStudentFormPage())->view($this->user(), ['type' => $type, 'id' => 1])['body'];
    }

    public function test_an_application_with_the_mentor_is_read_and_one_sent_back_is_filled(): void
    {
        $this->assertSame(['shell', '/urf/urf-application/1'], array_values(array_intersect_key($this->body('application', $this->project(['status' => 'applied', 'stage' => 'mentor'])), array_flip(['kind', 'path']))));
        $this->assertSame('apply', $this->body('application', $this->project(['status' => 'applied', 'stage' => 'student']))['kind']);
    }

    public function test_the_second_student_reads_the_application(): void
    {
        $this->assertSame('shell', $this->body('application', $this->project(['status' => 'applied', 'stage' => 'student', 'student2_email' => 'ONE@thapar.edu']))['kind']);
    }

    public function test_the_stipend_details_are_read_once_submitted_and_filled_once_sent_back(): void
    {
        $this->assertSame('/urf/urf-additional-info/7', $this->body('additional', $this->project(['fellows' => [['id' => 7, 'user_id' => 42, 'stage' => 'adordc']]]))['path']);
        $this->assertSame('fellow', $this->body('additional', $this->project(['fellows' => [['id' => 7, 'user_id' => 42, 'stage' => 'student']]]))['kind']);
    }

    public function test_a_filed_report_is_read_rather_than_offered_again(): void
    {
        // The round is still open, so without the lock a second submit filed a duplicate.
        $this->assertSame('/urf/urf-half-yearly-report/9', $this->body('half_yearly', $this->project(['reports' => [['id' => 9, 'type' => 'half_yearly', 'stage' => 'mentor']]]))['path']);
        $this->assertSame('report', $this->body('half_yearly', $this->project())['kind']);
    }

    public function test_a_report_outside_its_round_says_which_round(): void
    {
        Carbon::setTestNow('2026-09-25 12:00:00');
        $later = [['type' => 'final', 'session' => 2026, 'is_open' => false, 'opens_on' => '2026-10-01', 'closes_on' => '2026-12-28', 'notes' => 'Demo.']];

        $this->assertSame([['This report can be filed from ', ['date' => '2026-10-01'], ' to ', ['date' => '2026-12-28'], '.']], $this->body('final', $this->project(), $later)['text']);
        $this->assertSame(['This report has not been scheduled yet.'], $this->body('half_yearly', $this->project(), $later)['text']);

        // The project's block names the round it waits on.
        $this->mine($this->project(), $later);
        $block = (new UrfStudentFormsPage())->view($this->user())['applications'][0];
        $this->assertSame(['Final Report', ': ', ['opens ', ['date' => '2026-10-01']], ' · Demo.'], $block['rounds'][0]);
        $this->assertSame(['URF Application Form', 'Additional Information Form'], array_column($block['forms'], 'form_name'));
        Carbon::setTestNow();
    }

    public function test_one_application_per_session(): void
    {
        $this->mine($this->project(['status' => 'rejected']));
        $this->assertSame('Apply for URF 2026', (new UrfStudentFormsPage())->view($this->user())['actions'][0]['label']);
        $this->mine($this->project(['status' => 'applied']));
        $this->assertSame([], (new UrfStudentFormsPage())->view($this->user())['actions']);
    }
}

<?php

namespace Tests\Feature;

use App\Models\ListOfExaminersForm;
use App\Models\Student;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The HOD step is gone from the List of Examiners. A form created before that
 * carries its own step list, so the migration has to rewrite it or the form
 * parks at a step nobody can act on.
 */
class ExaminerHodStepRemovedTest extends TestCase
{
    use DatabaseTransactions;

    private function migration()
    {
        return require database_path('migrations/2026_09_13_000001_drop_the_hod_step_from_list_of_examiners.php');
    }

    private function oldForm(string $stage, int $currentStep): ListOfExaminersForm
    {
        $student = Student::query()->first();

        if (!$student) {
            $this->markTestSkipped('No student in this database.');
        }

        return ListOfExaminersForm::create([
            'student_id' => $student->roll_no,
            'status' => 'pending',
            'stage' => $stage,
            'steps' => ['faculty', 'hod', 'dordc', 'director', 'complete'],
            'current_step' => $currentStep,
            'maximum_step' => $currentStep,
        ]);
    }

    public function test_a_form_waiting_on_the_hod_moves_to_dordc(): void
    {
        $form = $this->oldForm('hod', 1);

        $this->migration()->up();

        $form->refresh();

        $this->assertSame(['faculty', 'dordc', 'director', 'complete'], $form->steps);
        $this->assertSame('dordc', $form->stage);
        $this->assertSame('dordc', $form->steps[$form->current_step]);
    }

    public function test_a_form_past_the_hod_keeps_the_step_it_is_on(): void
    {
        $form = $this->oldForm('director', 3);

        $this->migration()->up();

        $form->refresh();

        $this->assertSame('director', $form->stage);
        $this->assertSame('director', $form->steps[$form->current_step]);
    }

    public function test_a_new_form_never_names_the_hod(): void
    {
        $this->assertStringNotContainsString(
            "'hod'",
            file_get_contents(app_path('Http/Controllers/ListOfExaminersController.php')),
            'The examiners controller still routes through the HOD.'
        );
    }
}

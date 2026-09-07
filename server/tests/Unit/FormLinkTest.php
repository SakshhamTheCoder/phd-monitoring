<?php

namespace Tests\Unit;

use App\Http\Controllers\StudentSemesterOffFormController;
use App\Models\StudentLeaveForm;
use App\Models\StudentSemesterOffForm;
use Tests\TestCase;

/**
 * formLink is protected, so reach it through a reflection helper rather than
 * loosening the trait's visibility for a test.
 */
class FormLinkTest extends TestCase
{
    private function link(object $controller, $formInstance, string $model): string
    {
        $method = new \ReflectionMethod($controller, 'formLink');
        $method->setAccessible(true);

        return $method->invoke($controller, $formInstance, $model);
    }

    public function test_a_normal_form_links_into_the_forms_page(): void
    {
        $form = new StudentSemesterOffForm(['id' => 7]);
        $form->id = 7;

        $this->assertSame(
            '/forms/semester-off/7',
            $this->link(new StudentSemesterOffFormController(), $form, StudentSemesterOffForm::class)
        );
    }

    // Task 6 enables this: StudentLeaveFormController does not exist until Task 6.
    // public function test_a_leave_links_into_the_attendance_page(): void
    // {
    //     $leave = new StudentLeaveForm();
    //     $leave->id = 42;
    //
    //     $this->assertSame(
    //         '/attendance?tab=leaves&leave=42',
    //         $this->link(new \App\Http\Controllers\StudentLeaveFormController(), $leave, StudentLeaveForm::class)
    //     );
    // }
}

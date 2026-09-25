<?php

namespace Tests\Feature;

use App\Http\Controllers;
use Tests\TestCase;

/**
 * The list pages offer "Approve selected" only to the roles each form's bulk
 * endpoint accepts. They used to offer it to every office role, and most got a
 * button the server refused. Both now read one list per controller.
 */
class BulkApproveOfferedOnlyWhereAllowedTest extends TestCase
{
    public function test_each_form_names_who_may_bulk_approve_it(): void
    {
        $expected = [
            Controllers\ConstituteOfIRBController::class => ['dra'],
            Controllers\IrbSubController::class => ['phd_coordinator', 'hod', 'dra', 'dordc'],
            Controllers\ListOfExaminersController::class => ['director'],
            Controllers\PresentationController::class => ['hod', 'dordc', 'doctoral'],
            Controllers\ReviseTitleController::class => ['hod', 'phd_coordinator', 'dordc'],
            Controllers\SupervisorAllocationController::class => ['hod'],
            Controllers\SynopsisSubmissionController::class => ['hod', 'phd_coordinator', 'dordc'],
        ];
        foreach ($expected as $controller => $roles) {
            $this->assertSame($roles, $controller::BULK_APPROVERS, $controller);
        }
    }

    public function test_the_list_says_whether_this_reader_may_bulk_approve(): void
    {
        $controller = new class {
            use \App\Http\Controllers\Traits\GeneralFormList;
            public const BULK_APPROVERS = ['hod'];
            public function answer(string $role)
            {
                $user = new \stdClass();
                $user->current_role = (object) ['role' => $role];
                return $this->listForms($user, null, request());
            }
            private function listHodForms(...$args) { return response()->json(['data' => []]); }
            private function listAdminForms(...$args) { return response()->json(['data' => []]); }
        };

        $this->assertTrue($controller->answer('hod')->getData(true)['can_bulk_approve']);
        $this->assertFalse($controller->answer('dordc')->getData(true)['can_bulk_approve']);
    }
}

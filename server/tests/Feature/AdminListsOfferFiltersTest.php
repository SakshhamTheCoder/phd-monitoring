<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Course Management, Areas of Specialization and Outside Experts had a filters
 * endpoint but no filter rows, so their pages drew no filter bar.
 */
class AdminListsOfferFiltersTest extends TestCase
{
    use DatabaseTransactions;

    private function account(string $role): User
    {
        $user = User::where('email', "{$role}@fixture.test")->first();
        if (!$user) {
            $this->markTestSkipped("No {$role}@fixture.test account. Seed TestFixturesSeeder.");
        }
        return $user;
    }

    /** The three admin lists draw a filter bar, and the table's filters apply. */
    public function test_the_admin_lists_offer_and_apply_filters(): void
    {
        $this->actingAs($this->account('admin'));
        foreach (['/api/courses/filters', '/api/departments/area-of-specialization/filters', '/api/outside-experts/filters'] as $path) {
            $this->assertNotEmpty($this->getJson($path)->assertOk()->json(), $path);
        }

        DB::table('outside_experts')->insert([
            ['first_name' => 'Filterable', 'last_name' => 'One', 'email' => 'filter-one@expert.test', 'designation' => 'Professor', 'department' => 'CSE', 'institution' => 'IIT'],
            ['first_name' => 'Other', 'last_name' => 'Two', 'email' => 'filter-two@expert.test', 'designation' => 'Professor', 'department' => 'CSE', 'institution' => 'IIT'],
        ]);
        $filters = urlencode(json_encode(['combine' => 'and', 'conditions' => [['key' => 'first_name', 'op' => 'LIKE', 'value' => 'Filterable']]]));
        $emails = collect($this->getJson("/api/outside-experts/list?page=1&rows=100&filters={$filters}")->assertOk()->json('data'))->pluck('email');

        $this->assertContains('filter-one@expert.test', $emails);
        $this->assertNotContains('filter-two@expert.test', $emails);
    }
}

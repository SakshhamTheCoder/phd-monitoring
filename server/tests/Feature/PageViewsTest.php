<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

/**
 * GET /views/{page} describes a page for the reader: only a reader the page is
 * for gets it, and a page the server does not describe is not found.
 */
class PageViewsTest extends TestCase
{
    private function account(string $role): User
    {
        $user = User::where('email', "{$role}@fixture.test")->first();
        if (!$user) {
            $this->markTestSkipped("No {$role}@fixture.test account. Seed TestFixturesSeeder.");
        }
        return $user;
    }

    public function test_a_page_is_described_for_the_reader_it_is_for(): void
    {
        $this->actingAs($this->account('admin'))->getJson('/api/views/outside-experts')
            ->assertOk()
            ->assertJsonPath('title', 'Outside experts')
            ->assertJsonPath('table.endpoint', '/outside-experts/list')
            ->assertJsonPath('dialogs.edit.request.path', '/outside-experts/update/{id}')
            ->assertJsonPath('dialogs.add.rows.0.items.0.key', 'full_name');
    }

    public function test_a_reader_the_page_is_not_for_is_refused(): void
    {
        $this->actingAs($this->account('student'))->getJson('/api/views/outside-experts')->assertForbidden();
    }

    public function test_an_unknown_page_is_not_found(): void
    {
        $this->actingAs($this->account('admin'))->getJson('/api/views/no-such-page')->assertNotFound();
    }
}

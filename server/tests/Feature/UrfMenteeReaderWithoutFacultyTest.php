<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The sidebar offers URF to anyone holding can_read_urf_mentees. A Director
 * without a faculty row holds it, and every list on the page refused them.
 */
class UrfMenteeReaderWithoutFacultyTest extends TestCase
{
    use DatabaseTransactions;

    public function test_a_mentee_reader_with_no_faculty_row_reads_an_empty_list(): void
    {
        $user = User::whereDoesntHave('faculty')
            ->whereIn('current_role_id', Role::query()->pluck('id'))
            ->get()
            ->first(fn (User $candidate) => $candidate->may('can_read_urf_mentees') && !$candidate->may('can_manage_urf'));
        if (!$user) {
            $this->markTestSkipped('No mentee reader without a faculty row in this database.');
        }

        $this->actingAs($user)->getJson('/api/urf?page=1&rows=10')->assertOk()->assertJsonPath('total', 0);
    }
}

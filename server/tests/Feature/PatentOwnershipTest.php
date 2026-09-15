<?php

namespace Tests\Feature;

use App\Models\Patent;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class PatentOwnershipTest extends TestCase
{
    use DatabaseTransactions;

    private function twoStudentsWithUsers(): array
    {
        $students = Student::query()->whereNotNull('user_id')->take(2)->get();

        if ($students->count() < 2) {
            $this->markTestSkipped('needs at least two students with user accounts');
        }

        return [$students[0], $students[1]];
    }

    private function actingAsStudent(Student $student): void
    {
        $user = User::findOrFail($student->user_id);
        $user->current_role_id = Role::where('role', 'student')->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');
    }

    private function patentFor(Student $owner): Patent
    {
        // authors isn't fillable on Patent, so it must be set after create() as a direct property assignment.
        $patent = Patent::create([
            'student_id' => $owner->roll_no,
            'title' => 'Parity test patent ' . uniqid(),
            'status' => 'filed',
            'country' => 'National',
            'year' => 2024,
            'doi_link' => 'https://example.invalid/original',
        ]);
        $patent->authors = 'Original Author';
        $patent->save();

        return $patent;
    }

    public function test_a_student_does_not_see_another_scholars_patent_in_their_list(): void
    {
        [$owner, $reader] = $this->twoStudentsWithUsers();
        $patent = $this->patentFor($owner);

        $this->actingAsStudent($reader);

        $ids = collect($this->getJson('/api/patents')->assertStatus(200)->json())->pluck('id');

        $this->assertNotContains(
            $patent->id,
            $ids,
            'GET /api/patents must be scoped to the caller, not return every scholars patents.'
        );
    }

    public function test_a_student_may_edit_their_own_patent(): void
    {
        [$owner] = $this->twoStudentsWithUsers();
        $patent = $this->patentFor($owner);

        $this->actingAsStudent($owner);

        $this->postJson("/api/patents/{$patent->id}", [
            'title' => 'Updated by the owner',
            'authors' => 'Original Author',
            'status' => 'granted',
            'doi_link' => 'https://example.invalid/updated',
            'year' => '2025',
            'country' => 'National',
        ])->assertStatus(200);

        $this->assertSame('Updated by the owner', $patent->fresh()->title);
    }

    public function test_a_student_cannot_edit_another_scholars_patent(): void
    {
        [$owner, $attacker] = $this->twoStudentsWithUsers();
        $patent = $this->patentFor($owner);

        $this->actingAsStudent($attacker);

        $this->postJson("/api/patents/{$patent->id}", [
            'title' => 'Hijacked',
            'authors' => 'Attacker',
            'status' => 'granted',
            'doi_link' => 'https://example.invalid/hijacked',
            'year' => '2025',
            'country' => 'National',
            'student_id' => $attacker->roll_no,
        ])->assertStatus(403);

        $fresh = $patent->fresh();
        $this->assertSame('Original Author', $fresh->authors, 'A refused edit must not touch the record at all.');
        $this->assertSame(
            $owner->roll_no,
            $fresh->student_id,
            'A refused edit must never change who owns the patent.'
        );
    }
}

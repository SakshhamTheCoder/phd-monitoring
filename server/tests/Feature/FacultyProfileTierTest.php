<?php

namespace Tests\Feature;

use App\Models\Faculty;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The faculty profile is one page for every viewer, so the boundary has to hold
 * in the payload rather than in the page.
 *
 * These assert on keys being ABSENT, not blank: a restricted field that ships
 * in the JSON and is hidden in React is one devtools tab from being read.
 */
class FacultyProfileTierTest extends TestCase
{
    use DatabaseTransactions;

    private const SUPERVISION_KEYS = ['supervised_students', 'doctoral_committee_students', 'student_publications'];

    private function faculty(): Faculty
    {
        return Faculty::whereNotNull('user_id')->firstOrFail();
    }

    /** Signs in as any user, acting in $role. Not the profile's owner. */
    private function actingAs_(string $role, Faculty $notThis): User
    {
        $user = User::whereNotNull('role_id')
            ->where(fn ($q) => $q->whereDoesntHave('faculty')
                ->orWhereHas('faculty', fn ($f) => $f->where('faculty_code', '!=', $notThis->faculty_code)))
            ->firstOrFail();

        $user->current_role_id = Role::where('role', $role)->firstOrFail()->id;
        $user->save();
        $user = $user->fresh();

        $this->actingAs($user, 'sanctum');

        return $user;
    }

    private function show(Faculty $faculty)
    {
        return $this->getJson("/api/faculty/{$faculty->faculty_code}/profile");
    }

    public function test_a_student_gets_the_public_tier_only(): void
    {
        $faculty = $this->faculty();
        $this->actingAs_('student', $faculty);

        $response = $this->show($faculty)->assertStatus(200);

        foreach (self::SUPERVISION_KEYS as $key) {
            $response->assertJsonMissingPath($key);
        }
        $response->assertJsonPath('can_view_supervision', false);
        $response->assertJsonMissingPath('profile.phone');
        // The public tier still carries the research record and the sizes.
        $response->assertJsonPath('profile.faculty_code', $faculty->faculty_code);
        $this->assertIsArray($response->json('counts'));
    }

    public function test_a_student_does_not_see_the_phone_number(): void
    {
        $faculty = $this->faculty();
        $this->actingAs_('student', $faculty);

        $this->show($faculty)->assertStatus(200)->assertJsonMissingPath('profile.phone');
    }

    /** The one capability that reverses that decision, without a deploy. */
    public function test_granting_the_phone_capability_shows_it_to_students(): void
    {
        $faculty = $this->faculty();
        Role::where('role', 'student')->update(['can_read_faculty_phone' => 'true']);
        $this->actingAs_('student', $faculty);

        // Presence of the key is the tier boundary; the stored value may be
        // null, which toProfilePayload renders as an empty string.
        $profile = $this->show($faculty)->assertStatus(200)->json('profile');

        $this->assertArrayHasKey('phone', $profile);
    }

    public function test_a_faculty_viewing_a_colleague_gets_the_public_tier(): void
    {
        $faculty = $this->faculty();
        $this->actingAs_('faculty', $faculty);

        $response = $this->show($faculty)->assertStatus(200);

        $response->assertJsonPath('can_view_supervision', false);
        foreach (self::SUPERVISION_KEYS as $key) {
            $response->assertJsonMissingPath($key);
        }
    }

    public function test_an_hod_gets_the_supervision_tier(): void
    {
        $faculty = $this->faculty();
        $this->actingAs_('hod', $faculty);

        $response = $this->show($faculty)->assertStatus(200);

        $response->assertJsonPath('can_view_supervision', true);
        foreach (self::SUPERVISION_KEYS as $key) {
            $response->assertJsonStructure([$key]);
        }
    }

    public function test_a_faculty_sees_their_own_supervision_without_the_capability(): void
    {
        $faculty = $this->faculty();
        $user = User::findOrFail($faculty->user_id);
        $user->current_role_id = Role::where('role', 'faculty')->firstOrFail()->id;
        $user->save();

        $this->actingAs($user->fresh(), 'sanctum');

        $this->show($faculty)->assertStatus(200)
            ->assertJsonPath('is_self', true)
            ->assertJsonPath('can_view_supervision', true)
            ->assertJsonStructure(['supervised_students', 'doctoral_committee_students']);
    }

    /** The dashboard card's head counts must survive on the profile. */
    public function test_the_public_tier_keeps_the_supervision_head_counts(): void
    {
        $faculty = $this->faculty();
        $this->actingAs_('student', $faculty);

        $profile = $this->show($faculty)->assertStatus(200)->json('profile');

        $this->assertArrayHasKey('supervised_campus', $profile);
        $this->assertArrayHasKey('supervised_outside', $profile);
        $this->assertArrayHasKey('expertise', $profile);
    }

    public function test_a_faculty_can_edit_their_own_phone_and_expertise(): void
    {
        $faculty = $this->faculty();
        $user = User::findOrFail($faculty->user_id);
        $user->current_role_id = Role::where('role', 'faculty')->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');

        $this->postJson("/api/faculty/{$faculty->faculty_code}/profile", [
            'phone' => '9876500000',
            'expertise' => 'Machine Learning, Cyber Security',
        ])->assertStatus(200);

        $this->assertSame('9876500000', $user->fresh()->phone);
        $this->assertSame(['Machine Learning', 'Cyber Security'], $faculty->fresh()->expertise);
    }

    public function test_another_faculty_cannot_edit_that_profile(): void
    {
        $faculty = $this->faculty();
        $this->actingAs_('faculty', $faculty);

        $this->postJson("/api/faculty/{$faculty->faculty_code}/profile", [
            'phone' => '0000000000',
        ])->assertStatus(403);
    }

    public function test_a_clerk_cannot_open_a_faculty_profile(): void
    {
        $faculty = $this->faculty();
        $this->actingAs_('clerk', $faculty);

        $this->show($faculty)->assertStatus(403);
    }
}

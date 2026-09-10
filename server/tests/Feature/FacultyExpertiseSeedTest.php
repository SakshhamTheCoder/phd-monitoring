<?php

namespace Tests\Feature;

use App\Models\Faculty;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Seeding expertise onto faculty who already exist, through the Faculty page's
 * Bulk Import.
 *
 * The recommendation system runs off `faculty.expertise`, and the way to copy
 * it between environments is a two column CSV of email and expertise. That only
 * works if the import treats every other field as "not supplied" rather than
 * "blank", so this pins the behaviour the migration relies on: expertise is
 * replaced, nothing else on the record moves, and a row for an unknown email is
 * refused rather than half-creating a faculty member.
 *
 * The payload here is exactly what client-new/src/pages/faculty/FacultyPage.jsx
 * builds from a CSV, empty strings and all.
 */
class FacultyExpertiseSeedTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', 'admin')->firstOrFail()->id;
        $user->save();

        $this->actingAs($user->fresh(), 'sanctum');

        return $user;
    }

    /** One CSV row as the Faculty page sends it: only email and expertise filled. */
    private function row(string $email, string $expertise, int $rowNumber = 2): array
    {
        return [
            'full_name' => '',
            'email' => $email,
            'phone' => '',
            'designation' => '',
            'faculty_code' => '',
            'department_code' => '',
            'institution' => '',
            'website_link' => '',
            'expertise' => $expertise,
            'row_number' => $rowNumber,
        ];
    }

    public function test_expertise_is_replaced_and_nothing_else_on_the_record_changes(): void
    {
        $this->admin();

        $faculty = Faculty::whereNotNull('user_id')->firstOrFail();
        $before = [
            'name' => $faculty->user->name(),
            'designation' => $faculty->designation,
            'department_id' => $faculty->department_id,
            'faculty_code' => $faculty->faculty_code,
            'phone' => $faculty->user->phone,
        ];

        $response = $this->postJson('/api/faculty/bulk-import', [
            'batch_data' => [$this->row($faculty->user->email, 'Machine Learning, Federated Learning')],
        ]);

        $response->assertOk();
        $this->assertSame(0, $response->json('data.error_count'), json_encode($response->json('data.errors')));
        $this->assertSame(1, $response->json('data.update_count'));
        $this->assertSame(0, $response->json('data.success_count'), 'no new faculty should be created');

        $faculty->refresh();

        $this->assertSame(['Machine Learning', 'Federated Learning'], $faculty->expertise);
        $this->assertSame($before['name'], $faculty->user->name());
        $this->assertSame($before['designation'], $faculty->designation);
        $this->assertSame($before['department_id'], $faculty->department_id);
        $this->assertSame($before['faculty_code'], $faculty->faculty_code);
        $this->assertSame($before['phone'], $faculty->user->phone);
    }

    public function test_semicolons_and_spacing_split_the_same_way(): void
    {
        $this->admin();

        $faculty = Faculty::whereNotNull('user_id')->firstOrFail();

        $this->postJson('/api/faculty/bulk-import', [
            'batch_data' => [$this->row($faculty->user->email, ' Computer Networks ;Network Security,  Wireless Networks ')],
        ])->assertOk();

        $this->assertSame(
            ['Computer Networks', 'Network Security', 'Wireless Networks'],
            $faculty->refresh()->expertise,
        );
    }

    public function test_an_unknown_email_is_refused_rather_than_creating_a_faculty_member(): void
    {
        $this->admin();

        $missing = 'not.a.real.account.' . uniqid() . '@thapar.edu';

        $response = $this->postJson('/api/faculty/bulk-import', [
            'batch_data' => [$this->row($missing, 'Machine Learning')],
        ]);

        $response->assertOk();
        $this->assertSame(1, $response->json('data.error_count'));
        $this->assertSame(0, $response->json('data.success_count'));
        $this->assertNull(User::where('email', $missing)->first());
    }

    public function test_a_role_without_the_capability_is_refused(): void
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', 'student')->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');

        $this->postJson('/api/faculty/bulk-import', [
            'batch_data' => [$this->row('anyone@thapar.edu', 'Machine Learning')],
        ])->assertForbidden();
    }
}

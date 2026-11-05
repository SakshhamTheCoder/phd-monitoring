<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/** A department's name and code are edited from the same dialog as its officers. */
class DepartmentEditTest extends TestCase
{
    use DatabaseTransactions;

    private function actAs(string $role): void
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', $role)->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');
    }

    public function test_the_name_and_code_are_changed_in_place(): void
    {
        $this->actAs('admin');
        $department = Department::create(['name' => 'Old name', 'code' => 'ZZOLD']);

        $this->putJson("/api/departments/update/{$department->id}", ['name' => ' New name ', 'code' => ' ZZNEW '])
            ->assertOk();

        $this->assertSame(['New name', 'ZZNEW'], [$department->fresh()->name, $department->fresh()->code]);
    }

    public function test_a_code_another_department_holds_is_refused(): void
    {
        $this->actAs('admin');
        $first = Department::create(['name' => 'First', 'code' => 'ZZONE']);
        $second = Department::create(['name' => 'Second', 'code' => 'ZZTWO']);

        $this->putJson("/api/departments/update/{$second->id}", ['name' => 'Second', 'code' => 'zzone'])
            ->assertStatus(422);

        $this->assertSame('ZZTWO', $second->fresh()->code);
        // Keeping its own code is not a clash.
        $this->putJson("/api/departments/update/{$first->id}", ['name' => 'First renamed', 'code' => 'ZZONE'])->assertOk();
    }

    public function test_a_blank_name_or_unknown_department_is_refused(): void
    {
        $this->actAs('admin');
        $department = Department::create(['name' => 'Named', 'code' => 'ZZTHREE']);

        $this->putJson("/api/departments/update/{$department->id}", ['name' => '', 'code' => 'ZZTHREE'])->assertStatus(422);
        $this->putJson('/api/departments/update/999999', ['name' => 'X', 'code' => 'Y'])->assertNotFound();
    }
}

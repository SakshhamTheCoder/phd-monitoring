<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Grants can_delete_students/can_delete_faculties to admin, matching who already holds can_manage_users.
return new class extends Migration
{
    private const DELETE_STUDENTS = ['admin'];
    private const DELETE_FACULTIES = ['admin'];

    public function up(): void
    {
        $this->apply('can_delete_students', self::DELETE_STUDENTS);
        $this->apply('can_delete_faculties', self::DELETE_FACULTIES);
    }

    public function down(): void
    {
        DB::table('roles')->update([
            'can_delete_students' => 'false',
            'can_delete_faculties' => 'false',
        ]);
    }

    private function apply(string $capability, array $roles): void
    {
        DB::table('roles')->update([$capability => 'false']);
        DB::table('roles')->whereIn('role', $roles)->update([$capability => 'true']);
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The filter bar reads the fields a page offers from this table, so a page with
 * no rows shows no bar at all. Manage Users had none, and Departments had one
 * row naming a student's roll number, which is not a column that table has.
 *
 * Both now offer the fields their own list actually holds.
 */
return new class extends Migration
{
    /** Every row here is a plain text match unless it says otherwise. */
    private function rows(): array
    {
        return [
            // Manage Users: User::with(['role', 'current_role', ...]).
            ['users', 'first_name', 'Name', 'string', 'text', null, null],
            ['users', 'email', 'Email', 'string', 'text', null, null],
            ['users', 'phone', 'Phone', 'string', 'text', null, null],
            ['users', 'role.role', 'Main Role', 'string', 'text', null, null],
            ['users', 'current_role.role', 'Current Role', 'string', 'text', null, null],
            ['users', 'status', 'Status', 'select', 'select', null, [
                ['title' => 'Active', 'value' => 'active'],
                ['title' => 'Inactive', 'value' => 'inactive'],
            ]],

            // Departments: Department::with(['hod.user', ...]).
            ['departments', 'name', 'Department', 'string', 'text', null, null],
            ['departments', 'code', 'Code', 'string', 'text', null, null],
            ['departments', 'hod.user.first_name', 'HOD Name', 'string', 'text', '/suggestions/faculty', null],
            ['departments', 'hod_email', 'HOD Email', 'string', 'text', null, null],
        ];
    }

    public function up(): void
    {
        foreach ($this->rows() as [$page, $key, $label, $dataType, $function, $apiUrl, $options]) {
            $exists = DB::table('filters')
                ->where('key_name', $key)
                ->whereJsonContains('applicable_pages', $page)
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('filters')->insert([
                'key_name' => $key,
                'label' => $label,
                'data_type' => $dataType,
                'api_url' => $apiUrl,
                'options' => $options ? json_encode($options) : null,
                'operator' => '=',
                'function_name' => $function,
                'applicable_pages' => json_encode([$page]),
            ]);
        }

        // A student's roll number is not a column the departments table has. The
        // row itself stays: the forms page does offer it.
        DB::table('filters')
            ->where('key_name', 'student.roll_no')
            ->whereJsonContains('applicable_pages', 'departments')
            ->update(['applicable_pages' => json_encode(['forms'])]);
    }

    public function down(): void
    {
        foreach ($this->rows() as [$page, $key]) {
            DB::table('filters')
                ->where('key_name', $key)
                ->whereJsonContains('applicable_pages', $page)
                ->where('applicable_pages', json_encode([$page]))
                ->delete();
        }

        DB::table('filters')
            ->where('key_name', 'student.roll_no')
            ->where('applicable_pages', json_encode(['forms']))
            ->update(['applicable_pages' => json_encode(['forms', 'departments'])]);
    }
};

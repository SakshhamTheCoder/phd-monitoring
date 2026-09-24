<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Course Management, Areas of Specialization and Outside Experts had a filters
 * endpoint and a list that applies filters, but no rows here, so their pages
 * drew no filter bar. Each now offers the fields its own list holds.
 */
return new class extends Migration
{
    private function rows(): array
    {
        return [
            // Course::with('department').
            ['courses', 'course_code', 'Code'],
            ['courses', 'course_name', 'Course'],
            ['courses', 'department.name', 'Department'],

            // AreaOfSpecialization::with('department').
            ['area_of_specialization', 'name', 'Area'],
            ['area_of_specialization', 'department.name', 'Department'],

            // OutsideExpert::query().
            ['outside_experts', 'first_name', 'First Name'],
            ['outside_experts', 'last_name', 'Last Name'],
            ['outside_experts', 'email', 'Email'],
            ['outside_experts', 'institution', 'Institution'],
            ['outside_experts', 'department', 'Department'],
            ['outside_experts', 'area_of_expertise', 'Area of Expertise'],
        ];
    }

    public function up(): void
    {
        foreach ($this->rows() as [$page, $key, $label]) {
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
                'data_type' => 'string',
                'api_url' => null,
                'options' => null,
                'operator' => '=',
                'function_name' => 'text',
                'applicable_pages' => json_encode([$page]),
            ]);
        }
    }

    public function down(): void
    {
        foreach ($this->rows() as [$page, $key]) {
            DB::table('filters')
                ->where('key_name', $key)
                ->where('applicable_pages', json_encode([$page]))
                ->delete();
        }
    }
};

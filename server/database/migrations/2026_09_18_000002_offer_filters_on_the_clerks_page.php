<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Clerk Management draws a filter bar but had no rows to fill it, so the bar
 * asked for a list that did not exist and drew nothing at all.
 *
 * The page holds its clerks in one small unpaginated list and filters them in
 * the browser, so these rows describe the fields that list carries rather than
 * columns of a query.
 */
return new class extends Migration
{
    private function rows(): array
    {
        return [
            ['name', 'Name', 'string', 'text', null, null],
            ['email', 'Email', 'string', 'text', null, null],
            ['phone', 'Phone', 'string', 'text', null, null],
            ['department.name', 'Department', 'string', 'text', '/suggestions/department', null],
            ['status', 'Status', 'select', 'select', null, [
                ['title' => 'Active', 'value' => 'active'],
                ['title' => 'Inactive', 'value' => 'inactive'],
            ]],
        ];
    }

    public function up(): void
    {
        foreach ($this->rows() as [$key, $label, $dataType, $function, $apiUrl, $options]) {
            $exists = DB::table('filters')
                ->where('key_name', $key)
                ->whereJsonContains('applicable_pages', 'clerks')
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
                'applicable_pages' => json_encode(['clerks']),
            ]);
        }
    }

    public function down(): void
    {
        foreach ($this->rows() as [$key]) {
            DB::table('filters')
                ->where('key_name', $key)
                ->where('applicable_pages', json_encode(['clerks']))
                ->delete();
        }
    }
};

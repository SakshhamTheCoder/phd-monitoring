<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The filters the UG students list offers. Its own page, so the keys it
 * accepts are its own: a filter on any other column is refused.
 */
return new class extends Migration
{
    private const FILTERS = [
        ['user.first_name', 'Student Name', null],
        ['roll_no', 'Roll No', null],
        ['branch.name', 'Branch', null],
        ['branch.programme', 'Programme', null],
    ];

    public function up(): void
    {
        foreach (self::FILTERS as [$key, $label, $api]) {
            DB::table('filters')->insert([
                'key_name' => $key,
                'label' => $label,
                'data_type' => 'string',
                'function_name' => 'text',
                'api_url' => $api,
                'applicable_pages' => json_encode(['ug_students']),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('filters')->whereJsonContains('applicable_pages', 'ug_students')->delete();
    }
};

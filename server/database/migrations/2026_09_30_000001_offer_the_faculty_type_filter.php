<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The faculty list holds two kinds of people now: the institute's own staff,
 * and the supervisors who guide its scholars from other institutes. The list
 * names where an outside one guides from, and this is how you ask for one kind
 * on its own.
 */
return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('filters')
            ->where('key_name', 'type')
            ->whereJsonContains('applicable_pages', 'faculty')
            ->exists();

        if ($exists) {
            return;
        }

        DB::table('filters')->insert([
            'key_name' => 'type',
            'label' => 'Type',
            'data_type' => 'select',
            'api_url' => null,
            'options' => json_encode([
                ['title' => 'Institute staff', 'value' => 'internal'],
                ['title' => 'Outside supervisor', 'value' => 'external'],
            ]),
            'operator' => '=',
            'function_name' => 'select',
            'applicable_pages' => json_encode(['faculty']),
        ]);
    }

    public function down(): void
    {
        DB::table('filters')
            ->where('key_name', 'type')
            ->whereJsonContains('applicable_pages', 'faculty')
            ->delete();
    }
};

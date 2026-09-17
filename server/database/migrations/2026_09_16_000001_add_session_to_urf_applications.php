<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A student may be on a URF project every year, so each application belongs to
 * a session: the calendar year it was submitted in. Existing applications take
 * the year they were created. The admin list can filter by it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('urf_applications', function (Blueprint $table) {
            $table->unsignedSmallInteger('session')->nullable()->after('project_title')->index();
        });

        DB::table('urf_applications')->whereNull('session')->update(['session' => DB::raw('YEAR(created_at)')]);

        DB::table('filters')->insert([
            'key_name' => 'session',
            'label' => 'Session (Year)',
            'data_type' => 'string',
            'function_name' => 'text',
            'api_url' => null,
            'applicable_pages' => json_encode(['urf']),
        ]);
    }

    public function down(): void
    {
        DB::table('filters')->where('key_name', 'session')->whereJsonContains('applicable_pages', 'urf')->delete();

        Schema::table('urf_applications', function (Blueprint $table) {
            $table->dropIndex(['session']);
            $table->dropColumn('session');
        });
    }
};

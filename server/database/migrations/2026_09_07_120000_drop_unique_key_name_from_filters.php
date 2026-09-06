<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The filters table holds PER-PAGE filter definitions. `key_name` alone was
 * never a valid unique key: two pages legitimately need a filter with the
 * same key_name (e.g. `status`) but a different label, options and page set
 * (forms/presentation's Form Status vs. projects' Project Status). Keeping
 * key_name unique meant one page's row silently overwrote the other's the
 * moment both existed, and re-seeding an already-seeded database threw
 * SQLSTATE 23000 on the very next insert. Idempotency is now handled by the
 * seeder itself (keyed on key_name + applicable_pages), so the DB-level
 * unique constraint is no longer needed.
 */
return new class extends Migration
{
    public function up()
    {
        Schema::table('filters', function (Blueprint $table) {
            $table->dropUnique('filters_key_name_unique');
        });
    }

    public function down()
    {
        Schema::table('filters', function (Blueprint $table) {
            $table->unique('key_name');
        });
    }
};

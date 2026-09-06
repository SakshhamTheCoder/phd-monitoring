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
        // down() is deliberately a no-op (see below), so a prior rollback can
        // leave the index already gone — guard the drop so up() stays safe
        // to re-run instead of failing with "check that column/key exists".
        $indexes = collect(Schema::getIndexes('filters'))->pluck('name');
        if ($indexes->contains('filters_key_name_unique')) {
            Schema::table('filters', function (Blueprint $table) {
                $table->dropUnique('filters_key_name_unique');
            });
        }
    }

    /**
     * Deliberately a no-op. The seeder now creates duplicate key_name rows
     * BY DESIGN (e.g. `status` exists twice: "Form Status" for
     * forms/presentation and "Project Status" for projects), so restoring
     * filters_key_name_unique is not possible without deleting one of every
     * such pair — real, in-use filter rows. Silently discarding data on a
     * rollback is worse than leaving the constraint dropped, so down() does
     * nothing rather than either throwing (breaking migrate:rollback /
     * migrate:refresh on any seeded database) or quietly deleting rows.
     */
    public function down()
    {
        // Intentionally left blank — see docblock above.
    }
};

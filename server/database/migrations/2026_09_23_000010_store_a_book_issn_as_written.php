<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An ISSN is written "1234-5678" and can end in X, so an integer column refused
 * the real thing. Both tables that take a book's ISSN hold it as text now.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['publications', 'faculty_publications'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('issn', 20)->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        // Not reversed: an ISSN saved with its hyphen will not fit an integer
        // column again, so tightening it back would refuse to run.
    }
};

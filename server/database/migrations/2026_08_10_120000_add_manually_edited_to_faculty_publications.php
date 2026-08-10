<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marks a synced publication that someone has corrected by hand.
 *
 * Sync matches on external_id and rewrites the row, so a manual correction, most
 * often moving a paper into the right category, was undone by the next sync.
 * Once this flag is set the sync leaves that row alone.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('faculty_publications', function (Blueprint $table) {
            $table->boolean('manually_edited')->default(false)->after('verified');
        });
    }

    public function down(): void
    {
        Schema::table('faculty_publications', function (Blueprint $table) {
            $table->dropColumn('manually_edited');
        });
    }
};

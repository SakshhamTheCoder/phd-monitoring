<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The same two columns the students carry, on the staff.
 *
 * The office imports a sheet, waits until those people have been told the
 * portal exists, and then mails them their sign-in link. With one import that
 * is "the last one"; with four, the earlier three stop being reachable that
 * way and the office is left mailing everybody or nobody. Naming the run each
 * person arrived on is what lets them be picked later.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('faculty', function (Blueprint $table) {
            $table->string('import_batch', 64)->nullable()->index();
            $table->timestamp('imported_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('faculty', function (Blueprint $table) {
            $table->dropIndex(['import_batch']);
            $table->dropColumn(['import_batch', 'imported_at']);
        });
    }
};

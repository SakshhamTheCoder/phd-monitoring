<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The same two columns students and faculty carry, on users itself.
 *
 * A clerk or an "office or admin" login has no student or faculty row behind
 * it, so the students.import_batch and faculty.import_batch that already
 * track a run cannot see them. Without a mark on users directly, the users
 * import and the clerks import can never be picked as their own run on Send
 * sign-in links, only folded into "everyone who cannot sign in yet".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('import_batch', 64)->nullable()->index();
            $table->timestamp('imported_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['import_batch']);
            $table->dropColumn(['import_batch', 'imported_at']);
        });
    }
};

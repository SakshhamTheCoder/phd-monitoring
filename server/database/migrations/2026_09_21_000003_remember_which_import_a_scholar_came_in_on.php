<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which run of the students import a scholar's row came in on.
 *
 * The office imports the institute's sheet, waits a few days, and then mails
 * those scholars the link that lets them sign in. "Those scholars" has to mean
 * the ones that import brought in, not every scholar who has never signed in,
 * and nobody should have to keep that list by hand.
 *
 * The id is chosen by the screen doing the importing and sent with every batch
 * of fifty, so one office run is one batch however many requests it takes.
 * imported_at is what orders them, so the newest run can be found without
 * reading the id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->string('import_batch', 64)->nullable()->index();
            $table->timestamp('imported_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropIndex(['import_batch']);
            $table->dropColumn(['import_batch', 'imported_at']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A project awarded before the portal existed has no proposal in it.
 *
 * The file was submitted somewhere else, so there is nothing to store and a
 * placeholder path would be a broken download rather than an honest gap. Every
 * reader already guards on the value being present, so null shows no link.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('urf_applications', function (Blueprint $table) {
            $table->string('proposal')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Not reversed: rows imported from the awarded sheet have no proposal to
        // put back, so tightening the column again would refuse to run.
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every workflow step has an `<role>_available` flag on `forms` except the
 * external reviewer, whose column was never created even though five places
 * in the code read or write it: AdminFormController when it publishes a form
 * type, FormLevelController::setAvailable, and Faculty::forms.
 *
 * The reads fail outright ("Unknown column"), and the writes go through mass
 * assignment, where the missing `$fillable` entry silently dropped them, so
 * the external step could never be turned on. Adding the column with the same
 * shape as its siblings is what the rest of the machinery already assumes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->boolean('external_available')->default(false)->after('doctoral_available');
        });
    }

    public function down(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn('external_available');
        });
    }
};

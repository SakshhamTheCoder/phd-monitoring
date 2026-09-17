<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A UG student's publications are theirs, in one library across every URF
 * project, as a PhD scholar's are. The library entries move from the project
 * onto the student (users.id); the copies linked to a report keep their project
 * as well, since that is where the admin reads them.
 *
 * Existing library entries go to the student who filled the project in.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['publications', 'patents'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->integer('user_id')->unsigned()->nullable()->after('urf_application_id');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            });

            DB::statement("UPDATE {$name} p JOIN urf_applications a ON a.id = p.urf_application_id SET p.user_id = a.user_id WHERE p.user_id IS NULL");
            DB::table($name)->whereNull('form_id')->whereNotNull('urf_application_id')->update(['urf_application_id' => null]);
        }
    }

    public function down(): void
    {
        foreach (['publications', 'patents'] as $name) {
            // Back onto each student's latest project they filled in.
            DB::statement("UPDATE {$name} p SET p.urf_application_id = (SELECT MAX(a.id) FROM urf_applications a WHERE a.user_id = p.user_id) WHERE p.form_id IS NULL AND p.user_id IS NOT NULL");

            Schema::table($name, function (Blueprint $table) {
                $table->dropForeign(['user_id']);
                $table->dropColumn('user_id');
            });
        }
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When a constitution form records an IRB that was constituted before the
 * portal existed, rather than one that was filed in it.
 *
 * The scholar needs the form to exist: irbCompleted() and phdTitleLocked() both
 * read it, so without one an imported scholar counts as pre-IRB, their title
 * stays tentative and editable, and the supervisor change form refuses to open.
 *
 * But nobody filled it in, and drawing the ordinary six-step ladder over it
 * would show six blank recommendations, which reads as six approvals given
 * here. This says the form is a record rather than a decision, and the page
 * shows a summary instead.
 *
 * A timestamp rather than a flag: when it was carried over is worth keeping and
 * costs nothing over a boolean.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('constitute_of_irb', function (Blueprint $table) {
            $table->timestamp('carried_over_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('constitute_of_irb', function (Blueprint $table) {
            $table->dropColumn('carried_over_at');
        });
    }
};

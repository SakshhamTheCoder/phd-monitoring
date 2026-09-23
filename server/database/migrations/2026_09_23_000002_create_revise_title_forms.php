<?php

use App\Models\Traits\MigrationCommonFormFields;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Revise Title as a form of its own.
 *
 * It used to be served by the synopsis controller, so a request to change the
 * title was a synopsis row: it demanded a synopsis PDF and would have
 * overwritten the scholar's synopsis. It asks for two things only, the new
 * title and the new objectives, and neither reaches the scholar's record until
 * the DORDC approves.
 */
return new class extends Migration
{
    use MigrationCommonFormFields;

    public function up(): void
    {
        Schema::create('revise_title_forms', function (Blueprint $table) {
            $this->addCommonFields($table);
            $table->timestamps();
            $table->text('revised_title')->nullable();
            // Held on the form until completion, then written over the scholar's
            // 'revised' objectives. A list of lines, so a JSON column rather than
            // a second table.
            $table->json('revised_objectives')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revise_title_forms');
    }
};

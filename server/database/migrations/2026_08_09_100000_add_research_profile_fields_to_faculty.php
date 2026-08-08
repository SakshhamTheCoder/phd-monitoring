<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('faculty', function (Blueprint $table) {
            $table->string('orcid_id')->nullable();
            $table->string('scopus_id')->nullable();
            $table->string('google_scholar_id')->nullable();
            $table->integer('citations')->nullable();
            $table->integer('h_index')->nullable();
            $table->date('joined_on')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->string('last_sync_source')->nullable();
        });
    }

    public function down(): void {
        Schema::table('faculty', function (Blueprint $table) {
            $table->dropColumn([
                'orcid_id', 'scopus_id', 'google_scholar_id', 'citations',
                'h_index', 'joined_on', 'last_synced_at', 'last_sync_source',
            ]);
        });
    }
};

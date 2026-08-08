<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('project_positions', function (Blueprint $table) {
            // Lets a PI stop applications before the deadline, or keep a position
            // listed past one. The filled count is derived from selected
            // applications rather than stored, so it cannot drift.
            $table->enum('status', ['Open', 'Closed'])->default('Open')->after('openings');
        });
    }

    public function down(): void {
        Schema::table('project_positions', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};

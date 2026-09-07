<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('projects', function (Blueprint $table) {
            if (!Schema::hasColumn('projects', 'sdgs')) {
                $table->json('sdgs')->nullable()->after('focus_area');
            }
            if (!Schema::hasColumn('projects', 'gantt_chart_path')) {
                $table->text('gantt_chart_path')->nullable()->after('sanction_letter_name');
            }
            if (!Schema::hasColumn('projects', 'gantt_chart_name')) {
                $table->text('gantt_chart_name')->nullable()->after('gantt_chart_path');
            }
        });
    }

    public function down(): void {
        Schema::table('projects', function (Blueprint $table) {
            foreach (['sdgs', 'gantt_chart_path', 'gantt_chart_name'] as $column) {
                if (Schema::hasColumn('projects', $column)) $table->dropColumn($column);
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('students', function (Blueprint $table) {
            if (!Schema::hasColumn('students', 'date_of_thesis')) {
                // Sits with the other milestone dates rather than at the end of
                // the table, so the schema reads in the order the degree runs.
                $table->date('date_of_thesis')->nullable()->after('date_of_synopsis');
            }
        });
    }

    public function down(): void {
        Schema::table('students', function (Blueprint $table) {
            if (Schema::hasColumn('students', 'date_of_thesis')) {
                $table->dropColumn('date_of_thesis');
            }
        });
    }
};

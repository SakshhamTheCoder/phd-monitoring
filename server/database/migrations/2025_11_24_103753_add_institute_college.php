<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
         Schema::table('faculty', function (Blueprint $table) {
            $table->enum('type', ['internal', 'external'])->default('internal');
            // NOTE: MySQL can't give a TEXT column a default value (strict mode rejects it),
            // and the real schema has none — so this column is nullable with no default.
            $table->text('institution')->nullable();
            $table->text('website_link')->nullable();
        });
       
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What the office has to know about an outside expert before the record is
 * worth having: who they are, and the address their review link is sent to.
 *
 * Their designation, department and institution were required as well, and a
 * HOD naming three experts often has no more than a name and an address. An
 * expert cannot sign in and fill the rest in later either, so requiring them
 * meant a plausible-looking guess typed into the gap, which is worse than an
 * empty cell the office can see is empty. All three are now optional, and the
 * screens that show them already read a missing one as blank.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('outside_experts', function (Blueprint $table) {
            $table->string('designation')->nullable()->change();
            $table->string('department')->nullable()->change();
            $table->string('institution')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('outside_experts', function (Blueprint $table) {
            $table->string('designation')->nullable(false)->change();
            $table->string('department')->nullable(false)->change();
            $table->string('institution')->nullable(false)->change();
        });
    }
};

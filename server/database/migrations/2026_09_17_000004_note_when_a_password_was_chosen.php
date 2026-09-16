<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Whether the account holder has ever chosen their own password.
 *
 * Signing up with Google sets a random one nobody knows, and an admin creating
 * an account generates one and reads it out. Changing a password asks for the
 * current one, which neither of those people can give, so this says when a
 * password was last chosen and is null when it never was.
 *
 * Every account that exists today has a password someone was told, so they are
 * all marked as chosen.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('password_set_at')->nullable()->after('password');
        });

        DB::table('users')->update(['password_set_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('password_set_at');
        });
    }
};

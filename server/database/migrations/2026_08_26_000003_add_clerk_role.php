<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // The clerk role is a pure permission role: it needs no faculty or
        // student record, only its department taggings. Every capability column
        // stays at its default ('false') because clerks authorize against
        // clerk_departments directly, not against these flags.
        DB::table('roles')->insertOrIgnore([
            'role' => 'clerk',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Only remove the role if no user still holds it as their primary role,
        // otherwise the delete would cascade and take live accounts with it.
        $clerkRole = DB::table('roles')->where('role', 'clerk')->first();
        if ($clerkRole && !DB::table('users')->where('role_id', $clerkRole->id)->exists()) {
            DB::table('roles')->where('id', $clerkRole->id)->delete();
        }
    }
};

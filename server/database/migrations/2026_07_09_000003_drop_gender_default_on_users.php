<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * users.gender defaulted to 'Female', so any user whose gender was never explicitly
 * chosen silently read back as Female (a male student would show "Female"). Drop the
 * default so gender stays NULL until actually set, forcing an explicit choice.
 *
 * NOTE: existing rows already have 'Female' physically stored from the old default
 * and cannot be distinguished from genuine Female entries, so they are left as-is.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY gender ENUM('Male','Female') NULL DEFAULT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE users MODIFY gender ENUM('Male','Female') NULL DEFAULT 'Female'");
    }
};

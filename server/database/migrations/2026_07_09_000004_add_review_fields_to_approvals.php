<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Support the secure external-expert review flow: mark a token single-use once the
 * expert responds (consumed_at) and store their comment. No expiry column by design.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approvals', function (Blueprint $table) {
            $table->timestamp('consumed_at')->nullable()->after('approved');
            $table->text('comment')->nullable()->after('consumed_at');
        });
    }

    public function down(): void
    {
        Schema::table('approvals', function (Blueprint $table) {
            $table->dropColumn(['consumed_at', 'comment']);
        });
    }
};

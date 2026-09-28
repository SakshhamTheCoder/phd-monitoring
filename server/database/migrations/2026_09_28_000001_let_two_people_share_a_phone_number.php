<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A phone number is not an identity, and two people may share one.
 *
 * The institute's scholar sheet has sisters on one number, and a household or
 * a lab landline is ordinary. The unique index refused the second person
 * outright, which cost a real scholar their record over a field nothing is
 * matched on: people are found by email and registration number.
 *
 * Kept as an ordinary index, because the field is searched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_phone_unique');
            $table->index('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['phone']);
            $table->unique('phone');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The ADORDC's office address, the pair of the HoD's.
 *
 * The officers sheet fills the ADORDC column with the DoRSP office aliases,
 * adorsp1 to adorsp4. None of them is an account, so they can hold no seat:
 * the ADORDC is a person who signs in and answers form steps, and one alias
 * covers up to four departments. The person goes in the ADORDC Email column by
 * their own address, exactly as the HoD does, and the alias is kept here as
 * what it is, an address to write to.
 *
 * Nullable, because several departments have no office alias at all, and a
 * blank cell leaves whatever is stored alone rather than clearing it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->string('adordc_email')->nullable()->after('adordc_id');
        });
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->dropColumn('adordc_email');
        });
    }
};

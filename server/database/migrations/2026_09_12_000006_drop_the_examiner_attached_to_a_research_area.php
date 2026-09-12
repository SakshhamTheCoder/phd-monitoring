<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Removes the standing examiner a research area could carry.
 *
 * The idea was that an area named one external examiner, and every scholar in
 * that area inherited them onto their doctoral committee when the DoRDC
 * approved the IRB. Nobody chose that person for that scholar; the area did.
 *
 * It was never adopted. Three areas carried an examiner: one named "Will be
 * Changed Later" pointing at a gmail address, one belonging to a test flow, and
 * one pointing at a thapar.edu undergraduate address. The committee rows they
 * produced all came from exercising the feature rather than running it.
 *
 * It also sat oddly beside the expert the DoRDC actually picks. That one is
 * nominated by the HoD, chosen by a person, and deliberately gets no portal
 * login, as the comment beside it says. This one appeared on its own and had an
 * account created for it. An external examiner is now only ever someone a
 * person named for a particular scholar.
 *
 * An area is a department and a name again, which is exactly what the
 * institute's matrix sheet carries.
 *
 * down() restores the column but not the three links: which examiner belonged
 * to which area is not recoverable once the column is gone. The experts
 * themselves are untouched in `outside_experts`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('area_of_specializations', function (Blueprint $table) {
            $table->dropForeign(['outside_expert_id']);
            $table->dropColumn('outside_expert_id');
        });
    }

    public function down(): void
    {
        Schema::table('area_of_specializations', function (Blueprint $table) {
            $table->integer('outside_expert_id')->unsigned()->nullable()->after('name');
            $table->foreign('outside_expert_id')
                ->references('id')->on('outside_experts')->nullOnDelete();
        });
    }
};

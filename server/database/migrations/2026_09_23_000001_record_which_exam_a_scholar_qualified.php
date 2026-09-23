<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * NET or GATE, not yes or no.
 *
 * The office asked which exam a scholar qualified, and the sheet already names
 * it (GATE, NET(UGC/CSIR), DBT-BET, GPAT). A boolean threw that away. The
 * value is short text: NET, GATE or NA from the portal, or the sheet's own
 * name for anything else. A yes recorded before this cannot say which exam,
 * so it is kept as "NET/GATE"; a no becomes NA.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->string('net_gate', 40)->nullable()->after('is_jrf');
        });

        DB::table('students')->where('is_net_gate_qualified', true)->update(['net_gate' => 'NET/GATE']);
        DB::table('students')->where('is_net_gate_qualified', false)->update(['net_gate' => 'NA']);

        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('is_net_gate_qualified');
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->boolean('is_net_gate_qualified')->nullable()->after('is_jrf');
        });

        DB::table('students')->where('net_gate', 'NA')->update(['is_net_gate_qualified' => false]);
        DB::table('students')->whereNotNull('net_gate')->where('net_gate', '!=', 'NA')->update(['is_net_gate_qualified' => true]);

        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('net_gate');
        });
    }
};

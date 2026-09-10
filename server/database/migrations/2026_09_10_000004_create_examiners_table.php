<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One row per real external examiner, shared across every form.
 *
 * Until now an examiner existed only as a row on the form that proposed them,
 * so the same person was stored once per form, the examiner search returned a
 * hit per form rather than per person, and a correction to a name or an email
 * reached exactly one form. Email is the identity: it is what a supervisor
 * searches on and what an imported list is keyed by.
 *
 * The existing per-form rows are folded in below, so no proposed examiner is
 * lost and every form keeps pointing at the same person it always did.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('examiners', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->string('email')->unique();
            $table->string('institution');
            $table->string('designation');
            $table->string('department');
            $table->string('phone')->nullable();
            $table->timestamps();
        });

        Schema::table('examiners_recommendation', function (Blueprint $table) {
            $table->integer('examiner_id')->unsigned()->nullable()->index()->after('form_id');
        });

        // Fold the per-form rows into the directory, oldest first so the
        // earliest spelling of a person wins and later rows attach to it.
        $rows = DB::table('examiners_recommendation')->orderBy('id')->get();
        foreach ($rows as $row) {
            $email = trim((string) $row->email);
            if ($email === '') {
                continue;
            }

            $examinerId = DB::table('examiners')->where('email', $email)->value('id');
            if (!$examinerId) {
                $examinerId = DB::table('examiners')->insertGetId([
                    'name' => $row->name,
                    'email' => $email,
                    'institution' => $row->institution,
                    'designation' => $row->designation,
                    'department' => $row->department,
                    'phone' => $row->phone,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('examiners_recommendation')->where('id', $row->id)->update(['examiner_id' => $examinerId]);
        }

        Schema::table('examiners_recommendation', function (Blueprint $table) {
            $table->foreign('examiner_id')->references('id')->on('examiners')->onDelete('cascade');

            // Who the examiner is now lives in one place. What stays here is
            // what belongs to this form: which list, and the verdict on them.
            $table->dropColumn(['name', 'email', 'institution', 'designation', 'department', 'phone']);
        });
    }

    public function down(): void
    {
        Schema::table('examiners_recommendation', function (Blueprint $table) {
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('institution')->nullable();
            $table->string('designation')->nullable();
            $table->string('department')->nullable();
            $table->string('phone')->nullable();
        });

        // Copy each examiner back onto the rows that referenced them.
        $rows = DB::table('examiners_recommendation')->whereNotNull('examiner_id')->get();
        foreach ($rows as $row) {
            $examiner = DB::table('examiners')->where('id', $row->examiner_id)->first();
            if ($examiner) {
                DB::table('examiners_recommendation')->where('id', $row->id)->update([
                    'name' => $examiner->name,
                    'email' => $examiner->email,
                    'institution' => $examiner->institution,
                    'designation' => $examiner->designation,
                    'department' => $examiner->department,
                    'phone' => $examiner->phone,
                ]);
            }
        }

        Schema::table('examiners_recommendation', function (Blueprint $table) {
            $table->dropForeign(['examiner_id']);
            $table->dropColumn('examiner_id');
        });

        Schema::dropIfExists('examiners');
    }
};

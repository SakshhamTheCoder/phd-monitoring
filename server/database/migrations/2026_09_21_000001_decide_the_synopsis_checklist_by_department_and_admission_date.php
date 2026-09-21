<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Which declarations a synopsis offers is not decided by the admission year
 * alone. The regulations name three kinds of clause:
 *
 *   - clauses for a named set of departments (Humanities, LMTSM),
 *   - clauses for every other department,
 *   - clauses for an admission date range, which cut across departments.
 *
 * A scholar is shown every clause whose conditions they meet, merged into one
 * list. Where a department has its own complete set, that set stands alone and
 * the date clauses do not apply to it, which is what `exclusive` says.
 *
 * So a rule is a condition, and the options hang off it. The year column the
 * options carried becomes one rule per year, which keeps anything already
 * declared reading back the same.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('synopsis_checklist_rules', function (Blueprint $table) {
            $table->id();
            // What an admin calls this condition, e.g. "All other departments"
            // or "Admitted between July 2018 and July 2025". Never shown to a
            // scholar: they read the options, not the reason they were offered.
            $table->string('name');
            // The departments this rule covers. Empty or null means any
            // department, which is how a date-only clause is written.
            $table->json('department_ids')->nullable();
            // Bounds on the scholar's date of registration. Either may be left
            // open: "before July 2018" is an end with no start.
            $table->date('admitted_from')->nullable();
            $table->date('admitted_to')->nullable();
            // A department whose regulations list a complete set of its own.
            // When such a rule matches, only rules like it are offered, so the
            // general and date clauses stay out of that department's list.
            $table->boolean('exclusive')->default(false);
            $table->integer('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::table('synopsis_checklist_options', function (Blueprint $table) {
            $table->unsignedBigInteger('rule_id')->nullable()->after('id');
        });

        foreach (DB::table('synopsis_checklist_options')->distinct()->pluck('admission_year') as $year) {
            $ruleId = DB::table('synopsis_checklist_rules')->insertGetId([
                'name' => "Admitted in {$year}",
                'department_ids' => null,
                'admitted_from' => "{$year}-01-01",
                'admitted_to' => "{$year}-12-31",
                'exclusive' => false,
                'sort_order' => 0,
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('synopsis_checklist_options')
                ->where('admission_year', $year)
                ->update(['rule_id' => $ruleId]);
        }

        Schema::table('synopsis_checklist_options', function (Blueprint $table) {
            $table->dropUnique('synopsis_checklist_options_admission_year_label_unique');
            $table->dropColumn('admission_year');
            $table->foreign('rule_id')->references('id')->on('synopsis_checklist_rules')->cascadeOnDelete();
            $table->unique(['rule_id', 'label']);
        });
    }

    public function down(): void
    {
        Schema::table('synopsis_checklist_options', function (Blueprint $table) {
            $table->smallInteger('admission_year')->default(0)->after('id');
        });

        foreach (DB::table('synopsis_checklist_rules')->get() as $rule) {
            DB::table('synopsis_checklist_options')
                ->where('rule_id', $rule->id)
                ->update(['admission_year' => (int) date('Y', strtotime($rule->admitted_from ?: '2000-01-01'))]);
        }

        Schema::table('synopsis_checklist_options', function (Blueprint $table) {
            $table->dropUnique(['rule_id', 'label']);
            $table->dropForeign(['rule_id']);
            $table->dropColumn('rule_id');
            $table->unique(['admission_year', 'label']);
        });

        Schema::dropIfExists('synopsis_checklist_rules');
    }
};

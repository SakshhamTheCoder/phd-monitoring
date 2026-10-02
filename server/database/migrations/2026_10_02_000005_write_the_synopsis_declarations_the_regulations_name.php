<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The declarations section 6.4 of the regulations offers, and section 5.6 of
 * the LMTSM regulations, which is a book of its own.
 *
 * 6.4 heads four groups: one for Humanities and Social Sciences with the School
 * of Liberal Arts and Sciences, one for every other department, and two for
 * when the scholar was admitted. A scholar meets the group that names their
 * department and the group that names their admission date, and is offered
 * both. LMTSM answers to 5.6 instead, which is why that condition stands alone.
 *
 * The wording is the regulation's, said as a sentence rather than as the
 * clause's shorthand, because a supervisor reads it on the form with no
 * document beside them.
 *
 * Written here rather than left to an admin because the portal shipped with the
 * conditions empty, which asks a supervisor for nothing at all and leaves a
 * synopsis with no declaration on it. A rule already written is left alone, so
 * this runs safely over a database where the office has started.
 */
return new class extends Migration
{
    public function up(): void
    {
        $humanities = $this->departments(['DHSS', 'TSLAS']);
        $management = $this->departments(['LMTSM']);
        $others = DB::table('departments')
            ->whereNotIn('id', array_merge($humanities, $management))
            ->pluck('id')
            ->all();

        $this->condition('Humanities, Social Sciences and Liberal Arts', [
            'department_ids' => $humanities,
            'sort_order' => 1,
        ], [
            'One paper in the ABDC Journal list, in a B, A or A* category journal',
            'One paper in an SSCI, SCIE or AHCI journal with an impact factor of 2 or more',
            'Two papers in SSCI, SCIE or AHCI journals with an impact factor below 2',
            'One patent granted',
        ]);

        $this->condition('All other departments', [
            'department_ids' => $others,
            'sort_order' => 2,
        ], [
            'One SCIE-indexed article in a Q1 journal with a percentile of 90 or more, '
                . 'and one full paper in a leading Scopus-indexed conference',
            'Two SCIE-indexed journal articles and one full paper in a leading Scopus-indexed conference',
        ]);

        $this->condition('Admitted before July 2018', [
            'admitted_to' => '2018-06-30',
            'sort_order' => 3,
        ], [
            'Two SCI publications, excluding review articles',
        ]);

        $this->condition('Admitted July 2018 to July 2025', [
            'admitted_from' => '2018-07-01',
            'admitted_to' => '2025-07-31',
            'sort_order' => 4,
        ], [
            'Three SCI publications, excluding review articles',
            'Two SCI publications and two Scopus publications, excluding review articles',
            'Two SCI publications with a total impact factor of at least 4, excluding review articles',
            'One patent granted',
        ]);

        // 5.6 of the LMTSM regulations, which replaces 6.4 rather than adding
        // to it, so nothing else is offered beside it.
        $this->condition('LMTSM', [
            'department_ids' => $management,
            'exclusive' => true,
            'sort_order' => 5,
        ], [
            'One paper in the ABDC Journal list, in a B, A, A* or FT-50 category journal',
            'One paper in an SSCI, SCIE or AHCI journal with an impact factor of 2 or more',
            'Two papers in SSCI, SCIE or AHCI journals with an impact factor below 2',
            'Two papers in a Scopus journal in Q1 or Q2',
            'One paper in the LMTSM conference list and one paper in a Scopus Q1 or Q2 journal',
        ]);
    }

    /**
     * The declarations are left in place: one a supervisor has chosen cannot be
     * removed, and the conditions are the regulation rather than this change.
     */
    public function down(): void
    {
    }

    /** @return array<int, int> */
    private function departments(array $codes): array
    {
        return DB::table('departments')->whereIn('code', $codes)->pluck('id')->all();
    }

    /**
     * @param  array<string, mixed>  $condition
     * @param  array<int, string>  $declarations
     */
    private function condition(string $name, array $condition, array $declarations): void
    {
        $existing = DB::table('synopsis_checklist_rules')->where('name', $name)->first();
        if ($existing) {
            return;
        }

        $ruleId = DB::table('synopsis_checklist_rules')->insertGetId(array_merge([
            'name' => $name,
            'department_ids' => null,
            'admitted_from' => null,
            'admitted_to' => null,
            'exclusive' => false,
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ], array_map(
            fn ($value) => is_array($value) ? json_encode(array_values($value)) : $value,
            $condition
        )));

        foreach ($declarations as $order => $label) {
            DB::table('synopsis_checklist_options')->insert([
                'rule_id' => $ruleId,
                'label' => $label,
                'sort_order' => $order + 1,
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
};

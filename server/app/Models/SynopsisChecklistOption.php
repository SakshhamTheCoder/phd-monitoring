<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One line a scholar's synopsis may declare, offered under one rule.
 *
 * The regulations a scholar submits under depend on their department and on
 * when they registered, so the set of declarations differs between scholars.
 * The conditions live on the rule; this is the wording. Exactly one is chosen.
 */
class SynopsisChecklistOption extends Model
{
    protected $table = 'synopsis_checklist_options';

    protected $fillable = [
        'rule_id',
        'label',
        'sort_order',
        'active',
    ];

    protected $casts = [
        'rule_id' => 'integer',
        'sort_order' => 'integer',
        'active' => 'boolean',
    ];

    public function rule()
    {
        return $this->belongsTo(SynopsisChecklistRule::class, 'rule_id');
    }

    /**
     * What this scholar may choose from, merged across every rule they match
     * and ordered rule by rule.
     *
     * Retired options are left out: they are kept so a form that already chose
     * one still reads back the wording that was agreed, not so they can be
     * chosen again.
     */
    public static function forStudent(?Student $student)
    {
        if ($student === null) {
            return collect();
        }

        $rules = SynopsisChecklistRule::matching(
            $student->department_id === null ? null : (int) $student->department_id,
            $student->date_of_registration?->toDateString()
        );

        if ($rules->isEmpty()) {
            return collect();
        }

        $ruleOrder = $rules->pluck('id')->flip();

        return static::whereIn('rule_id', $rules->pluck('id'))
            ->where('active', true)
            ->get()
            ->sortBy(fn (self $option) => [$ruleOrder[$option->rule_id], $option->sort_order, $option->id])
            ->values();
    }
}

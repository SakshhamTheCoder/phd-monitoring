<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One condition under which a set of synopsis declarations is offered.
 *
 * Conditions merge: a scholar sees the options of every rule they match, in
 * rule order. The exception is a rule marked exclusive, which is a department
 * whose regulations list a complete set of its own; when one of those matches,
 * the general and date clauses are left out.
 */
class SynopsisChecklistRule extends Model
{
    protected $table = 'synopsis_checklist_rules';

    protected $fillable = [
        'name',
        'department_ids',
        'admitted_from',
        'admitted_to',
        'exclusive',
        'sort_order',
        'active',
    ];

    protected $casts = [
        'department_ids' => 'array',
        'admitted_from' => 'date',
        'admitted_to' => 'date',
        'exclusive' => 'boolean',
        'sort_order' => 'integer',
        'active' => 'boolean',
    ];

    public function options()
    {
        return $this->hasMany(SynopsisChecklistOption::class, 'rule_id');
    }

    /**
     * Whether a scholar of this department, registered on this date, is covered.
     *
     * No departments listed means any department. No dates means any date. A
     * rule with dates cannot cover a scholar whose registration date is
     * missing: there is no way to tell which side of the bound they fall.
     */
    public function covers(?int $departmentId, ?string $admittedOn): bool
    {
        $departments = $this->department_ids ?: [];
        if ($departments && !in_array($departmentId, array_map('intval', $departments), true)) {
            return false;
        }

        if (!$this->admitted_from && !$this->admitted_to) {
            return true;
        }
        if ($admittedOn === null) {
            return false;
        }
        if ($this->admitted_from && $admittedOn < $this->admitted_from->toDateString()) {
            return false;
        }
        if ($this->admitted_to && $admittedOn > $this->admitted_to->toDateString()) {
            return false;
        }

        return true;
    }

    /** The rules that decide one scholar's list, in the order they apply. */
    public static function matching(?int $departmentId, ?string $admittedOn)
    {
        $matched = static::where('active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->filter(fn (self $rule) => $rule->covers($departmentId, $admittedOn))
            ->values();

        $exclusive = $matched->where('exclusive', true)->values();

        return $exclusive->isNotEmpty() ? $exclusive : $matched;
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One line a scholar may declare on their synopsis, for one admission year.
 *
 * The regulations a scholar submits under are the ones in force when they
 * registered, so the set of declarations differs by year. A scholar picks
 * exactly one.
 */
class SynopsisChecklistOption extends Model
{
    protected $table = 'synopsis_checklist_options';

    protected $fillable = [
        'admission_year',
        'label',
        'sort_order',
        'active',
    ];

    protected $casts = [
        'admission_year' => 'integer',
        'sort_order' => 'integer',
        'active' => 'boolean',
    ];

    /**
     * What a scholar admitted in $year may choose from, in the order it should
     * be shown.
     *
     * Retired options are left out: they are kept so a form that already chose
     * one still reads back the wording that was agreed, not so they can be
     * chosen again.
     */
    public static function forYear(?int $year)
    {
        if ($year === null) {
            return collect();
        }

        return static::where('admission_year', $year)
            ->where('active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
    }
}

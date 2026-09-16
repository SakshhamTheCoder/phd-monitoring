<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The round in which a URF report is filed: when it opens, when it closes, and
 * anything the office wants the fellows to know. One per session per kind of
 * report.
 */
class UrfReportWindow extends Model
{
    protected $fillable = ['session', 'type', 'opens_on', 'closes_on', 'notes'];

    protected $casts = [
        'session' => 'integer',
        'opens_on' => 'date:Y-m-d',
        'closes_on' => 'date:Y-m-d',
    ];

    protected $appends = ['is_open'];

    /** Open today, inclusive of both ends: a round closes at the end of its last day. */
    public function getIsOpenAttribute(): bool
    {
        return $this->opens_on
            && $this->closes_on
            && now()->startOfDay()->betweenIncluded($this->opens_on, $this->closes_on);
    }

    public function scopeFor($query, int $session, string $type)
    {
        return $query->where('session', $session)->where('type', $type);
    }
}

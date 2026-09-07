<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Admin-editable leave quotas. The key list lives here so the API, the
 * validation and the reader cannot drift on what a valid setting is.
 */
class LeaveSetting extends Model
{
    protected $table = 'leave_settings';
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['key', 'value'];
    protected $casts = ['value' => 'integer'];

    public const DEFAULTS = [
        'academic_quota' => 10,
        'casual_quota' => 8,
        'year_start_month' => 7,
    ];

    /** Every known key with its stored value, or its default when absent. */
    public static function map(): array
    {
        $stored = static::pluck('value', 'key')->all();

        $map = [];
        foreach (self::DEFAULTS as $key => $default) {
            $map[$key] = (int) ($stored[$key] ?? $default);
        }

        return $map;
    }

    public static function value(string $key): int
    {
        return self::map()[$key] ?? self::DEFAULTS[$key];
    }
}

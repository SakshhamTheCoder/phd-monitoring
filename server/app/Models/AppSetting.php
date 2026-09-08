<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Admin-editable settings, grouped by the feature they belong to.
 *
 * A group declares its keys here, with the default each falls back to, the
 * validation its writes must pass, and the roles allowed to read it. Keeping
 * the four together is what stops the API, the validation and the reader
 * drifting on what a valid setting is.
 *
 * To add a group: add an entry. Nothing in the controller changes.
 */
class AppSetting extends Model
{
    protected $table = 'app_settings';
    protected $fillable = ['group', 'key', 'value'];
    protected $casts = ['value' => 'integer'];

    public const GROUPS = [
        'leave' => [
            'defaults' => [
                'academic_quota' => 10,
                'casual_quota' => 8,
                'year_start_month' => 7,
            ],
            'rules' => [
                'academic_quota' => 'required|integer|min:0|max:365',
                'casual_quota' => 'required|integer|min:0|max:365',
                'year_start_month' => 'required|integer|min:1|max:12',
            ],
            // Spec 4.6: every role that shows a leave balance reads these.
            'readers' => ['admin', 'clerk', 'hod', 'student'],
        ],
    ];

    public static function isGroup(string $group): bool
    {
        return array_key_exists($group, self::GROUPS);
    }

    /** Every known key in a group with its stored value, or its default when absent. */
    public static function map(string $group): array
    {
        $stored = static::where('group', $group)->pluck('value', 'key')->all();

        $map = [];
        foreach (self::GROUPS[$group]['defaults'] as $key => $default) {
            $map[$key] = (int) ($stored[$key] ?? $default);
        }

        return $map;
    }

    public static function value(string $group, string $key): int
    {
        return self::map($group)[$key] ?? self::GROUPS[$group]['defaults'][$key];
    }

    public static function put(string $group, string $key, int $value): void
    {
        static::updateOrCreate(['group' => $group, 'key' => $key], ['value' => $value]);
    }
}

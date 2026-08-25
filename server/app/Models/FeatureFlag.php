<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A switch for the modules added in PR #9, so either can be taken out of the
 * portal without a deploy. See EnsureFeatureEnabled for how routes are gated
 * and the FeatureFlags context on the client for how the nav follows.
 */
class FeatureFlag extends Model
{
    protected $table = 'feature_flags';
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['key', 'enabled'];
    protected $casts = ['enabled' => 'boolean'];

    // The whole list lives here, so the command, the API and the middleware
    // cannot drift apart on what a valid flag is.
    public const FLAGS = ['research_profile', 'project_management', 'job_openings'];

    /**
     * Every flag and its state. An unknown or missing key reads as enabled,
     * which keeps a failed migration or a hand-deleted row from hiding a
     * working feature.
     */
    public static function map(): array
    {
        $stored = static::pluck('enabled', 'key')->all();

        $map = [];
        foreach (self::FLAGS as $flag) {
            $map[$flag] = (bool) ($stored[$flag] ?? true);
        }
        return $map;
    }

    public static function enabled(string $key): bool
    {
        return static::map()[$key] ?? true;
    }
}

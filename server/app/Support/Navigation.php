<?php

namespace App\Support;

use App\Models\FeatureFlag;
use App\Models\UrfApplication;
use App\Models\User;

/**
 * What a user may reach and the menus to draw for them, from
 * config/navigation.php. Answers GET /me for the web and the app, so both
 * draw the same sidebar, guard the same routes and label pages the same way.
 */
final class Navigation
{
    /** The acting role's capabilities, as the client has always read them. */
    public static function capabilities(User $user): array
    {
        $capabilities = collect((array) ($user->current_role?->getAttributes() ?? []))
            ->filter(fn ($value, $key) => str_starts_with($key, 'can_'))
            ->map(fn ($value) => $value === 'true')
            ->all();

        // Mentoring is a fact about the person, not the role: true only while
        // they mentor something, so the URF item stays off everyone else's menu.
        $capabilities['can_read_urf_mentees'] = !empty($capabilities['can_manage_urf'])
            || (!empty($capabilities['can_read_urf_mentees'])
                && UrfApplication::mentoredBy($user->faculty?->faculty_code)->exists());

        return $capabilities;
    }

    /**
     * @return array{areas: array<string, bool>, nav: array, labels: array<string, string>, tiles: array}
     */
    public static function for(?string $role, array $capabilities, array $features): array
    {
        $config = config('navigation');
        $areas = array_map(fn (array $roles) => in_array($role, $roles, true), $config['areas']);

        // Whether the role may reach an entry, before modules and capabilities.
        $reaches = fn (array $entry) => (isset($entry['roles']) ? in_array($role, $entry['roles'], true) : ($areas[$entry['area']] ?? false))
            && !in_array($role, $entry['except'] ?? [], true);
        $shown = fn (array $entry) => $reaches($entry)
            && (empty($entry['feature']) || ($features[$entry['feature']] ?? true))
            && (empty($entry['capability']) || collect((array) $entry['capability'])->contains(fn ($name) => !empty($capabilities[$name])));

        $item = fn (array $entry) => ['path' => $entry['path'], 'label' => $entry['label'], 'icon' => $entry['icon']];

        // A page is named by its menu entry for this role, whether or not it is
        // shown just now (a switched-off module still names its page).
        $labels = [];
        foreach ($config['nav'] as $entry) {
            if ($reaches($entry)) {
                $labels[$entry['path']] = $entry['label'];
            }
        }

        // A tile follows the last menu entry with its path, unless it names
        // its own area and icon.
        $byPath = [];
        foreach ($config['nav'] as $entry) {
            $byPath[$entry['path']] = $entry;
        }
        $tiles = [];
        foreach ($config['tiles'] as $tile) {
            $entry = isset($tile['area']) ? $tile : ($byPath[$tile['path']] ?? null);
            if ($entry && $shown($entry)) {
                $tiles[] = ['path' => $tile['path'], 'label' => $tile['label'], 'icon' => $tile['icon'] ?? $entry['icon'] ?? 'arrow-right'];
            }
        }

        return [
            'areas' => $areas,
            'nav' => array_values(array_map($item, array_filter($config['nav'], $shown))),
            'labels' => $labels,
            'tiles' => $tiles,
        ];
    }

    /** Everything GET /me answers for a signed-in user. */
    public static function me(User $user): array
    {
        $capabilities = self::capabilities($user);
        $role = $user->current_role?->role;

        return array_merge([
            'available_roles' => $user->availableRoles(),
            'current_role' => $role,
            'capabilities' => $capabilities,
        ], self::for($role, $capabilities, FeatureFlag::map()));
    }
}

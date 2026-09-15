<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\AuthorizesCapability;
use App\Models\AppSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Read and write one group of settings. Both endpoints are group-agnostic:
 * what a group contains, who may read it and what a write must pass all come
 * from AppSetting::GROUPS, except 'leave' (checked via can_read_leave_settings).
 */
class AppSettingController extends Controller
{
    use AuthorizesCapability;

    public function show(Request $request, string $group)
    {
        if (!AppSetting::isGroup($group)) {
            return response()->json(['message' => 'Unknown settings group'], 404);
        }

        if ($group === 'leave') {
            if ($denied = $this->denyUnlessMay('can_read_leave_settings', 'You do not have permission to view leave settings. Contact your administrator if you believe this is a mistake.')) return $denied;
        } elseif (!in_array(Auth::user()->current_role->role, AppSetting::GROUPS[$group]['readers'], true)) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        return response()->json(AppSetting::map($group), 200);
    }

    public function save(Request $request, string $group)
    {
        if (!AppSetting::isGroup($group)) {
            return response()->json(['message' => 'Unknown settings group'], 404);
        }

        if (!Auth::user()->may('can_manage_app_settings')) {
            return response()->json(['message' => 'You are not authorized to change settings'], 403);
        }

        $data = $request->validate(AppSetting::GROUPS[$group]['rules']);

        foreach ($data as $key => $value) {
            AppSetting::put($group, $key, $value);
        }

        return response()->json(AppSetting::map($group), 200);
    }
}

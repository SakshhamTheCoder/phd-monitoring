<?php

namespace App\Http\Controllers;

use App\Models\UrfApplication;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

/**
 * A UG student correcting what they gave at sign-up.
 *
 * Only until they apply. From the first application the details are part of a
 * record the admin is reading, so a change goes through the office, which can
 * edit them at any time from Manage Users.
 */
class UgStudentController extends Controller
{
    public function updateMine(Request $request)
    {
        $user = Auth::user();
        $record = $user->ugStudent;

        if (!$user->may('can_apply_for_urf') || !$record) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        if (UrfApplication::forMember($user)->exists()) {
            return response()->json([
                'message' => 'Your details are part of a URF application now. Ask the office to change them.',
            ], 422);
        }

        $data = $request->validate([
            'phone' => 'required|string|max:20',
            'gender' => 'required|in:Male,Female',
            'roll_no' => ['required', 'string', 'max:50', Rule::unique('ug_students')->ignore($record->id)],
            'branch_id' => 'required|exists:ug_branches,id',
            // Blank means the year counted from their admission year stands.
            'year' => 'nullable|integer|between:1,4',
        ]);

        $user->fill(['phone' => $data['phone'], 'gender' => $data['gender']])->save();
        $record->fill([
            'roll_no' => $data['roll_no'],
            'branch_id' => $data['branch_id'],
            'year' => $data['year'] ?? null,
        ])->save();

        return response()->json($record->fresh()->load('branch:id,programme,code,name'));
    }
}

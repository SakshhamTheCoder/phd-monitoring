<?php

namespace App\Http\Controllers;

use App\Models\UgBranch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

/**
 * The branch list behind Configuration.
 *
 * Reading it is public and lives on the URF controller, since a student
 * signing up has no account yet. Changing it is an admin's job and lives here.
 */
class UgBranchController extends Controller
{
    public function index()
    {
        $this->authorizeAdmin();

        return response()->json(UgBranch::ordered()->withCount('students')->get());
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin();

        return response()->json(UgBranch::create($this->validated($request)), 201);
    }

    public function update(Request $request, $id)
    {
        $this->authorizeAdmin();
        $branch = UgBranch::findOrFail($id);
        $branch->update($this->validated($request, $branch));

        return response()->json($branch);
    }

    /** A branch students are on stays: deleting it would strand their record. */
    public function destroy($id)
    {
        $this->authorizeAdmin();
        $branch = UgBranch::withCount('students')->findOrFail($id);

        if ($branch->students_count > 0) {
            return response()->json([
                'message' => "{$branch->students_count} student(s) are on this branch, so it cannot be removed.",
            ], 422);
        }

        $branch->delete();

        return response()->json(['message' => 'Branch removed']);
    }

    private function validated(Request $request, ?UgBranch $branch = null): array
    {
        return $request->validate([
            // The degree, written as the institute writes it: BE, BTech.
            'programme' => 'required|string|max:20',
            'code' => [
                'required', 'string', 'max:20',
                Rule::unique('ug_branches')->where('programme', $request->programme)->ignore($branch?->id),
            ],
            'name' => 'required|string|max:255',
        ]);
    }

    private function authorizeAdmin(): void
    {
        abort_unless(Auth::user()?->may('can_manage_app_settings'), 403, 'You are not authorized to access this resource');
    }
}

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

    /**
     * The whole list at once, which is how it arrives the first time.
     *
     * A row is matched on its programme and code, so importing the same file
     * twice renames rather than duplicates, and a bad row is reported by its
     * line number instead of stopping the ones around it.
     */
    public function import(Request $request)
    {
        $this->authorizeAdmin();

        $rows = $request->validate([
            'rows' => 'required|array|min:1',
        ])['rows'];

        $added = 0;
        $updated = 0;
        $errors = [];

        foreach ($rows as $index => $row) {
            $line = $row['_rowNumber'] ?? $index + 2;
            $programme = trim((string) ($row['programme'] ?? ''));
            $code = trim((string) ($row['code'] ?? ''));
            $name = trim((string) ($row['name'] ?? ''));

            if ($programme === '' || $code === '' || $name === '') {
                $errors[] = "Row {$line}: programme, code and name are all needed.";
                continue;
            }

            $branch = UgBranch::firstOrNew(['programme' => $programme, 'code' => $code]);
            $existed = $branch->exists;
            $branch->name = $name;
            $branch->save();
            $existed ? $updated++ : $added++;
        }

        return response()->json([
            'added' => $added,
            'updated' => $updated,
            'errors' => $errors,
        ]);
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

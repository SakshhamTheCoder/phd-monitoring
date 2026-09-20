<?php

namespace App\Http\Controllers;

use App\Models\SynopsisChecklistOption;
use App\Models\SynopsisSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

/**
 * Managing the synopsis checklist, one set of declarations per admission year.
 *
 * Scholars do not read this: the options for their own year are shipped with
 * their form, so the page they fill in needs no second call.
 */
class SynopsisChecklistController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizeAdmin();

        $query = SynopsisChecklistOption::query()
            ->orderByDesc('admission_year')
            ->orderBy('sort_order')
            ->orderBy('id');

        if ($request->filled('admission_year')) {
            $query->where('admission_year', (int) $request->input('admission_year'));
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin();

        return response()->json(SynopsisChecklistOption::create($this->validated($request)), 201);
    }

    public function update(Request $request, $id)
    {
        $this->authorizeAdmin();
        $option = SynopsisChecklistOption::findOrFail($id);
        $option->update($this->validated($request, $option));

        return response()->json($option);
    }

    /**
     * An option a scholar has already chosen stays, or their form reads back a
     * declaration nobody can see. Retiring it takes it off the list without
     * rewriting what was agreed.
     */
    public function destroy($id)
    {
        $this->authorizeAdmin();
        $option = SynopsisChecklistOption::findOrFail($id);

        $chosen = SynopsisSubmission::where('checklist_option_id', $option->id)->count();
        if ($chosen > 0) {
            return response()->json([
                'message' => "{$chosen} synopsis form(s) have already chosen this option, so it cannot be removed. "
                    . 'Mark it inactive instead and it will stop being offered.',
            ], 422);
        }

        $option->delete();

        return response()->json(['message' => 'Checklist option removed']);
    }

    private function validated(Request $request, ?SynopsisChecklistOption $option = null): array
    {
        return $request->validate([
            'admission_year' => 'required|integer|min:1950|max:2100',
            'label' => [
                'required', 'string', 'max:255',
                Rule::unique('synopsis_checklist_options')
                    ->where('admission_year', $request->admission_year)
                    ->ignore($option?->id),
            ],
            'sort_order' => 'nullable|integer|min:0|max:1000',
            'active' => 'nullable|boolean',
        ]);
    }

    private function authorizeAdmin(): void
    {
        abort_unless(Auth::user()?->may('can_manage_app_settings'), 403, 'You are not authorized to access this resource');
    }
}

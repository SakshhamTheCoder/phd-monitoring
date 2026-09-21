<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\SynopsisChecklistOption;
use App\Models\SynopsisChecklistRule;
use App\Models\SynopsisSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule as ValidationRule;

/**
 * Managing the synopsis checklist: the conditions under which declarations are
 * offered, and the declarations themselves.
 *
 * Scholars and supervisors do not read this: the options a scholar qualifies
 * for are shipped with their form, so the page they fill in needs no second
 * call.
 */
class SynopsisChecklistController extends Controller
{
    /** Every rule with its declarations, which is all the admin page needs. */
    public function index()
    {
        $this->authorizeAdmin();

        $rules = SynopsisChecklistRule::with(['options' => function ($query) {
            $query->orderBy('sort_order')->orderBy('id');
        }])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        // The page reads a condition back as a sentence, so it needs the
        // department names the ids stand for. Read once for the whole list.
        $departments = Department::whereIn('id', $rules->pluck('department_ids')->flatten()->filter()->unique())
            ->pluck('name', 'id');

        $rules->each(function (SynopsisChecklistRule $rule) use ($departments) {
            $rule->departments = collect($rule->department_ids ?: [])
                ->map(fn ($id) => ['id' => (int) $id, 'name' => $departments[$id] ?? 'Department ' . $id])
                ->values();
        });

        return response()->json($rules);
    }

    public function storeRule(Request $request)
    {
        $this->authorizeAdmin();

        return response()->json(SynopsisChecklistRule::create($this->validatedRule($request)), 201);
    }

    public function updateRule(Request $request, $id)
    {
        $this->authorizeAdmin();
        $rule = SynopsisChecklistRule::findOrFail($id);
        $rule->update($this->validatedRule($request));

        return response()->json($rule);
    }

    /**
     * Removing a rule removes its declarations with it, so a rule holding a
     * declaration somebody already chose stays. Retiring it takes it off every
     * list without rewriting what was agreed.
     */
    public function destroyRule($id)
    {
        $this->authorizeAdmin();
        $rule = SynopsisChecklistRule::findOrFail($id);

        $chosen = SynopsisSubmission::whereIn('checklist_option_id', $rule->options()->pluck('id'))->count();
        if ($chosen > 0) {
            return response()->json([
                'message' => "{$chosen} synopsis form(s) have already chosen a declaration under this condition, so it "
                    . 'cannot be removed. Mark it inactive instead and it will stop being offered.',
            ], 422);
        }

        $rule->delete();

        return response()->json(['message' => 'Condition removed']);
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

    private function validatedRule(Request $request): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'department_ids' => 'nullable|array',
            'department_ids.*' => 'integer|exists:departments,id',
            'admitted_from' => 'nullable|date',
            'admitted_to' => 'nullable|date|after_or_equal:admitted_from',
            'exclusive' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0|max:1000',
            'active' => 'nullable|boolean',
        ]);

        // An empty list and no list mean the same thing, any department. Stored
        // the same way too, so matching has one case to read instead of two.
        $data['department_ids'] = empty($data['department_ids']) ? null : array_values(array_unique($data['department_ids']));

        return $data;
    }

    private function validated(Request $request, ?SynopsisChecklistOption $option = null): array
    {
        return $request->validate([
            'rule_id' => 'required|integer|exists:synopsis_checklist_rules,id',
            'label' => [
                'required', 'string', 'max:255',
                ValidationRule::unique('synopsis_checklist_options')
                    ->where('rule_id', $request->rule_id)
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

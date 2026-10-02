<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\SynopsisChecklistOption;
use App\Models\Student;
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

        // How many scholars a condition actually decides for, and how many
        // forms have chosen each wording. Without these the page is a list of
        // rules nobody can tell the reach of, which is the whole question an
        // admin has when they open it.
        $reach = $this->scholarsPerRule();
        $chosen = SynopsisSubmission::whereNotNull('checklist_option_id')
            ->selectRaw('checklist_option_id, count(*) as forms')
            ->groupBy('checklist_option_id')
            ->pluck('forms', 'checklist_option_id');

        $rules->each(function (SynopsisChecklistRule $rule) use ($departments, $reach, $chosen) {
            $rule->departments = collect($rule->department_ids ?: [])
                ->map(fn ($id) => ['id' => (int) $id, 'name' => $departments[$id] ?? 'Department ' . $id])
                ->values();
            $rule->scholars = $reach[$rule->id] ?? 0;
            $rule->options->each(function (SynopsisChecklistOption $option) use ($chosen) {
                $option->forms = (int) ($chosen[$option->id] ?? 0);
            });
        });

        return response()->json($rules);
    }

    /**
     * What one scholar would be offered, and which conditions say so.
     *
     * The conditions merge, and one of them can stand alone and silence the
     * rest, so reading the list and working out what a given scholar sees is
     * not something an admin should have to do in their head. Asked either by
     * registration number or by the two things a condition is written against.
     */
    public function preview(Request $request)
    {
        $this->authorizeAdmin();

        $request->validate([
            'roll_no' => 'nullable|string',
            'department_id' => 'nullable|integer|exists:departments,id',
            'admitted_on' => 'nullable|date',
        ]);

        $departmentId = $request->filled('department_id') ? (int) $request->input('department_id') : null;
        $admittedOn = $request->filled('admitted_on') ? substr((string) $request->input('admitted_on'), 0, 10) : null;
        $scholar = null;

        if ($request->filled('roll_no')) {
            $scholar = Student::where('roll_no', trim((string) $request->input('roll_no')))->first();
            if (!$scholar) {
                return response()->json(['message' => 'No scholar with that registration number.'], 404);
            }
            $departmentId = $scholar->department_id === null ? null : (int) $scholar->department_id;
            $admittedOn = $scholar->date_of_registration?->toDateString();
        }

        $rules = SynopsisChecklistRule::matching($departmentId, $admittedOn);
        $options = SynopsisChecklistOption::whereIn('rule_id', $rules->pluck('id'))
            ->where('active', true)
            ->get()
            ->sortBy(fn (SynopsisChecklistOption $option) => [
                $rules->pluck('id')->flip()[$option->rule_id], $option->sort_order, $option->id,
            ])
            ->values();

        return response()->json([
            'scholar' => $scholar ? [
                'roll_no' => $scholar->roll_no,
                'department' => $scholar->department?->name,
                'admitted_on' => $admittedOn,
            ] : null,
            'conditions' => $rules->map(fn (SynopsisChecklistRule $rule) => [
                'id' => $rule->id,
                'name' => $rule->name,
                'exclusive' => (bool) $rule->exclusive,
            ])->values(),
            'options' => $options->map(fn (SynopsisChecklistOption $option) => [
                'id' => $option->id,
                'label' => $option->label,
                'condition' => $rules->firstWhere('id', $option->rule_id)?->name,
            ])->values(),
        ]);
    }

    /**
     * Scholars whose list each condition decides, counted the way the form
     * decides it rather than by the condition on its own: a scholar a condition
     * covers still does not see it where a condition standing alone wins.
     *
     * @return array<int, int>
     */
    private function scholarsPerRule(): array
    {
        $counts = [];
        $seen = [];

        foreach (Student::select('department_id', 'date_of_registration')->get() as $scholar) {
            $admitted = $scholar->date_of_registration?->toDateString();
            $key = $scholar->department_id . '|' . $admitted;

            if (!isset($seen[$key])) {
                $seen[$key] = SynopsisChecklistRule::matching(
                    $scholar->department_id === null ? null : (int) $scholar->department_id,
                    $admitted
                )->pluck('id')->all();
            }

            foreach ($seen[$key] as $id) {
                $counts[$id] = ($counts[$id] ?? 0) + 1;
            }
        }

        return $counts;
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

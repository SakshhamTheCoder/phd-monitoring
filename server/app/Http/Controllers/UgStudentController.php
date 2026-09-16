<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Models\UgStudent;
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
    use FilterLogicTrait;

    /**
     * Everyone who has signed up, whether or not they have applied. The URF
     * tab lists projects, which answers a different question: this one says
     * who is here.
     */
    public function list(Request $request)
    {
        $user = Auth::user();
        if (!$user->may('can_manage_urf')) {
            return $this->refuse();
        }

        $query = UgStudent::with(['user', 'branch'])->latest('id');
        $filters = json_decode((string) $request->query('filters'), true);
        if ($filters) {
            $query = $this->applyDynamicFilters($query, $filters, 'ug_students');
        }
        $page = $query->paginate($request->input('rows', 50), ['*'], 'page', $request->input('page', 1));

        // One query for the whole page rather than one per row.
        $applied = UrfApplication::query()
            ->whereIn('user_id', $page->getCollection()->pluck('user_id'))
            ->orWhereIn('student2_email', $page->getCollection()->pluck('user.email')->filter())
            ->get();

        return response()->json([
            'data' => $page->getCollection()->map(function (UgStudent $student) use ($applied) {
                $theirs = $applied->filter(fn (UrfApplication $a) => $a->hasMember($student->user));

                return [
                    'id' => $student->user_id,
                    'name' => $student->user?->name(),
                    'roll_no' => $student->roll_no,
                    'branch' => $student->branch ? "{$student->branch->programme} {$student->branch->name}" : null,
                    'year' => UrfApplication::yearLabel($student->year_of_study),
                    'semester' => $student->semester_of_study,
                    'email' => $student->user?->email,
                    'phone' => $student->user?->phone,
                    'projects' => $theirs->count(),
                    'latest' => $theirs->sortByDesc('session')->first()?->project_title,
                ];
            }),
            'total' => $page->total(),
            'totalPages' => $page->lastPage(),
            'role' => $user->current_role->role,
            'fields' => ['name', 'roll_no', 'branch', 'year', 'semester', 'email', 'phone', 'projects', 'latest'],
            'fieldsTitles' => ['Name', 'Roll No', 'Branch', 'Year', 'Semester', 'Email', 'Phone', 'URF Projects', 'Latest Project'],
        ]);
    }

    public function listFilters()
    {
        return response()->json($this->getAvailableFilters('ug_students'));
    }

    private function refuse()
    {
        return response()->json(['message' => 'You are not authorized to access this resource'], 403);
    }

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

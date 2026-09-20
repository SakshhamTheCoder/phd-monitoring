<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Models\Role;
use App\Models\UgBranch;
use App\Models\UgStudent;
use App\Models\UrfApplication;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * UG students: the office's list, and a student's own details.
 *
 * A student corrects their own only until they apply; after that it goes
 * through the office, which can edit them at any time.
 */
class UgStudentController extends Controller
{
    use FilterLogicTrait;

    /** Everyone who signed up, applied or not. The URF tab lists projects instead. */
    public function list(Request $request)
    {
        $user = Auth::user();
        if (!$user->may('can_manage_urf') && !$user->may('can_read_urf_mentees')) {
            return $this->refuse();
        }

        $query = UgStudent::with(['user', 'branch'])->latest('id');

        // A mentor reads the students on the projects they mentor, as they read
        // the projects themselves. Membership is the first student's account or
        // the second student's address, the same pair this method already reads
        // below to count a student's projects.
        if (!$user->may('can_manage_urf')) {
            $mentored = UrfApplication::mentoredBy($user->faculty?->faculty_code)
                ->get(['user_id', 'student2_email']);
            $query->where(fn ($q) => $q
                ->whereIn('user_id', $mentored->pluck('user_id')->filter())
                ->orWhereHas('user', fn ($u) => $u->whereIn('email', $mentored->pluck('student2_email')->filter())));
        }
        $filters = json_decode((string) $request->query('filters'), true);
        if ($filters) {
            $query = $this->applyDynamicFilters($query, $filters, 'ug_students');
        }
        $page = $query->paginate($request->input('rows', 50), ['*'], 'page', $request->input('page', 1));

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
                    'first_name' => $student->user?->first_name,
                    'last_name' => $student->user?->last_name,
                    'roll_no' => $student->roll_no,
                    'branch' => $student->branch ? "{$student->branch->programme} {$student->branch->name}" : null,
                    'branch_id' => $student->branch_id,
                    'year_of_study' => $student->year,
                    'year' => UrfApplication::yearLabel($student->year),
                    'semester' => $student->semester_of_study,
                    'email' => $student->user?->email,
                    'phone' => $student->user?->phone,
                    'gender' => $student->user?->gender,
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

    /** For a student who cannot sign up: an address carrying no programme, say. */
    public function store(Request $request)
    {
        $user = Auth::user();
        if (!$user->may('can_manage_urf')) {
            return $this->refuse();
        }

        $data = $request->validate($this->rules());

        // Verified because the office typed the address in, and passwordless,
        // so the link below is how they get in.
        $created = DB::transaction(function () use ($data) {
            $account = UgStudent::registerAccount($data, null, true);
            $account->ugStudent()->create($this->record($data));

            return $account;
        });

        $created->inviteToSetPassword();

        return response()->json($created->load('ugStudent.branch'), 201);
    }

    public function update(Request $request, $userId)
    {
        $user = Auth::user();
        if (!$user->may('can_manage_urf')) {
            return $this->refuse();
        }

        $account = User::findOrFail($userId);
        $data = $request->validate($this->rules($account));

        $account->fill([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'] ?? $account->last_name,
            'email' => $data['email'],
            'phone' => $data['phone'] ?? $account->phone,
            'gender' => $data['gender'] ?? $account->gender,
        ])->save();

        $record = $account->ugStudent ?: $account->ugStudent()->make();
        $record->fill($this->record($data));
        $account->ugStudent()->save($record);

        return response()->json($account->load('ugStudent.branch'));
    }

    /**
     * A year's intake at once. Rows are matched on email, so a corrected file
     * updates rather than duplicates, and a bad row is named by its line.
     */
    public function bulkImport(Request $request)
    {
        $user = Auth::user();
        if (!$user->may('can_manage_urf')) {
            return $this->refuse();
        }

        $rows = $request->validate(['rows' => 'required|array|min:1'])['rows'];
        $role = Role::where('role', 'ug_student')->firstOrFail();
        $branches = UgBranch::all();

        $added = 0;
        $updated = 0;
        $errors = [];

        foreach ($rows as $index => $row) {
            $line = $row['_rowNumber'] ?? $index + 2;
            $email = trim((string) ($row['email'] ?? ''));
            $rollNo = trim((string) ($row['roll_no'] ?? ''));
            $name = trim((string) ($row['full_name'] ?? ''));
            $code = trim((string) ($row['branch_code'] ?? ''));
            $programme = trim((string) ($row['programme'] ?? ''));
            $year = (int) trim((string) ($row['year'] ?? ''));

            if ($email === '' || $rollNo === '' || $name === '') {
                $errors[] = "Row {$line}: full_name, email and roll_no are all needed.";
                continue;
            }

            if ($year < 1 || $year > 4) {
                $errors[] = "Row {$line}: year has to be 1, 2, 3 or 4.";
                continue;
            }

            $branch = $branches->first(fn (UgBranch $b) => strcasecmp($b->code, $code) === 0
                && ($programme === '' || strcasecmp($b->programme, $programme) === 0));

            if (!$branch) {
                $errors[] = "Row {$line}: no branch matches '{$programme} {$code}'.";
                continue;
            }

            $account = User::where('email', $email)->first();
            $taken = UgStudent::where('roll_no', $rollNo)->first();
            if ($taken && (!$account || $taken->user_id !== $account->id)) {
                $errors[] = "Row {$line}: roll number {$rollNo} already belongs to someone else.";
                continue;
            }

            $existed = (bool) $account;
            $parts = preg_split('/\s+/', $name, 2);
            $details = [
                'first_name' => $parts[0],
                'last_name' => $parts[1] ?? '',
                'email' => $email,
                'phone' => trim((string) ($row['phone'] ?? '')) ?: null,
                'gender' => trim((string) ($row['gender'] ?? '')) ?: null,
            ];

            $account = DB::transaction(function () use ($details, $rollNo, $branch, $account, $year) {
                if ($account) {
                    $account->fill(array_filter($details))->save();
                } else {
                    $account = UgStudent::registerAccount($details, null, true);
                }

                $record = $account->ugStudent ?: $account->ugStudent()->make();
                $record->fill(['roll_no' => $rollNo, 'branch_id' => $branch->id, 'year' => $year]);
                $account->ugStudent()->save($record);

                return $account;
            });

            if ($existed) {
                $updated++;
            } else {
                $added++;
                $account->inviteToSetPassword();
            }
        }

        return response()->json(['added' => $added, 'updated' => $updated, 'errors' => $errors]);
    }

    public function updateMine(Request $request)
    {
        $user = Auth::user();
        $record = $user->ugStudent;

        if (!$user->may('can_apply_for_urf') || !$record) {
            return $this->refuse();
        }

        // How to reach them is theirs to correct for as long as they hold the
        // account. An application copied the phone and gender it was filed
        // with, so changing them now cannot alter a form somebody is reading.
        $rules = [
            'phone' => ['required', 'string', 'max:20', Rule::unique('users', 'phone')->ignore($user->id)],
            'gender' => 'required|in:Male,Female',
        ];

        // Who they are is not. The roll number identifies them across imports,
        // and the branch is what routes a form to an ADORDC, so once a project
        // exists these are the office's to change.
        $applied = UrfApplication::forMember($user)->exists();
        if (!$applied) {
            $rules += [
                'roll_no' => ['required', 'string', 'max:50', Rule::unique('ug_students')->ignore($record->id)],
                'branch_id' => 'required|exists:ug_branches,id',
                'year' => 'required|integer|between:1,4',
            ];
        }

        $data = $request->validate($rules);

        $user->fill(['phone' => $data['phone'], 'gender' => $data['gender']])->save();
        if (!$applied) {
            $record->fill([
                'roll_no' => $data['roll_no'],
                'branch_id' => $data['branch_id'],
                'year' => $data['year'],
            ])->save();
        }

        return response()->json($record->fresh()->load('branch:id,programme,code,name'));
    }

    private function rules(?User $account = null): array
    {
        return [
            'first_name' => 'required|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($account?->id)],
            'phone' => ['nullable', 'string', 'max:20', Rule::unique('users', 'phone')->ignore($account?->id)],
            'gender' => 'nullable|in:Male,Female',
            'roll_no' => ['required', 'string', 'max:50', Rule::unique('ug_students')->ignore($account?->ugStudent?->id)],
            'branch_id' => 'required|exists:ug_branches,id',
            'year' => 'required|integer|between:1,4',
        ];
    }

    private function record(array $data): array
    {
        return [
            'roll_no' => $data['roll_no'],
            'branch_id' => $data['branch_id'],
            'year' => $data['year'],
        ];
    }

}

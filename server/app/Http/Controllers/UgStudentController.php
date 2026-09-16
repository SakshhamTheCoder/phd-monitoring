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
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * UG students: the office's list of them, and a student's own details.
 *
 * A student corrects their own only until they apply. From the first
 * application the details are part of a record the admin is reading, so a
 * change goes through the office, which can edit them at any time.
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
                    'first_name' => $student->user?->first_name,
                    'last_name' => $student->user?->last_name,
                    'roll_no' => $student->roll_no,
                    'branch' => $student->branch ? "{$student->branch->programme} {$student->branch->name}" : null,
                    'branch_id' => $student->branch_id,
                    'admission_year' => $student->admission_year,
                    'year_override' => $student->year,
                    'year' => UrfApplication::yearLabel($student->year_of_study),
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

    /**
     * The office creating an account for a student who cannot sign up: an
     * address carrying no programme, or a student who should not wait. The
     * account has no password until they choose one from the email it sends.
     */
    public function store(Request $request)
    {
        $user = Auth::user();
        if (!$user->may('can_manage_urf')) {
            return $this->refuse();
        }

        $data = $request->validate($this->rules());
        $role = Role::where('role', 'ug_student')->firstOrFail();

        $created = DB::transaction(function () use ($data, $role) {
            $account = new User();
            $account->first_name = $data['first_name'];
            $account->last_name = $data['last_name'] ?? '';
            $account->email = $data['email'];
            $account->phone = $data['phone'] ?? null;
            $account->gender = $data['gender'] ?? null;
            $account->password = Hash::make(Str::random(40));
            // Nobody chose it, so Set Password asks for no current one. The
            // office vouched for the address by typing it in.
            $account->password_set_at = null;
            $account->email_verified_at = now();
            $account->role_id = $role->id;
            $account->current_role_id = $role->id;
            $account->default_role_id = $role->id;
            $account->save();

            $account->ugStudent()->create($this->record($data, $account->email));

            return $account;
        });

        // How they get in: the same link Manage Users sends.
        Password::sendResetLink(['email' => $created->email]);

        return response()->json($created->load('ugStudent.branch'), 201);
    }

    /** The office correcting a UG student, at any time. */
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
        $record->fill($this->record($data, $account->email));
        $account->ugStudent()->save($record);

        return response()->json($account->load('ugStudent.branch'));
    }

    /**
     * A year's intake at once. A row is matched on its email, so importing a
     * corrected file updates rather than duplicates, and a bad row is named by
     * its line instead of stopping the ones around it.
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

            if ($email === '' || $rollNo === '' || $name === '') {
                $errors[] = "Row {$line}: full_name, email and roll_no are all needed.";
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

            DB::transaction(function () use ($row, $email, $rollNo, $parts, $branch, $role, $account) {
                $account = $account ?: new User();
                $account->first_name = $parts[0];
                $account->last_name = $parts[1] ?? '';
                $account->email = $email;
                $account->phone = trim((string) ($row['phone'] ?? '')) ?: $account->phone;
                $account->gender = trim((string) ($row['gender'] ?? '')) ?: $account->gender;

                if (!$account->exists) {
                    $account->password = Hash::make(Str::random(40));
                    $account->password_set_at = null;
                    $account->email_verified_at = now();
                    $account->role_id = $role->id;
                    $account->current_role_id = $role->id;
                    $account->default_role_id = $role->id;
                }
                $account->save();

                $record = $account->ugStudent ?: $account->ugStudent()->make();
                $record->fill([
                    'roll_no' => $rollNo,
                    'branch_id' => $branch->id,
                    'admission_year' => trim((string) ($row['admission_year'] ?? '')) ?: UgStudent::admissionYearFrom($email),
                    'year' => trim((string) ($row['year'] ?? '')) ?: null,
                ]);
                $account->ugStudent()->save($record);
            });

            if ($existed) {
                $updated++;
            } else {
                $added++;
                // Their way in, since the account was made without a password.
                Password::sendResetLink(['email' => $email]);
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

    /** The fields both the create and the edit form send. */
    private function rules(?User $account = null): array
    {
        return [
            'first_name' => 'required|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($account?->id)],
            'phone' => 'nullable|string|max:20',
            'gender' => 'nullable|in:Male,Female',
            'roll_no' => ['required', 'string', 'max:50', Rule::unique('ug_students')->ignore($account?->ugStudent?->id)],
            'branch_id' => 'required|exists:ug_branches,id',
            'admission_year' => 'nullable|integer|min:2000',
            'year' => 'nullable|integer|between:1,4',
        ];
    }

    private function record(array $data, string $email): array
    {
        return [
            'roll_no' => $data['roll_no'],
            'branch_id' => $data['branch_id'],
            // The address says when they were admitted, unless the office knows
            // better: an account made for a student whose address says nothing.
            'admission_year' => $data['admission_year'] ?? UgStudent::admissionYearFrom($email),
            'year' => $data['year'] ?? null,
        ];
    }

    private function refuse()
    {
        return response()->json(['message' => 'You are not authorized to access this resource'], 403);
    }
}

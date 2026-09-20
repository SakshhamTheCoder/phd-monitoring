<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\PagenationTrait;
use App\Models\Forms;
use App\Support\ScholarCommittee;
use App\Models\OutsideExpert;
use App\Models\ConstituteOfIRB;
use App\Models\Presentation;
use App\Models\Publication;
use Illuminate\Http\Request;    
use Illuminate\Support\Facades\Auth;
use App\Models\Role;
use App\Models\Student;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Support\PersonName;

class StudentController extends Controller {
    /**
     * What the listing's mapper reads. Loaded here, or it asks per student:
     * the profile was costing about six queries a row.
     */
    private const LIST_RELATIONS = [
        'user', 'department', 'supervisors.user', 'doctoralCommittee.user',
        'irbForms', 'areaPreferences', 'thesisExtentions',
    ];

    use FilterLogicTrait;
    use PagenationTrait;
    use GeneralFormList;
    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("student"));
    }
    public function add(Request $request)
    {
        $loggenInUser = Auth::user();
        if(!$loggenInUser->may('can_manage_students')){
            return response()->json([
                'message' => 'You do not have permission to create student'
            ], 403);
        }
        $role_id=Role::where('role','student')->first()->id;
        $request->validate(
            [
                'full_name' => 'required_without:first_name|string',
                'first_name' => 'required_without:full_name|string',
                'last_name' => 'nullable|string',
                'phone' => 'required|string|unique:users,phone',
                'email' => 'required|email|unique:users',
                'roll_no' => 'required|string',
                'department_id' => 'required|integer',
                'date_of_registration' => 'required|date',
                'current_status' => 'required|in:part-time,full-time,executive',
                'gender' => 'required|in:Male,Female',
                'physically_handicapped' => 'nullable|boolean',
                'is_jrf' => 'nullable|boolean',
                'is_net_gate_qualified' => 'nullable|boolean',
                'date_of_irb' => 'nullable|date',
                'date_of_synopsis' => 'nullable|date',
                'date_of_thesis' => 'nullable|date',
                'date_of_thesis_awarded' => 'nullable|date',
                'phd_title' => 'nullable|string',
                'fathers_name' => 'nullable|string',
                'address' => 'nullable|string',
                'overall_progress' => 'nullable|numeric',
                'cgpa' => 'nullable|numeric'
            ]
        );
        // Nobody is told this one. The account is mailed a link and chooses
        // its own, the same way a UG student or any other new account does.
        $password = Str::password(8, true, true, true, false);

        $user = new \App\Models\User();
        $name = $request->filled('full_name')
            ? PersonName::split($request->input('full_name'))
            : ['first' => $request->input('first_name'), 'last' => $request->input('last_name') ?: PersonName::NO_SURNAME];
        $user->first_name = $name['first'];
        $user->last_name = $name['last'];
        $user->phone = $request->phone;
        $user->email = $request->email;
        $user->password = bcrypt($password);
        $user->address = $request->address;
        $user->gender = $request->gender;
        $user->physically_handicapped = $request->boolean('physically_handicapped');
        $user->role_id = $role_id;
        //crate new entry in users table


        $role_id = Role::where('role','student')->first()->id;
        $user->current_role_id = $role_id;
        $user->save();
        //fetch role id of student and save it in user table

        $student = new \App\Models\Student();
        $student->user_id = $user->id;
        $student->roll_no = $request->roll_no;
        $student->department_id = $request->department_id;
        $student->date_of_registration = $request->date_of_registration;
        $student->date_of_irb = $request->date_of_irb;
        $student->date_of_synopsis = $request->date_of_synopsis;
        $student->date_of_thesis = $request->date_of_thesis;
        $student->date_of_thesis_awarded = $request->date_of_thesis_awarded;
        $student->phd_title = $request->phd_title;
        $student->fathers_name = $request->fathers_name;
        $student->current_status = $request->current_status;
        $student->address = $request->address;
        $student->cgpa = $request->cgpa;
        $student->is_jrf = $request->has('is_jrf') ? $request->boolean('is_jrf') : null;
        $student->is_net_gate_qualified = $request->has('is_net_gate_qualified') ? $request->boolean('is_net_gate_qualified') : null;
        $student->date_of_thesis_awarded = $request->date_of_thesis_awarded;
        if($request->has('overall_progress'))
             $student->overall_progress = $request->overall_progress;
        else
             $student->overall_progress = 0;
        
     

        $student->save();
        //create new entry in students table
        $adminFormController = new \App\Http\Controllers\AdminFormController();
        $formData = $adminFormController->getFormCreationData(
            'supervisor-allocation',
            $student->roll_no,
            $student->department_id
        );
        
        if ($formData) {
            Forms::create($formData);
        }
        $user->inviteToSetPassword();

        return response()->json(['message' => 'Student added. They are emailed a link to set their password.'], 200);
    }

    /**
     * Student columns an import may set, all of them optional.
     *
     * Walked rather than written out one `if` per field, because the rule is
     * the same for every one of them and the old per-field form is where the
     * blank-overwrites-value bug lived.
     */
    private const OPTIONAL_STUDENT_FIELDS = [
        'phd_title',
        'fathers_name',
        'address',
        'cgpa',
        'is_jrf',
        'is_net_gate_qualified',
        'overall_progress',
        'current_status',
        'date_of_registration',
        'date_of_irb',
        'date_of_synopsis',
        'date_of_thesis',
        'date_of_thesis_awarded',
    ];

    /**
     * Make the scholar's supervisors and doctoral committee the ones the row
     * names, matching each by email or employee code.
     *
     * The sheet is a statement of who is guiding whom right now, so a filled
     * cell replaces the whole set: someone the portal lists and the sheet does
     * not is no longer on it. A row with every cell blank is not making that
     * statement, so it leaves the set alone.
     *
     * A supervisor pushed over their limit is reported, not refused. The sheet
     * describes what is already true, and refusing it would leave the portal
     * disagreeing with the institute instead.
     *
     * @param  array<string, mixed>  $row
     * @return array<int, string>
     */
    private function syncSupervisionTeam(Student $student, array $row, int $rowNumber): array
    {
        $errors = [];

        $groups = [
            'supervisors' => [\App\Models\Supervisor::class, 'supervisor'],
            'committee' => [\App\Models\DoctoralCommittee::class, 'committee member'],
        ];

        foreach ($groups as $key => [$model, $label]) {
            $identifiers = array_values(array_filter(array_map('trim', (array) ($row[$key] ?? []))));
            if (!$identifiers) {
                continue;
            }

            $facultyCodes = [];
            foreach ($identifiers as $identifier) {
                $faculty = $this->facultyByIdentifier($identifier);
                if (!$faculty) {
                    $errors[] = "Row {$rowNumber}: no faculty matching '{$identifier}', {$label} skipped";
                    continue;
                }
                $facultyCodes[] = $faculty->faculty_code;
            }

            $facultyCodes = array_values(array_unique($facultyCodes));
            if (!$facultyCodes) {
                continue;
            }

            $model::where('student_id', $student->roll_no)
                ->whereNotIn('faculty_id', $facultyCodes)
                ->delete();

            foreach ($facultyCodes as $facultyCode) {
                $model::firstOrCreate([
                    'student_id' => $student->roll_no,
                    'faculty_id' => $facultyCode,
                ]);
            }

            if ($key === 'supervisors') {
                foreach ($facultyCodes as $facultyCode) {
                    $faculty = Faculty::where('faculty_code', $facultyCode)->first();
                    if ($faculty && \App\Support\SupervisionCapacity::remaining($faculty) <= 0) {
                        $errors[] = "Row {$rowNumber}: {$faculty->user?->name()} is now over their supervision limit";
                    }
                }
            }
        }

        return $errors;
    }


    /**
     * Record an IRB that was constituted before the portal, from the sheet.
     *
     * The trigger is the scholar's **date of IRB**. That date is what says the
     * IRB happened, and it is the column the office actually fills.
     *
     * What it creates is a constitution form marked as carried over.
     * irbCompleted() and phdTitleLocked() read that form rather than the
     * committee, so without one the scholar counts as pre-IRB however complete
     * their record otherwise is: their title shows as tentative and stays
     * editable, and the supervisor change form refuses to open and sends them
     * to the direct edit instead.
     *
     * IRB members and the external expert are recorded too when the sheet names
     * them, but they are not required and today are never present.
     *
     * @param  array<string, mixed>  $row
     * @return array<int, string>
     */
    private function recordCarriedOverIrb(Student $student, array $row, int $rowNumber): array
    {
        $identifiers = array_values(array_filter(array_map('trim', (array) ($row['irb_members'] ?? []))));
        $expertRow = array_filter((array) ($row['external_expert'] ?? []));

        // A date of IRB is what says the IRB was constituted. The members are
        // worth having when the sheet names them, but they are not the trigger:
        // on the office's sheet the member columns are blank on every row while
        // the date is filled for most, so keying off the members would mean no
        // imported scholar ever counted as having an IRB at all.
        if (!$identifiers && !$expertRow && !$student->date_of_irb) {
            return [];
        }

        $errors = [];
        $facultyCodes = [];
        foreach ($identifiers as $identifier) {
            $faculty = $this->facultyByIdentifier($identifier);
            if (!$faculty) {
                $errors[] = "Row {$rowNumber}: no faculty matching '{$identifier}', IRB member skipped";
                continue;
            }
            $facultyCodes[] = $faculty->faculty_code;
        }

        $expert = null;
        if (!empty($expertRow['email'])) {
            // OutsideExpert has its own table and its own importer, so this
            // matches on email and only creates one that is genuinely new.
            $name = PersonName::split(trim((string) ($expertRow['name'] ?? '')));
            $expert = OutsideExpert::firstOrCreate(
                ['email' => strtolower(trim($expertRow['email']))],
                array_filter([
                    'first_name' => $name['first'] ?: 'External',
                    'last_name' => $name['last'] ?: 'Expert',
                    'designation' => $expertRow['designation'] ?? null,
                    'department' => $expertRow['department'] ?? null,
                    'institution' => $expertRow['institution'] ?? null,
                ])
            );
        } elseif ($expertRow) {
            $errors[] = "Row {$rowNumber}: the external IRB expert needs an email to be matched or created";
        }

        // The IRB committee only, and only when the sheet actually named
        // somebody. The doctoral committee has its own columns, which
        // syncSupervisionTeam() imports; writing an IRB member into
        // doctoral_commitee would hand them the `doctoral` step of every form
        // chain and stall this scholar's IRB submission waiting for an approval
        // they were never meant to give.
        if ($facultyCodes || $expert) {
            ScholarCommittee::onTheIrbCommittee($student, $facultyCodes, $expert);
        }

        if (!ConstituteOfIRB::where('student_id', $student->roll_no)->exists()) {
            $this->carriedOverIrbForm($student, $expert);
        }

        ScholarCommittee::openTheFormsItUnlocks($student);

        return $errors;
    }

    /**
     * A constitution form standing for one that was filed elsewhere.
     *
     * Created complete, which locks it through the ordinary rules rather than a
     * special case: `stage` is 'complete', so Recommendation locks every panel
     * because no panel's role matches it, and submitForm refuses a completed
     * form before it looks at anything else.
     *
     * The history says where it came from, so nothing in it reads as an
     * approval somebody gave here.
     */
    private function carriedOverIrbForm(Student $student, ?OutsideExpert $expert): ConstituteOfIRB
    {
        $steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete'];
        $last = array_search('complete', $steps, true);

        $form = ConstituteOfIRB::create([
            'student_id' => $student->roll_no,
            'status' => 'approved',
            'completion' => 'complete',
            'stage' => 'complete',
            'steps' => $steps,
            'current_step' => $last,
            'maximum_step' => $last,
            'phd_title' => $student->phd_title,
            'outside_expert' => $expert?->id,
            'carried_over_at' => now(),
            'student_lock' => true,
            'supervisor_lock' => true,
            'phd_coordinator_lock' => true,
            'hod_lock' => true,
            'dra_lock' => true,
            'dordc_lock' => true,
        ]);

        $form->addHistoryEntry(
            'Recorded from the students sheet. This IRB was constituted before the portal, '
                . 'so no step here was answered.',
            Auth::user()->name()
        );

        Forms::updateOrCreate(
            ['form_type' => 'irb-constitution', 'student_id' => $student->roll_no],
            [
                'form_name' => 'IRB Constitution',
                'department_id' => $student->department_id,
                'stage' => 'complete',
                'max_count' => 1,
                'count' => 1,
                'steps' => $steps,
            ]
        );

        return $form;
    }

    /**
     * A faculty member named in a sheet, by email or by employee code.
     */
    private function facultyByIdentifier(string $identifier): ?Faculty
    {
        if (str_contains($identifier, '@')) {
            $userId = \App\Models\User::whereRaw('LOWER(email) = ?', [strtolower($identifier)])->value('id');

            return $userId ? Faculty::where('user_id', $userId)->first() : null;
        }

        return ctype_digit($identifier) ? Faculty::where('faculty_code', $identifier)->first() : null;
    }

    public function bulkUpload(Request $request)
    {
        $loggedInUser = Auth::user();
        if(!$loggedInUser->may('can_manage_students')){
            return response()->json([
                'message' => 'You do not have permission to create students'
            ], 403);
        }

        $request->validate([
            'students' => 'required|array',
            'students.*.full_name' => 'nullable|string',
            'students.*.first_name' => 'nullable|string',
            'students.*.last_name' => 'nullable|string',
            'students.*.phone' => 'nullable|string',
            'students.*.email' => 'required|email',
            'students.*.roll_no' => 'nullable|string',
            'students.*.department_code' => 'nullable|string',
            'students.*.date_of_registration' => 'nullable|date',
            'students.*.current_status' => 'nullable|in:part-time,full-time,executive',
            'students.*.date_of_irb' => 'nullable|date',
            'students.*.phd_title' => 'nullable|string',
            'students.*.fathers_name' => 'nullable|string',
            'students.*.address' => 'nullable|string',
            'students.*.overall_progress' => 'nullable|numeric',
            'students.*.cgpa' => 'nullable|numeric',
            'students.*.gender' => 'nullable|string',
            'students.*.is_jrf' => 'nullable|boolean',
            'students.*.is_net_gate_qualified' => 'nullable|boolean',
            'students.*.date_of_synopsis' => 'nullable|date',
            'students.*.date_of_thesis' => 'nullable|date',
            'students.*.date_of_thesis_awarded' => 'nullable|date',
            'students.*.supervisors' => 'nullable|array',
            'students.*.supervisors.*' => 'nullable|string',
            'students.*.committee' => 'nullable|array',
            'students.*.committee.*' => 'nullable|string',
            'students.*.irb_members' => 'nullable|array',
            'students.*.irb_members.*' => 'nullable|string',
            'students.*.external_expert' => 'nullable|array',
            'students.*.external_expert.name' => 'nullable|string',
            'students.*.external_expert.email' => 'nullable|email',
            'students.*.external_expert.designation' => 'nullable|string',
            'students.*.external_expert.department' => 'nullable|string',
            'students.*.external_expert.institution' => 'nullable|string',
        ]);

        $role_id = Role::where('role', 'student')->first()->id;
        $createCount = 0;
        $updateCount = 0;
        $failed = 0;
        $errors = [];

        DB::beginTransaction();
        
        try {
            foreach ($request->students as $index => $studentData) {
                try {
                    // Find department by code, accepting superseded codes so
                    // spreadsheets saved before the codes were corrected still
                    // import cleanly. Only validate if code was provided — partial updates may omit it.
                    $department = !empty($studentData['department_code']) ? \App\Support\DepartmentCodes::resolve($studentData['department_code']) : null;
                    if (!empty($studentData['department_code']) && !$department) {
                        $errors[] = "Row " . ($index + 1) . ": Department code '{$studentData['department_code']}' not found";
                        $failed++;
                        continue;
                    }

                    // Unified: if email or roll exists, update existing (partial) else create
                    $existingUser = \App\Models\User::where('email', $studentData['email'])->first();
                    $existingStudent = null;
                    if (!empty($studentData['roll_no'])) $existingStudent = Student::where('roll_no', $studentData['roll_no'])->first();
                    if (!$existingStudent && $existingUser) $existingStudent = Student::where('user_id', $existingUser->id)->first();

                    // The roll number and the email have to name the same
                    // person. Matching them separately let a row with one
                    // scholar's email and another's roll number write the name
                    // and phone onto the first while writing everything else
                    // onto the second.
                    if ($existingUser && $existingStudent && $existingStudent->user_id !== $existingUser->id) {
                        $errors[] = "Row " . ($index + 1) . ": the email and the registration number belong to different scholars";
                        $failed++; continue;
                    }

                    if ($existingUser && $existingStudent) {
                        // A blank cell means "not supplied", never "clear this".
                        // A spreadsheet carries every column on every row, so
                        // treating a present-but-empty cell as a value emptied
                        // the title, address, CGPA and IRB date of every scholar
                        // whose row only meant to correct a phone number, and
                        // zeroed the progress the DoRDC had approved.
                        // Clearing a field is done on the profile screen.
                        $name = PersonName::fromRow($studentData);
                        if ($name !== null) {
                            $existingUser->first_name = $name['first'];
                            $existingUser->last_name = $name['last'];
                        }
                        if (!empty($studentData['phone'])) $existingUser->phone = $studentData['phone'];
                        if (!empty($studentData['gender'])) $existingUser->gender = $studentData['gender'];
                        $existingUser->save();
                        if (!empty($studentData['department_code']) && $department) $existingStudent->department_id = $department->id;
                        foreach (self::OPTIONAL_STUDENT_FIELDS as $field) {
                            if (isset($studentData[$field]) && $studentData[$field] !== '') {
                                $existingStudent->$field = $studentData[$field];
                            }
                        }
                        $existingStudent->save();

                        $errors = array_merge(
                            $errors,
                            $this->syncSupervisionTeam($existingStudent, $studentData, $index + 1)
                        );

                        $errors = array_merge(
                            $errors,
                            $this->recordCarriedOverIrb($existingStudent, $studentData, $index + 1)
                        );

                        $updateCount++;
                        continue;
                    }
                    if ($existingUser || $existingStudent) {
                        $errors[] = "Row " . ($index + 1) . ": email/roll mismatch for existing student";
                        $failed++; continue;
                    }

                    // Create new - require minimal fields
                    $name = PersonName::fromRow($studentData);
                    if ($name === null || empty($studentData['phone']) || empty($studentData['roll_no']) || empty($studentData['department_code']) || empty($studentData['date_of_registration']) || empty($studentData['current_status'])) {
                        $errors[] = "Row " . ($index + 1) . ": missing required fields for new student (full_name, phone, roll_no, department_code, date_of_registration, current_status)";
                        $failed++; continue;
                    }
                    // Generated, never shown: the row is mailed a link below.
                    $password = Str::password(8, true, true, true, false);

                    // Create user (address lives on Student only)
                    $user = new \App\Models\User();
                    $user->first_name = $name['first'];
                    $user->last_name = $name['last'];
                    $user->phone = $studentData['phone'];
                    $user->email = $studentData['email'];
                    $user->password = bcrypt($password);
                    $user->gender = $studentData['gender'] ?? null;
                    $user->role_id = $role_id;
                    $user->current_role_id = $role_id;
                    $user->save();

                    // Create student
                    $student = new Student();
                    $student->user_id = $user->id;
                    $student->roll_no = $studentData['roll_no'];
                    $student->department_id = $department->id;
                    $student->date_of_registration = $studentData['date_of_registration'];
                    $student->date_of_irb = $studentData['date_of_irb'] ?? null;
                    $student->date_of_synopsis = $studentData['date_of_synopsis'] ?? null;
                    $student->date_of_thesis = $studentData['date_of_thesis'] ?? null;
                    $student->date_of_thesis_awarded = $studentData['date_of_thesis_awarded'] ?? null;
                    $student->phd_title = $studentData['phd_title'] ?? null;
                    $student->fathers_name = $studentData['fathers_name'] ?? null;
                    $student->current_status = $studentData['current_status'];
                    $student->address = $studentData['address'] ?? null;
                    $student->cgpa = $studentData['cgpa'] ?? null;
                    $student->is_jrf = $studentData['is_jrf'] ?? null;
                    $student->is_net_gate_qualified = $studentData['is_net_gate_qualified'] ?? null;
                    $student->overall_progress = $studentData['overall_progress'] ?? 0.0;
                    $student->save();

                    $user->inviteToSetPassword();

                    // Create supervisor allocation form
                    $adminFormController = new \App\Http\Controllers\AdminFormController();
                    $formData = $adminFormController->getFormCreationData(
                        'supervisor-allocation',
                        $student->roll_no,
                        $student->department_id
                    );
                    
                    if ($formData) {
                        Forms::create($formData);
                    }

                    $errors = array_merge(
                        $errors,
                        $this->syncSupervisionTeam($student, $studentData, $index + 1)
                    );

                    $errors = array_merge(
                        $errors,
                        $this->recordCarriedOverIrb($student, $studentData, $index + 1)
                    );

                    $createCount++;

                } catch (\Exception $e) {
                    $errors[] = "Row " . ($index + 1) . ": " . $e->getMessage();
                    $failed++;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Import completed: {$createCount} created, {$updateCount} updated, {$failed} errors",
                'data' => [
                    'success_count' => $createCount,
                    'update_count' => $updateCount,
                    'error_count' => $failed,
                    'errors' => $errors,
                ]
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Bulk upload failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function bulkUpdate(Request $request)
    {
        $loggedInUser = Auth::user();
        if(!$loggedInUser->may('can_manage_students')){
            return response()->json(['message' => 'You do not have permission to update students'], 403);
        }
        $request->validate([
            'students' => 'required|array',
            'students.*.email' => 'required|email',
            'students.*.roll_no' => 'nullable|string',
            'students.*.full_name' => 'nullable|string',
            'students.*.first_name' => 'nullable|string',
            'students.*.last_name' => 'nullable|string',
            'students.*.phone' => 'nullable|string',
            'students.*.department_code' => 'nullable|string',
            'students.*.date_of_registration' => 'nullable|date',
            'students.*.current_status' => 'nullable|in:part-time,full-time,executive',
            'students.*.phd_title' => 'nullable|string',
            'students.*.fathers_name' => 'nullable|string',
            'students.*.address' => 'nullable|string',
            'students.*.cgpa' => 'nullable|numeric',
            'students.*.overall_progress' => 'nullable|numeric',
        ]);
        $updated = 0; $failed = 0; $errors = [];
        DB::beginTransaction();
        try {
            foreach ($request->students as $index => $data) {
                try {
                    $user = \App\Models\User::where('email', $data['email'])->first();
                    $student = null;
                    if (!empty($data['roll_no'])) $student = Student::where('roll_no', $data['roll_no'])->first();
                    if (!$user && !$student) { $errors[] = "Row ".($index+1).": no matching student for email {$data['email']} or roll {$data['roll_no']}"; $failed++; continue; }
                    if ($user) {
                        $name = PersonName::fromRow($data);
                        if ($name !== null) {
                            $user->first_name = $name['first'];
                            $user->last_name = $name['last'];
                        }
                        if (!empty($data['phone'])) $user->phone = $data['phone'];
                        $user->save();
                    }
                    $target = $student ?? Student::where('user_id', $user->id)->first();
                    if (!$target) { $errors[] = "Row ".($index+1).": student record not found"; $failed++; continue; }
                    if (!empty($data['department_code'])) {
                        $dept = \App\Support\DepartmentCodes::resolve($data['department_code']);
                        if (!$dept) { $errors[] = "Row ".($index+1).": department code '{$data['department_code']}' not found"; $failed++; continue; }
                        $target->department_id = $dept->id;
                    }
                    if (isset($data['phd_title'])) $target->phd_title = $data['phd_title'];
                    if (isset($data['fathers_name'])) $target->fathers_name = $data['fathers_name'];
                    if (isset($data['address'])) $target->address = $data['address'];
                    if (isset($data['cgpa'])) $target->cgpa = $data['cgpa'];
                    if (isset($data['overall_progress'])) $target->overall_progress = $data['overall_progress'];
                    if (!empty($data['current_status'])) $target->current_status = $data['current_status'];
                    if (!empty($data['date_of_registration'])) $target->date_of_registration = $data['date_of_registration'];
                    if (array_key_exists('date_of_irb', $data)) $target->date_of_irb = $data['date_of_irb'];
                    $target->save();
                    $updated++;
                } catch (\Exception $e) { $errors[] = "Row ".($index+1).": ".$e->getMessage(); $failed++; }
            }
            DB::commit();
            return response()->json([
                'success' => true,
                'message' => "Import completed: 0 created, {$updated} updated, {$failed} errors",
                'data' => [
                    'success_count' => 0,
                    'update_count' => $updated,
                    'error_count' => $failed,
                    'errors' => $errors,
                ]
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Bulk update failed','error' => $e->getMessage()], 500);
        }
    }

 public function list(Request $request)
{
    $loggedInUser = Auth::user();
    $role = $loggedInUser->current_role->role;
    $filters = $request->input('filters', []);
    $perPage = $request->input('rows', 15);
    $page = $request->input('page', 1);
    $all = $request->input('all', false);
    $filtersJson = $request->query('filters');

    if ($filtersJson) {
          $filters = json_decode(urldecode($filtersJson), true);
    }

    $studentsQuery = Student::with(self::LIST_RELATIONS);

    // The capability decides whether a role may read at all; the role still
    // decides which records that means, because "their department" is one
    // department for a HOD and a list of them for an ADORDC.
    $with = self::LIST_RELATIONS;

    if ($loggedInUser->may('can_read_all_students')) {
        // No scoping.
    } elseif ($loggedInUser->may('can_read_department_students')) {
        $departments = $role === 'adordc'
            ? $loggedInUser->faculty->adordcDepartments->pluck('id')
            : [$loggedInUser->faculty->department_id];
        $studentsQuery->whereIn('department_id', $departments);
    } elseif ($loggedInUser->may('can_read_supervised_students')) {
        $studentsQuery = $loggedInUser->faculty->supervisedStudents()->with($with);
    } elseif ($loggedInUser->may('can_read_committee_students')) {
        $studentsQuery = $loggedInUser->faculty->doctoredStudents()->with($with);
    } elseif ($role === 'student') {
        // Reading your own record is identity, not a capability.
        $studentsQuery->where('user_id', $loggedInUser->id);
    } else {
        return response()->json(['message' => 'You do not have permission to view students'], 403);
    }

    if ($filters) {
        $studentsQuery = $this->applyDynamicFilters($studentsQuery, $filters, 'student');
    }

    // Sort alphabetically by the student's name. Ordered via a correlated subquery
    // rather than a join so the eager loads and `select *` above stay intact.
    $studentsQuery->orderBy(User::select('first_name')->whereColumn('users.id', 'students.user_id'))
        ->orderBy(User::select('last_name')->whereColumn('users.id', 'students.user_id'));

    // Check if all flag is set
    if ($all) {
        $students = $studentsQuery->get();
        $result = $students->map(function ($student) {
            return $this->ListStudentProfile($student);
        });
        
        return response()->json([
            'data' => $result,
            'total' => $students->count(),
            'per_page' => $students->count(),
            'current_page' => 1,
            'totalPages' => 1,
            'role' => $role,
            'fields'=>['name','roll_no','overall_progress','department','email','phone'],
            'fieldsTitles'=>['Name','Roll No','Overall Progress','Department','Email','Phone'],
        ]);
    }
    
    $students = $studentsQuery->paginate($perPage, ['*'], 'page', $page);
    $result = $students->getCollection()->map(function ($student) {
        return $this->ListStudentProfile($student);
    });

    return response()->json([
        'data' => $result,
        'total' => $students->total(),
        'per_page' => $students->perPage(),
        'current_page' => $students->currentPage(),
        'totalPages' => $students->lastPage(),
        'role' => $role,
         'fields'=>['name','roll_no','overall_progress','department','email','phone'],
         'fieldsTitles'=>['Name','Roll No','Overall Progress','Department','Email','Phone'],
    ]);
}

    
    

    public function get(Request $request, $roll_no)
    {
        $loggenInUser = Auth::user();
        $role = $loggenInUser->current_role->role;

        // Mirrors list(): the capability decides whether, the role still decides
        // which records. These two had drifted, so a doctoral committee member
        // saw a student in the listing and was refused when they opened them.
        if ($loggenInUser->may('can_read_all_students')) {
            $student = Student::find($roll_no);
        } elseif ($loggenInUser->may('can_read_department_students')) {
            $departments = $role === 'adordc'
                ? $loggenInUser->faculty->adordcDepartments->pluck('id')
                : [$loggenInUser->faculty->department_id];
            $student = Student::whereIn('department_id', $departments)
                ->where('roll_no', $roll_no)->first();
        } elseif ($loggenInUser->may('can_read_supervised_students')
            || $loggenInUser->may('can_read_committee_students')) {
            $student = Student::find($roll_no);
            $code = $loggenInUser->faculty?->faculty_code;
            // Supervising them or sitting on their committee both count: the
            // profile links to committee students, and refusing the link the
            // page itself offers is not a boundary, it is a dead end.
            $related = $code && ($student?->checkSupervises($code) || $student?->checkDoctoralCommittee($code));
            if (!$related) {
                return response()->json([
                    'message' => 'You do not have permission to view student'
                ], 403);
            }
        } elseif ($role === 'student') {
            $student = Student::where('user_id', $loggenInUser->id)->where('roll_no', $roll_no)->first();
        } else {
            return response()->json([
                'message' => 'You do not have permission to view student'
            ], 403);
        }
        if(!$student){
            return response()->json([
                'message' => 'Student not found'
            ], 404);
        }
        return response()->json($this->profileEnvelope($student), 200);
    }

    /**
     * The scholar, or the response to send instead.
     *
     * The gate every section hung off a profile shares, so what the page shows
     * and what it may fetch cannot disagree.
     */
    private function readableStudent($roll_no)
    {
        $student = Student::find($roll_no);
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }

        return $student->isReadableBy(Auth::user())
            ? $student
            : response()->json(['message' => 'You do not have permission to view student'], 403);
    }

    /**
     * One scholar's publications and patents, for their profile.
     *
     * PublicationController::get answers the same shape for whoever is signed
     * in, and takes no scholar, so a supervisor or the office had no way to see
     * a scholar's work from their record. The grouping is the one the
     * publications page and the faculty research profile already use; only the
     * gate is different, because the question here is "may I read this scholar"
     * rather than "are these mine".
     */
    public function publications(Request $request, $roll_no)
    {
        $student = $this->readableStudent($roll_no);
        if (!$student instanceof Student) {
            return $student;
        }

        // The scholar's own library, not the copies a form took: a publication
        // linked onto three progress reports is one piece of work.
        return response()->json(Publication::groupedFor('student_id', $student->roll_no), 200);
    }

    /**
     * The scholar's progress over time, for the chart on their profile.
     *
     * One point per evaluation: the date it happened and the total the scholar
     * stood at afterwards, plus the milestone dates to mark on the same axis.
     *
     * Its own endpoint rather than a field on the profile, because
     * ListStudentProfile is built once per row on the form lists too and this
     * would be a query each time.
     *
     * An evaluation with no date cannot be placed on a time axis. Imported
     * history often has none, so it falls back to the end of its semester and
     * is left out only if that is missing as well.
     */
    public function progressHistory(Request $request, $roll_no)
    {
        $student = $this->readableStudent($roll_no);
        if (!$student instanceof Student) {
            return $student;
        }

        $points = Presentation::with('semester:id,end_date')
            ->where('student_id', $student->roll_no)
            ->whereNotNull('total_progress')
            ->get()
            // Presentation.date is not cast and Semester.end_date is, so one is
            // a string and the other a Carbon. Both print with the date first.
            ->map(fn ($evaluation) => [
                'date' => substr((string) ($evaluation->date ?: $evaluation->semester?->end_date), 0, 10),
                'semester' => $evaluation->period_of_report,
                'progress' => (float) $evaluation->total_progress,
            ])
            ->filter(fn ($point) => !empty($point['date']))
            ->sortBy('date')
            ->values();

        return response()->json([
            'points' => $points,
            // Marked on the same axis, so the progress line can be read against
            // what the scholar was doing at the time.
            'milestones' => collect([
                ['label' => 'Admission', 'date' => $student->date_of_registration],
                ['label' => 'IRB', 'date' => $student->date_of_irb],
                ['label' => 'Synopsis', 'date' => $student->date_of_synopsis],
                ['label' => 'Thesis', 'date' => $student->date_of_thesis],
                ['label' => 'Awarded', 'date' => $student->date_of_thesis_awarded],
            ])->filter(fn ($milestone) => $milestone['date'])
                ->map(fn ($milestone) => [
                    'label' => $milestone['label'],
                    'date' => $milestone['date']->toDateString(),
                ])->values(),
        ], 200);
    }

    /**
     * The signed-in student's own profile.
     *
     * Mirrors faculty: a profile is addressed either by id or by "me", and both
     * answer with the same envelope, so a page that shows a profile never has
     * to care which it asked for.
     */
    public function me()
    {
        $student = optional(Auth::user())->student;
        if (!$student) {
            return response()->json(['message' => 'No student record for this user'], 404);
        }

        return response()->json($this->profileEnvelope($student), 200);
    }

    /**
     * One profile plus what the viewer may do with it.
     *
     * The flags are named as they are on the faculty profile: `can_edit` is
     * permission to write the record at all, `can_manage` is permission to
     * write anyone's. A screen reads these instead of deciding from the role it
     * finds in local storage, which is how the student page came to offer
     * supervisor management to a doctoral member who cannot save it, and to
     * withhold it from a DRA who can.
     */
    private function profileEnvelope($student): array
    {
        return [
            'profile' => $this->ListStudentProfile($student),
            'is_self' => $this->isSelf($student),
            'can_edit' => $this->canEditProfile($student),
            'can_manage' => $this->canManageStudents(),
        ];
    }

    private function isSelf($student): bool
    {
        return optional(Auth::user())->id === $student->user_id;
    }

    private function canManageStudents(): bool
    {
        return optional(Auth::user()?->current_role)->can_manage_students === 'true';
    }

    private function canEditProfile($student): bool
    {
        if ($this->canManageStudents()) {
            return true;
        }

        return $this->isSelf($student)
            && (bool) optional(Auth::user())?->may('can_edit_own_student_profile');
    }

    // Admin/privileged update of any student, keyed by roll_no. Distinct from
    // updateProfile (which is the student editing their own limited fields).
    public function adminUpdate(Request $request, $roll_no)
    {
        if (!$this->canManageStudents()) {
            return response()->json([
                'message' => 'You do not have permission to edit student'
            ], 403);
        }

        $student = Student::where('roll_no', $roll_no)->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }
        $user = $student->user;

        $request->validate([
            'full_name' => 'required_without:first_name|string',
            'first_name' => 'required_without:full_name|string',
            'last_name' => 'nullable|string',
            'phone' => 'required|string|unique:users,phone,' . $user->id,
            'email' => 'required|email|unique:users,email,' . $user->id,
            'department_id' => 'required|integer',
            'date_of_registration' => 'required|date',
            'current_status' => 'required|in:part-time,full-time,executive',
            'gender' => 'required|in:Male,Female',
            'physically_handicapped' => 'nullable|boolean',
            'is_jrf' => 'nullable|boolean',
            'is_net_gate_qualified' => 'nullable|boolean',
            'date_of_irb' => 'nullable|date',
            'date_of_synopsis' => 'nullable|date',
            'date_of_thesis' => 'nullable|date',
            'date_of_thesis_awarded' => 'nullable|date',
            'phd_title' => 'nullable|string',
            'fathers_name' => 'nullable|string',
            'address' => 'nullable|string',
            'overall_progress' => 'nullable|numeric',
            'cgpa' => 'nullable|numeric',
        ]);

        $name = $request->filled('full_name')
            ? PersonName::split($request->input('full_name'))
            : ['first' => $request->input('first_name'), 'last' => $request->input('last_name') ?: $user->last_name];
        $user->first_name = $name['first'];
        $user->last_name = $name['last'];
        $user->phone = $request->phone;
        $user->email = $request->email;
        if ($request->has('address')) $user->address = $request->address;
        if ($request->has('gender')) $user->gender = $request->gender;
        // Extends the thesis deadline, so it stays on the privileged path only.
        if ($request->has('physically_handicapped')) $user->physically_handicapped = $request->boolean('physically_handicapped');
        $user->save();

        $student->department_id = $request->department_id;
        $student->date_of_registration = $request->date_of_registration;
        $student->date_of_irb = $request->date_of_irb;
        $student->date_of_synopsis = $request->date_of_synopsis;
        $student->date_of_thesis = $request->date_of_thesis;
        $student->phd_title = $request->phd_title;
        $student->fathers_name = $request->fathers_name;
        $student->current_status = $request->current_status;
        if ($request->has('address')) $student->address = $request->address;
        $student->cgpa = $request->cgpa;
        // Says where the scholar's stipend comes from, so it stays on the
        // privileged path rather than the scholar's own profile edit.
        if ($request->has('is_jrf')) $student->is_jrf = $request->boolean('is_jrf');
        // Off the office's sheet, like JRF, so it stays on the privileged path.
        if ($request->has('is_net_gate_qualified')) $student->is_net_gate_qualified = $request->boolean('is_net_gate_qualified');
        if ($request->has('overall_progress')) $student->overall_progress = $request->overall_progress;
        $student->save();

        return response()->json([
            'message' => 'Student updated successfully',
        ] + $this->profileEnvelope($student->refresh()), 200);
    }

    /**
     * The soft half of a student record: what the scholar keeps current about
     * themselves. Addressed by roll number and open to a privileged role too,
     * so it is the same shape as the faculty profile write.
     *
     * Distinct from adminUpdate, which owns the provisioning half: department,
     * admission date, status, gender. That split exists on the faculty side as
     * well, between this controller and FacultyController::update.
     */
    public function updateProfile(Request $request, $roll_no)
    {
        $student = Student::where('roll_no', $roll_no)->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }

        if (!$this->canEditProfile($student)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'phone'                => 'nullable|string',
            'address'              => 'nullable|string',
            'fathers_name'         => 'nullable|string',
            'phd_title'            => 'nullable|string|max:1000',
            'tentative_desc'       => 'nullable|string|max:5000',
            'strengths'            => 'nullable|string|max:5000',
            'help_needed'          => 'nullable|string|max:5000',
            'cgpa'                 => 'nullable|numeric',
        ]);

        // The phone belongs to the student being edited, not to whoever is
        // signed in. Reading it off the acting user would have written an
        // admin's own number onto their account.
        $user = $student->user;
        if ($user) {
            $user->phone = $request->phone ?? $user->phone;
            $user->save();
        }

        if ($request->has('address'))      $student->address      = $request->address;
        if ($request->has('fathers_name')) $student->fathers_name = $request->fathers_name;
        if ($request->has('strengths'))    $student->strengths    = $request->strengths;
        if ($request->has('help_needed'))  $student->help_needed  = $request->help_needed;
        // PhD title and tentative fields can be edited until IRB is constituted/locked
        if (!$student->phdTitleLocked()) {
            if ($request->has('phd_title'))            $student->phd_title            = $request->phd_title;
            if ($request->has('tentative_desc'))       $student->tentative_desc       = $request->tentative_desc;
        }
        if ($request->has('cgpa'))         $student->cgpa         = $request->cgpa;
        $student->save();

        return response()->json([
            'message' => 'Profile updated successfully',
        ] + $this->profileEnvelope($student->refresh()), 200);
    }
}

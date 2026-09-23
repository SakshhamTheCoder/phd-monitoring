<?php

namespace App\Models;

use App\Support\ThesisDeadline;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    use HasFactory;

    protected $table = 'students';
    protected $primaryKey = 'roll_no';
    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'roll_no',
        'department_id',
        'broad_area',
        'date_of_registration',
        'date_of_irb',
        'date_of_synopsis',
        'date_of_thesis',
        'date_of_thesis_awarded',
        'phd_title',
        'tentative_desc',
        'fathers_name',
        'address',
        'import_batch',
        'imported_at',
        'current_status',
        'cgpa',
        'is_jrf',
        'net_gate',
        'strengths',
        'help_needed',
        'overall_progress',
    ];

    protected $casts = [
        'imported_at' => 'datetime',
        // Serialised as plain Y-m-d. The bare 'date' cast sent a UTC timestamp,
        // which with APP_TIMEZONE=Asia/Kolkata is 18:30 the day before; a form
        // that saved that string back moved the date a day earlier every time.
        'date_of_registration' => 'date:Y-m-d',
        'date_of_irb' => 'date:Y-m-d',
        'date_of_synopsis' => 'date:Y-m-d',
        'date_of_thesis' => 'date:Y-m-d',
        'date_of_thesis_awarded' => 'date:Y-m-d',
        'is_jrf' => 'boolean',
        'overall_progress' => 'float',
    ];

    protected $hidden = [
        'created_at',
        'updated_at',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The PhD title is editable from the profile only until the student has
     * submitted their IRB constitution form (its own "Title of Phd Thesis"
     * field takes over from that point). student_lock flips to true once the
     * student submits, and back to false if the form is returned for revision.
     */
    public function phdTitleLocked(): bool
    {
        return $this->irbConstitutions()->contains(fn ($form) => (bool) $form->student_lock);
    }

    /**
     * Whether the student's IRB information is actually complete.
     *
     * This is deliberately a different question from phdTitleLocked(), which
     * asks whether the title may still be edited and flips the moment the form
     * is submitted. A title stops being tentative when the IRB is approved, not
     * when someone has filed the paperwork, and never because a date column
     * happens to hold a value.
     */
    public function irbCompleted(): bool
    {
        return self::irbStatusMeansComplete(
            $this->irbConstitutions()->sortByDesc('id')->first()?->status
        );
    }

    /** Split out so the rule itself is testable without a database. */
    public static function irbStatusMeansComplete(?string $status): bool
    {
        return strtolower(trim((string) $status)) === 'approved';
    }

    /**
     * The year the scholar registered, which decides which synopsis checklist
     * they are shown. Read off date_of_registration; there is no separate
     * admission-year column and a second one would only drift from this.
     */
    public function admissionYear(): ?int
    {
        return $this->date_of_registration
            ? (int) date('Y', strtotime((string) $this->date_of_registration))
            : null;
    }

    /**
     * Credits from coursework the scholar has finished.
     *
     * Counts every row marked complete. The grade is not read: it is a free
     * string today, so there is no reliable way to tell a pass from a fail, and
     * guessing would silently withhold credits somebody has earned.
     */
    public function completedCredits(): float
    {
        return (float) StudentCourse::where('student_id', $this->roll_no)
            ->where('student_courses.status', 'completed')
            ->join('courses', 'courses.id', '=', 'student_courses.course_id')
            ->sum('courses.credits');
    }

    /**
     * The credits this scholar's status requires before a synopsis.
     *
     * An unrecognised status falls to the full-time figure rather than throwing
     * on a settings key that does not exist. current_status is an enum, so that
     * only happens if a status is added without a setting to go with it.
     */
    public function requiredCredits(): int
    {
        $key = 'min_credits_' . str_replace('-', '_', (string) $this->current_status);
        if (!array_key_exists($key, AppSetting::GROUPS['coursework']['defaults'])) {
            $key = 'min_credits_full_time';
        }

        return AppSetting::value('coursework', $key);
    }

    public function hasFinishedCoursework(): bool
    {
        return $this->completedCredits() >= $this->requiredCredits();
    }

    public function isSupervisorAllocated(): bool
    {
        // The listing has them loaded already; asking the database again is 50
        // queries for rows sitting in memory.
        return $this->relationLoaded('supervisors')
            ? $this->supervisors->isNotEmpty()
            : $this->supervisors()->exists();
    }

    public function canEditTentative(): bool
    {
        return !$this->phdTitleLocked();
    }
    public function getStudent()
    {
        return [
            'name' => $this->user->name,
            'roll_no' => $this->roll_no,
            'department' => $this->department->name,
            'date_of_registration' => $this->date_of_registration,
            'date_of_irb' => $this->date_of_irb,
            'date_of_synopsis' => $this->date_of_synopsis,
            'phd_title' => $this->phd_title,
            'fathers_name' => $this->fathers_name,
            'address' => $this->address,
            'current_status' => $this->current_status,
            'cgpa' => $this->cgpa,
            'address' => $this->address
        ];
    }
    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function supervisors()
    {
        return $this->belongsToMany(Faculty::class, 'supervisors', 'student_id', 'faculty_id', 'roll_no', 'faculty_code');
    }

    public function checkIrbCompletionStatus()
    {

        $irbSubForm = IrbSubForm::where('student_id', $this->roll_no)->first();

        if ($irbSubForm && $irbSubForm->status == 'approved' && $irbSubForm->status == 'complete') {
            return true;
        } else {
            return false;
        }
    }


    public function statusChanges()
    {
        return $this->hasMany(StudentStatusChange::class, 'student_id', 'roll_no');
    }

    public function supervisor_update_date()
    {
        $last_update = Supervisor::where('student_id', $this->roll_no)->orderBy('updated_at', 'desc')->first();
        return $last_update->updated_at;
    }

    public function doctoralCommittee()
    {
        return $this->belongsToMany(Faculty::class, 'doctoral_commitee', 'student_id', 'faculty_id', 'roll_no', 'faculty_code')
            ->with('user'); // Include user details
    }

    /**
     * Whether this account may read the scholar's profile, and so what hangs off
     * it. The capability decides whether, the role still decides which scholars,
     * the same way StudentController::list() chooses who to show.
     */
    public function isReadableBy(User $user): bool
    {
        if ($user->may('can_read_all_students')) {
            return true;
        }

        if ($user->may('can_read_department_students')) {
            $departments = $user->current_role->role === 'adordc'
                ? $user->faculty?->adordcDepartments->pluck('id')->all() ?? []
                : [$user->faculty?->department_id];
            return in_array($this->department_id, $departments);
        }

        if ($user->may('can_read_supervised_students') || $user->may('can_read_committee_students')) {
            $code = $user->faculty?->faculty_code;
            return $code && ($this->checkSupervises($code) || $this->checkDoctoralCommittee($code));
        }

        return $user->current_role->role === 'student' && $this->user_id === $user->id;
    }

    public function checkDoctoralCommittee($facultyId)
    {
        return $this->doctoralCommittee->contains('faculty_code', $facultyId);
    }

    public function hod()
    {
        return $this->department()->first()->hod();
    }
    public function objectives()
    {
        return $this->hasMany(PHDObjective::class, 'student_id', 'roll_no');
    }
    public function irbForm()
    {
        return $this->hasOne(ConstituteOfIRB::class, 'student_id', 'roll_no');
    }

    /**
     * Every IRB constitution form the student has, which is what both
     * phdTitleLocked() and irbCompleted() read. Eager-loadable, and loaded
     * once per instance when it is not.
     */
    public function irbForms()
    {
        return $this->hasMany(ConstituteOfIRB::class, 'student_id', 'roll_no');
    }

    /** The loaded forms, loading them once if nobody eager-loaded them. */
    private function irbConstitutions()
    {
        if (!$this->relationLoaded('irbForms')) {
            $this->load('irbForms');
        }

        return $this->getRelation('irbForms');
    }

    public function irbSubForm()
    {
        return $this->hasOne(IrbSubForm::class, 'student_id', 'roll_no');
    }

    public function statusChangeForms()
    {
        return $this->hasOne(StudentStatusChangeForms::class, 'student_id', 'roll_no');
    }

    public static function findByUserId($userId)
    {
        return self::where('user_id', $userId)->first();
    }

    public function checkSupervises($facultyId)
    {
        return $this->supervisors->contains('faculty_code', $facultyId);
    }

    public function checkHOD($facultyId)
    {
        return $this->department->first()->hod_id == $facultyId;
    }

    public function checkPhdCoordinator($facultyId)
    {
        return $this->department->phdCoordinators->contains($facultyId);
    }

    public function researchExtentionsForm()
    {
        return $this->hasOne(ResearchExtentionsForm::class, 'student_id', 'roll_no');
    }

    public function researchExtentions()
    {
        return $this->hasMany(ResearchExtentions::class, 'student_id', 'roll_no');
    }

    public function thesisExtentions()
    {
        return $this->hasMany(ThesisExtension::class, 'student_id', 'roll_no');
    }

    public function thesisExtentionsForm()
    {
        return $this->hasMany(ThesisExtentionForm::class, 'student_id', 'roll_no');
    }

    public function supervisorChangeForm()
    {
        return $this->hasOne(SupervisorChangeForm::class, 'student_id', 'roll_no');
    }

    /**
     * The up to three areas the scholar asked to work in, from the allocation
     * form. Their settled area is area_of_specialization_id, set later.
     */
    public function areaPreferences()
    {
        return $this->hasMany(StudentAreaPreference::class, 'student_id', 'roll_no');
    }

    /**
     * The broad area to show: the settled one once the IRB form sets it, the
     * areas asked for at allocation until then. Most scholars are in the second
     * group, so reading broad_area alone left the column blank.
     */
    public function broadAreaLabel(): ?string
    {
        return $this->broad_area
            ?: ($this->areaPreferences->pluck('broad_area')->filter()->join(', ') ?: null);
    }

    public function subdomains()
    {
        return $this->hasMany(StudentSubdomain::class, 'student_id', 'roll_no');
    }

    /**
     * Earliest and latest thesis submission dates, or null when the student has
     * no date of admission to count from. Every caller reads them from here so
     * the profile, the submission guard and the deadline notice agree.
     *
     * @return array{earliest:string, latest:string, days_remaining:int, extensions_granted:int}|null
     */
    public function thesisWindow(): ?array
    {
        if (!$this->date_of_registration) {
            return null;
        }

        $limits = AppSetting::map('thesis');
        $admission = $this->date_of_registration->toDateString();
        $baseYears = ThesisDeadline::baseYearsFor(
            $this->user?->gender,
            (bool) $this->user?->physically_handicapped,
            $limits['base_years_male'],
            $limits['base_years_female_ph']
        );

        $extensions = $this->thesisExtentions;
        $latest = ThesisDeadline::latest($admission, $baseYears, (int) $extensions->sum('period_of_extention'));

        return [
            'earliest' => ThesisDeadline::earliest($admission, $limits['min_years']),
            'latest' => $latest,
            'days_remaining' => ThesisDeadline::daysRemaining($latest, now()->toDateString()),
            'extensions_granted' => $extensions->count(),
        ];
    }

    public function initialStatus()
    {
        $changes = $this->statusChanges()->orderBy('created_at', 'asc')?->first();
        if (!$changes) {
            return $this->current_status;
        }
        $init = $changes->type_of_change == 'full-time to part-time' ? 'full-time' : 'part-time';
        return $init;
    }


    public function publications()
    {
        return $this->hasMany(Publication::class, 'student_id', 'roll_no');
    }

    public function semester_offs()
    {
        return $this->hasMany(StudentSemesterOff::class, 'student_id', 'roll_no');
    }

    public function form()
    {
        return $this->hasMany(Forms::class, 'student_id', 'roll_no')
            ->where('student_available', true);
    }

    public function forms()
    {
        $forms = $this->hasMany(Forms::class, 'student_id', 'roll_no')->where('student_available', true)->get();
        $ret = [];
        foreach ($forms as $form) {
            if ($form->stage === 'student') {
                $form['action_required'] = true;
            } else {
                $form['action_required'] = false;
            }
            $ret[] = $form;
        }
        return $ret;
    }

    public function presentations()
    {
        return $this->hasMany(Presentation::class, 'student_id', 'roll_no');
    }
    public function irbCommittees()
    {
        return $this->hasMany(IRBCommittee::class, 'student_id', 'roll_no');
    }

    /**
     * Get the outside expert associated with this student, if any.
     */
    public function outsideExpert()
    {
        return $this->irbCommittees()
            ->where('type', 'outside')
            ->where('member_type', OutsideExpert::class)
            ->with('member')
            ->first()?->member;
    }
}

<?php

namespace App\Models;

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
        'area_of_specialization_id',
        'date_of_registration',
        'date_of_irb',
        'date_of_synopsis',
        'phd_title',
        'tentative_desc',
        'tentative_broad_area',
        'fathers_name',
        'address',
        'current_status',
        'cgpa',
        'overall_progress',
    ];

    protected $casts = [
        'date_of_registration' => 'date',
        'date_of_irb' => 'date',
        'date_of_synopsis' => 'date',
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
        return ConstituteOfIRB::where('student_id', $this->roll_no)
            ->where('student_lock', true)
            ->exists();
    }

    public function isSupervisorAllocated(): bool
    {
        return $this->supervisors()->exists();
    }

    public function canEditTentative(): bool
    {
        return $this->isSupervisorAllocated() && !$this->phdTitleLocked();
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

    public function areaOfSpecialization()
    {
        return $this->belongsTo(AreaOfSpecialization::class, 'area_of_specialization_id');
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

    public function broad_area_specialization()
    {
        return $this->hasMany(StudentBroadAreaSpecialization::class, 'student_id', 'roll_no');
    }

    public function subdomains()
    {
        return $this->hasMany(StudentSubdomain::class, 'student_id', 'roll_no');
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

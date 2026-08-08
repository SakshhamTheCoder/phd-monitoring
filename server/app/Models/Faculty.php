<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Faculty extends Model
{
    use HasFactory;
    protected $table = 'faculty';
    protected $primaryKey = 'faculty_code';
    public $incrementing = false;
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'user_id',
        'designation',
        'department_id',
        'faculty_code',
        'supervised_campus',
        'supervied_outside',
        'type',
        'institution',
        'website_link',
        'orcid_id',
        'scopus_id',
        'google_scholar_id',
        'citations',
        'h_index',
        'joined_on',
        'last_synced_at',
        'last_sync_source',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    /**
     * The attributes that should be hidden for arrays.
     *
     * @var array
     */
    protected $hidden = [
        'created_at',
        'updated_at',
    ];

    /**
     * Get the user associated with the faculty.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }


    /**
     * Get the department associated with the faculty.
     */
    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function supervisedStudents()
    {
        return $this->belongsToMany(Student::class, 'supervisors',  'faculty_id', 'student_id',  'faculty_code', 'roll_no');
    }

    public function publications()
    {
        return $this->hasMany(FacultyPublication::class, 'faculty_code', 'faculty_code');
    }

    /**
     * Live count of students this faculty is currently supervising on campus.
     * Overrides the stored `supervised_campus` column (which was stale/broken)
     * so every profile/list reads the real number of supervised students.
     */
    public function getSupervisedCampusAttribute()
    {
        return $this->supervisedStudents()->count();
    }

    public function doctoredStudents()
    {
        return $this->belongsToMany(Student::class, 'doctoral_commitee', 'faculty_id', 'student_id');
    }
    public function adordcDepartments()
    {
        return $this->hasMany(Department::class, 'adordc_id', 'faculty_code');
    }

    public function students()
    {
        $sup = $this->supervisedStudents;
        $doc = $this->doctoredStudents;
        $final_sup = [];
        $out = [];
        foreach ($doc as $d) {
            $d['type'] = 'Doctoral Committee';
            $final_sup['name'] = $d->user->name();
            $final_sup['roll_no'] = $d->roll_no;
            $final_sup['type'] = 'Doctoral Committee';
            $final_sup['department'] = $d->department->name;
            $final_sup['current_status'] = $d->current_status;
            $final_sup['phd_title'] = $d->phd_title;
            $out[] = $final_sup;
        }
        foreach ($sup as $s) {
            $s['type'] = 'Supervisor';
            $final_sup['name'] = $s->user->name();
            $final_sup['roll_no'] = $s->roll_no;
            $final_sup['type'] = 'Supervisor';
            $final_sup['department'] = $s->department->name;
            $final_sup['current_status'] = $s->current_status;
            $final_sup['phd_title'] = $s->phd_title;
            $out[] = $final_sup;
        }
        return $out;
    }

    public function irbNomineeCognates()
    {
        return $this->hasMany(IrbNomineeCognate::class, 'nominee_id', 'faculty_code');
    }

    public function irbExpertDepartments()
    {
        return $this->hasMany(IrbExpertDepartment::class, 'expert_id', 'faculty_code');
    }
    public static function findByUserId($userId)
    {
        return self::where('user_id', $userId)->first();
    }

    public function forms($roll_no = null)
    {
        $data = [];
        if ($this->user->current_role->role == 'faculty' && !$roll_no) {
            $super = $this->supervisedStudents;
            $data = [];
            foreach ($super as $s) {
                $forms = $s->student->forms();
                foreach ($forms as $f) {
                    if ($f->stage == 'supervisor') {
                        $f['action_required'] = true;
                    } else
                        $d['action_required'] = false;
                    if ($f->supervisor_available == true) {
                        $data[] = $f;
                    }
                }
            }
        } else if ($this->user->current_role->role == 'faculty' && $roll_no) {
            $super = Forms::where('student_id', $roll_no)->where('supervisor_available', true)->get();
            $data = [];
            if ($super)
                foreach ($super as $s) {
                    $forms = $s->student->forms();

                    if ($s->stage == 'supervisor') {
                        $s['action_required'] = true;
                    } else
                        $s['action_required'] = false;
                    if ($s->supervisor_available == true) {
                        $data[] = $s;
                    }
                }
        } else if ($this->user->current_role->role == 'doctoral' || $this->user->current_role->role == 'external') {
            if ($roll_no) {
                $data = Forms::where('doctoral_available', true)->where('student_id', $roll_no)->get();
                $data = Forms::where('external_available', true)->where('student_id', $roll_no)->get();
            } else {
                $data = Forms::where('doctoral_available', true)->get();
                $data = Forms::where('external_available', true)->get();
            }
            foreach ($data as $d) {
                if ($d->stage == 'doctoral')
                    $d['action_required'] = true;
                else
                    $d['action_required'] = false;
            }
        } else if ($this->user->current_role->role == 'dra') {
            if ($roll_no) {
                $data = Forms::where('dra_available', true)->where('student_id', $roll_no)->get();
            } else {
                $data = Forms::where('dra_available', true)->get();
            }
            foreach ($data as $d) {
                if ($d->stage == 'dra')
                    $d['action_required'] = true;
                else
                    $d['action_required'] = false;
            }
        } else if ($this->user->current_role->role == 'dordc') {
            if ($roll_no) {
                $data = Forms::where('dordc_available', true)->where('student_id', $roll_no)->get();
            } else {
                $data = Forms::where('dordc_available', true)->get();
            }
            foreach ($data as $d) {
                if ($d->stage == 'dordc')
                    $d['action_required'] = true;
                else
                    $d['action_required'] = false;
            }
        } else if ($this->user->current_role->role == 'director') {

            if ($roll_no) {
                $data = Forms::where('director_available', true)->where('student_id', $roll_no)->get();
            } else {
                $data = Forms::where('director_available', true)->get();
            }
            foreach ($data as $d) {
                if ($d->stage == 'director')
                    $d['action_required'] = true;
                else
                    $d['action_required'] = false;
            }
        } else if ($this->user->current_role->role == 'phd_coordinator') {
            if ($roll_no) {
                $data = Forms::where('phd_coordinator_available', true)->where('student_id', $roll_no)->where('department_id', $this->department_id)->get();
            } else {
                $data = Forms::where('phd_coordinator_available', true)->where('department_id', $this->department_id)->get();
            }

            foreach ($data as $d) {
                if ($d->stage == 'phd_coordinator')
                    $d['action_required'] = true;
                else
                    $d['action_required'] = false;
            }
        } else if ($this->user->current_role->role == 'hod') {
            if ($roll_no) {
                $data = Forms::where('hod_available', true)->where('department_id', $this->department_id)->where('student_id', $roll_no)->get();
            } else {
                $data = Forms::where('hod_available', true)->where('department_id', $this->department_id)->get();
            }
            foreach ($data as $d) {
                if ($d->stage == 'hod')
                    $d['action_required'] = true;
                else
                    $d['action_required'] = false;
            }
        }

        return $data;
    }
    public function irbCommittees()
    {
        return $this->morphMany(IRBCommittee::class, 'member');
    }
}

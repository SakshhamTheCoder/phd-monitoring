<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class Presentation extends Model
{
    use HasFactory;
    use ModelCommonFormFields;

    // The table associated with the model
    protected $table = 'presentations';

    // The primary key associated with the table
    protected $primaryKey = 'id';

    // Indicates if the IDs are auto-incrementing
    public $incrementing = true;

    // The attributes that are mass assignable
    protected $fillable;

    // The attributes that should be cast to native types
    protected $casts = [
        'teaching_work' => 'string',
        'overall_progress' => 'string',
        'progress' => 'integer',
        'current_progress' => 'integer',
        'total_progress' => 'integer',
        'contact_hours' => 'integer',
        'attendance' => 'float',
        'history' => 'array',
        'steps' => 'array',
        'leave' => 'boolean',
        'missed' => 'boolean',
    ];

    public function __construct(array $attributes = [])
    {
        // Merge common fields with specific fillable fields
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'date',
            'time',
            'venue',
            'period_of_report',
            'teaching_work',
            'presentation_pdf',
            'progress',
            'total_progress',
            'current_progress',
            'contact_hours',
            'attendance',
            'overall_progress',
            'semester_id',
            'leave',
            'missed',
            'ppt_file',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    public function fullForm($user)
    {
        // Use the common form data and merge with specific form data
        $commonJSON = $this->fullCommonForm($user);

        $publicationsQuery = Publication::where('student_id', $this->student_id)->where('form_type', 'progress')->where('form_id', $this->id);
        $patents = Patent::where('student_id', $this->student_id)->where('form_id', $this->id)->get();
        
        $formData = array_merge($commonJSON, [
            'doctoral_committee' => $this->student->doctoralCommittee->map(function ($committee) {
                $faculty=Faculty::where('faculty_code',$committee->faculty_code)->first();
                $user=User::where('id',$faculty->user_id)->first();
                return [
                    'name' => $user?->name(),
                    'department' => $faculty->department->name,
                    'designation' => $faculty->designation,
                ];
            }),
            'date' => $this->date,
            'time' => $this->time,
            'venue' => $this->venue,
            // The progress the evaluation started from. Once the supervisor has
            // submitted it is stored on the row; today's overall already includes
            // this evaluation's increase after DoRDC completes it, so reading that
            // showed "previous 60, increase 10, total 60".
            'current_progress' => $this->supervisor_lock ? $this->getAttribute('current_progress') : $this->student->overall_progress,
            'period_of_report' => $this->period_of_report,
            'extention_availed' => ResearchExtentions::where('student_id', $this->student_id)->count()>0?true:false,

            'teaching_work' => $this->teaching_work,
            'ppt_file' => $this->ppt_file,
            'progress' => $this->progress,
            'total_progress' => $this->total_progress,
            'contact_hours' => $this->contact_hours,
            'attendance' => $this->attendance,
          
            'overall_progress' => $this->overall_progress,
            'presentation_pdf' => $this->presentation_pdf,
            
            'supervisorReviews' => $this->supervisorReviews->map(function ($review) {
                return [
                    'faculty' => $review->faculty->user->name(),
                    'progress' => $review->progress,
                    'comments' => $review->comments,
                    'review_status' => $review->review_status,
                ];
            }),

            'doctoralCommitteeReviews' => $this->doctoralCommitteeReviews->map(function ($review) {
                return [
                    'faculty' => $review->faculty->user->name(),
                    'progress' => $review->progress,
                    'comments' => $review->comments,
                    'review_status' => $review->review_status,
                ];
            }),
            'publication_count'=> $publicationsQuery->clone()->count(),
            'sci' => $publicationsQuery->clone()->where('publication_type', 'journal')->where('type', 'sci')->get(),
            'non_sci' => $publicationsQuery->clone()->where('publication_type', 'journal')->where('type', 'non-sci')->get(),
            'national' => $publicationsQuery->clone()->where('publication_type', 'conference')->where('type', 'national')->get(),
            'international' => $publicationsQuery->clone()->where('publication_type', 'conference')->where('type', 'international')->get(),
            'book' => $publicationsQuery->clone()->where('publication_type', 'book')->get(),
            'patents' => $patents,
            

        ]);
        $extraData=[
            'no_paper_sci_journal'=>$formData['sci']->count(),
            'no_paper_scopus_journal'=>$formData['non_sci']->count(),
            'no_paper_conference'=>$formData['national']->count()+$formData['international']->count(),
            'no_paper_book'=>$formData['book']->count(),
            'no_patents'=>$formData['patents']->count(),
            'total_paper_sci_journal'=>Publication::where('student_id', $this->student_id)->where('publication_type', 'journal')->where('type', 'sci')->where('form_id',null)->count(),
        ];
        if($user->current_role->role==='student'){
            $publicationsQuery = Publication::where('student_id', $this->student_id)->where('form_id', null);
            $patents = Patent::where('student_id', $this->student_id)->where('form_id', null)->get();
            
            $ret = [
                'sci' => $publicationsQuery->clone()->where('publication_type', 'journal')->where('type', 'sci')->get(),
                'non_sci' => $publicationsQuery->clone()->where('publication_type', 'journal')->where('type', 'non-sci')->get(),
                'national' => $publicationsQuery->clone()->where('publication_type', 'conference')->where('type', 'national')->get(),
                'international' => $publicationsQuery->clone()->where('publication_type', 'conference')->where('type', 'international')->get(),
                'book' => $publicationsQuery->clone()->where('publication_type', 'book')->get(),
                'patents' => $patents
            ];
            $extraData['student_publications']=$ret;
        }

        $formData=array_merge($formData,$extraData);
        $fac_id=$user->faculty?->faculty_code;

        if($this->student->checkDoctoralCommittee($fac_id)){
            $formData['current_review'] = $this->doctoralCommitteeReviews->where('faculty_id', $fac_id)->first();
        }
        if($this->student->checkSupervises($fac_id)){
            $formData['current_review'] = $this->supervisorReviews->where('faculty_id', $fac_id)->first();
        }

        return $formData;
    }

    public function supervisorReviews()
    {
        return $this->hasMany(PresentationReview::class, 'presentation_id', 'id')->where('is_supervisor', 1);
    }

    public function doctoralCommitteeReviews()
    {
        return $this->hasMany(PresentationReview::class, 'presentation_id', 'id')->where('is_supervisor', 0);
    }
    public function semester()
{
    return $this->belongsTo(Semester::class);
}

public function student()
{
    return $this->belongsTo(Student::class, 'student_id', 'roll_no');
}

    
}

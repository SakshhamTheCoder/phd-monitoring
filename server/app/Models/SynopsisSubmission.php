<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class SynopsisSubmission extends Model
{
    use HasFactory, ModelCommonFormFields;

    protected $table = 'synopsis_submissions';
    protected $fillable;

    protected $casts = [
        'history' => 'array',
        'steps' => 'array',
    ];

    public function __construct(array $attributes = [])
    {
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'current_progress',
            'revised_title',
            'synopsis_pdf',
            'total_progress',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    /**
     * Get the full form data including common fields.
     */
    public function fullForm($user)
    {
         $publicationsQuery = Publication::where('student_id', $this->student_id)->where('form_type', 'synopsis')->where('form_id', $this->id);
        $patents = Patent::where('student_id', $this->student_id)->where('form_type', 'synopsis')->where('form_id', $this->id)->get();
        $commonJSON = $this->fullCommonForm($user);
         $formData=array_merge($commonJSON, [
            'current_progress' => $this->current_progress,
            'revised_title' => $this->revised_title,
            'synopsis_pdf' => $this->synopsis_pdf,
            'total_progress' => $this->total_progress,
            'previous_progress'=>$this->student->overall_progress,
            'sci' => $publicationsQuery->clone()->where('publication_type', 'journal')->where('type', 'sci')->get(),
            'non_sci' => $publicationsQuery->clone()->where('publication_type', 'journal')->where('type', 'non-sci')->get(),
            'national' => $publicationsQuery->clone()->where('publication_type', 'conference')->where('type', 'national')->get(),
            'international' => $publicationsQuery->clone()->where('publication_type', 'conference')->where('type', 'international')->get(),
            'book' => $publicationsQuery->clone()->where('publication_type', 'book')->get(),
            'patents' => $patents,
            'revised_objectives' => $this->objectives->map(function ($objective) {
                return $objective->objective;
            }),
            'objectives' => $this->student->objectives()?->where('type', 'revised')->get()->map(function ($objective) {
                return $objective->objective;
            })->values(),
            'fathers_name'=>$this->student->fathers_name,
            'date_of_irb'=>$this->student->date_of_irb,
            'current_status'=>$this->student->current_status,
            'address'=>$this->student->user->address,

        ]);
        $extraData=[];
        if($user->current_role->role==='student'){
            $publicationsQuery = Publication::where('student_id', $this->student_id)->where('form_id', null);
            $patents = Patent::where('student_id', $this->student_id)->where('form_id', null)->get();
            
            $ret = [
                'sci' => $publicationsQuery->clone()->where('type', 'sci')->get(),
                'non_sci' => $publicationsQuery->clone()->where('type', 'non-sci')->get(),
                'patents' => $patents
            ];
            $extraData['student_publications']=$ret;
        }
        $formData=array_merge($formData,$extraData);

        return $formData;
    }

    public function objectives()
    {
        return $this->hasMany(SynopsisObjectives::class, 'synopsis_id', 'id');
    }

    public function publications()
    {
        return $this->hasMany(Publication::class, 'form_id')->where('form_type', 'synopsis');
    }
    public function patents()
    {
        return $this->hasMany(Patent::class, 'form_id')->where('form_type', 'synopsis');
    }

}

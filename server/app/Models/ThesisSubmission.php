<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class ThesisSubmission extends Model
{
    use HasFactory, ModelCommonFormFields;

    protected $table = 'thesis_submissions';
    protected $fillable;

    protected $casts = [
        'history' => 'array',
        'steps' => 'array',
        'carried_over_at' => 'datetime',
    ];

    public function __construct(array $attributes = [])
    {
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'date_of_synopsis',
            'reciept_no',
            'date_of_fee_submission',
            'thesis_pdf',
            'fee_receipt',
            'carried_over_at',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    /**
     * Get the full form data including common fields.
     */
    public function fullForm($user)
    {
        $commonJSON = $this->fullCommonForm($user);
        $prev=$this->student->thesisExtentions;
        $prev_date=count($prev)>0?$prev[count($prev)-1]->created_at:'NA';
        $publicationsQuery = Publication::where('student_id', $this->student_id)->where('form_type', 'thesis')->where('form_id', $this->id);
        $patents = Patent::where('student_id', $this->student_id)->where('form_type', 'thesis')->where('form_id', $this->id)->get();
 
        $formData= array_merge($commonJSON, [
            // The form's own date wins; the scholar's is the fallback. A second
            // key further down used to overwrite this one.
            'date_of_synopsis' => $this->date_of_synopsis ?? $this->student->date_of_synopsis,
            'reciept_no' => $this->reciept_no,
            'date_of_fee_submission' => $this->date_of_fee_submission,
            'fee_receipt' => $this->fee_receipt,
            'thesis_pdf' => $this->thesis_pdf,
            'fathers_name'=>$this->student->fathers_name,
            'current_status'=>$this->student->current_status,
            'address'=>$this->student->user->address,
            'initial_status'=>$this->student->initialStatus(),
            'date_of_irb'=>$this->student->date_of_irb,
            'previous_extension_date'=>$prev_date,
            'sci' => $publicationsQuery->clone()->where('publication_type', 'journal')->where('type', 'sci')->get(),
            'non_sci' => $publicationsQuery->clone()->where('publication_type', 'journal')->where('type', 'non-sci')->get(),
            'national' => $publicationsQuery->clone()->where('publication_type', 'conference')->where('type', 'national')->get(),
            'international' => $publicationsQuery->clone()->where('publication_type', 'conference')->where('type', 'international')->get(),
            'book' => $publicationsQuery->clone()->where('publication_type', 'book')->get(),
            'patents' => $patents,
           

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

    public function publications()
    {
        return $this->hasMany(Publication::class, 'form_id')->where('form_type', 'thesis');
    }
    

    public function patents()
    {
        return $this->hasMany(Patent::class, 'form_id')->where('form_type', 'thesis');
    }
    
}

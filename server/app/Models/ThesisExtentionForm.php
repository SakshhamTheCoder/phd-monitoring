<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class ThesisExtentionForm extends Model
{
    use HasFactory, ModelCommonFormFields;

    protected $table = 'thesis_extentions_form';

    protected $fillable;

    protected $casts = [
        'history' => 'array',
        'steps' => 'array',
    ];

    public function __construct(array $attributes = [])
    {
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'previous_extention_pdf',
            'period_of_extention',
            'reason',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    /**
     * Get the full form data including common fields.
     */
    public function fullForm($user)
    {
        $commonJSON = $this->fullCommonForm($user);
        return array_merge($commonJSON, [
            'previous_extention_pdf' => $this->previous_extention_pdf,
            'period_of_extention' => $this->period_of_extention,
            'reason' => $this->reason,
            'initial_status'=>$this->student->initialStatus(),
            'date_of_irb'=>$this->student->date_of_irb,
            'date_of_synopsis'=>$this->student->date_of_synopsis,
            'previous_extensions' => $this->student->thesisExtentions->map(function($extention){
                return [
                    'period_of_extention' => $extention->period_of_extention,
                    'reason' => $extention->reason,
                ];
            }),
            // No grant-date column exists; created_at stands in for it.
            'date_of_extention' => optional($this->student->thesisExtentions->first())->created_at,
        ]);
    }

}

<?php

namespace App\Models;

use App\Forms\IrbExtensionDefinition;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class ResearchExtentionsForm extends Model
{
    use HasFactory, ModelCommonFormFields;

    protected $table = 'research_extentions_form';
    protected $fillable;

    protected $casts = [
        'history' => 'array',
        'steps' => 'array',
    ];

    public function __construct(array $attributes = [])
    {
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'period_of_extention',
            'research_pdf',
            'reason',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    public function fullForm($user)
    {
        $commonJSON = $this->fullCommonForm($user);
        $data = array_merge($commonJSON, [
            'period_of_extension' => $this->period_of_extention,
            'research_pdf' => $this->research_pdf,
            'initial_status'=>$this->student->initialStatus(),
            'reason'=>$this->reason,
            'researchExtentions' => $this->student->researchExtentions->map(function($extention){
                return [
                    'period_of_extension' => $extention->period_of_extension,
                    'reason' => $extention->reason,
                ];
            }),
        ]);
        $data['view'] = (new IrbExtensionDefinition)->view($data);
        return $data;
    }
}

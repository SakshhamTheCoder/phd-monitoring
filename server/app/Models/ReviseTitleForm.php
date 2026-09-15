<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class ReviseTitleForm extends Model
{
    use HasFactory, ModelCommonFormFields;

    protected $table = 'table_revise_title_form';
    protected $fillable;

    protected $casts = [
        'history' => 'array',
        'steps' => 'array',
        'current_objectives' => 'array',
        'proposed_objectives' => 'array',
    ];

    public function __construct(array $attributes = [])
    {
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'current_title',
            'proposed_title',
            'justification',
            'current_objectives',
            'proposed_objectives',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    public function fullForm($user)
    {
        $commonJSON = $this->fullCommonForm($user);
        return array_merge($commonJSON, [
            'current_title' => $this->current_title,
            'proposed_title' => $this->proposed_title,
            'justification' => $this->justification,
            'current_objectives' => $this->current_objectives,
            'proposed_objectives' => $this->proposed_objectives,
        ]);
    }
}

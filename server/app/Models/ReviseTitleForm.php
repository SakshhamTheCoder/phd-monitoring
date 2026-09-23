<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class ReviseTitleForm extends Model
{
    use HasFactory, ModelCommonFormFields;

    protected $table = 'revise_title_forms';
    protected $fillable;

    protected $casts = [
        'history' => 'array',
        'steps' => 'array',
        'revised_objectives' => 'array',
    ];

    public function __construct(array $attributes = [])
    {
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'revised_title',
            'revised_objectives',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    public function fullForm($user)
    {
        return array_merge($this->fullCommonForm($user), [
            'revised_title' => $this->revised_title,
            'revised_objectives' => $this->revised_objectives ?? [],
            // What the revision replaces: the objectives the IRB submission
            // recorded. phd_title comes with the common fields.
            'objectives' => $this->student->objectives()->where('type', 'revised')->pluck('objective')->values(),
            'date_of_irb' => $this->student->date_of_irb?->toDateString(),
            'current_status' => $this->student->current_status,
            'address' => $this->student->user->address,
        ]);
    }
}

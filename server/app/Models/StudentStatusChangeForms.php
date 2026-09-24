<?php

namespace App\Models;

use App\Forms\StatusChangeDefinition;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class StudentStatusChangeForms extends Model
{
    use HasFactory, ModelCommonFormFields;

    protected $table = 'student_status_change_forms';
    protected $fillable;

    protected $casts = [
        'history' => 'array', 
        'steps' => 'array',
    ];

    public function __construct(array $attributes = [])
    {
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'reason',
            'type_of_change',
             // Specific to StudentStatusChangeForms
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    public function fullForm($user)
    {
        $commonJSON = $this->fullCommonForm($user);
        $data = array_merge($commonJSON, [
            'reason' => $this->reason, // Include specific attributes
            'type_of_change' => $this->type_of_change,
            'initial_status'=>$this->student->initialStatus(),
            // ->get(), not the relation, which serialises to {}. created_at is
            // hidden on the model but the student form shows it as the date of
            // the last change.
            'previous_changes'=>$this->student->statusChanges()->orderBy('created_at')->get()->makeVisible('created_at'),
            'date_of_irb'=>$this->student->date_of_irb
        ]);
        $data['view'] = (new StatusChangeDefinition)->view($data);
        return $data;
    }

}

<?php

namespace App\Models;

use App\Forms\SupervisorChangeDefinition;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class SupervisorChangeForm extends Model
{
    use HasFactory, ModelCommonFormFields;

    // The table associated with the model
    protected $table = 'supervisor_change_forms';

    // The primary key associated with the table
    protected $primaryKey = 'id';

    // Indicates if the IDs are auto-incrementing
    public $incrementing = true;

    // The attributes that are mass assignable
    protected $fillable;

    // The attributes that should be cast to native types
    protected $casts = [
        'to_change' => 'array',
        'prefrences' => 'array',
        'current_supervisors' => 'array',
        'new_supervisors' => 'array',
        'steps' => 'array',
        'history' => 'array', // Ensure history is treated as an array
    ];

    public function __construct(array $attributes = [])
    {
        // Merge common fields with specific fillable fields
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'reason',
            'to_change',
            'prefrences',
            'current_supervisors',
            'new_supervisors',
            'irb_submitted',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    public function fullForm($user)
    {
        // Use the common form data and merge with specific form data
        $commonJSON = $this->fullCommonForm($user);
        $formData = array_merge($commonJSON, [
            'reason' => $this->reason,
            'to_change' => collect($this->to_change)->map(function ($supervisor) {
                $faculty = Faculty::where('faculty_code', $supervisor)->first();
                return [
                    'name' => $faculty?->user->name(),
                    'designation' => $faculty?->designation,
                    'department' => $faculty?->department->name,
                    // The form seeds a resubmission from these codes.
                    'faculty_code' => $supervisor,
                ];
                }),
            'prefrences' => collect($this->prefrences)->map(function ($preference) {
            $faculty = Faculty::where('faculty_code', $preference)->first();
            if(!$faculty){
                return null;
            }
            return [
                'name' => $faculty->user->name(),
                'designation' => $faculty->designation,
                'department' => $faculty->department->name,
                'faculty_code' => $preference,
            ];
            }),
            'current_supervisors' => collect($this->current_supervisors)->map(function ($supervisor) {
            $faculty = Faculty::where('faculty_code', $supervisor)->first();
            return [
                'name' => $faculty?->user->name(),
                'designation' => $faculty?->designation,
                'department' => $faculty?->department->name,
            ];
            }),
            'new_supervisors' => collect($this->new_supervisors)->map(function ($supervisor) {
            $faculty = Faculty::where('faculty_code', $supervisor)->first();
            return [
                'name' => $faculty->user->name(),
                'designation' => $faculty->designation,
                'department' => $faculty->department->name,
                'faculty_code' => $supervisor,
            ];
            }),
            'irb_submitted' => $this->irb_submitted,
            'date_of_allocation'=>Supervisor::where('student_id',$this->student->roll_no)->first()->updated_at
        ]);
        $formData['supervisors'] = $this->student->supervisors->map(function ($supervisor) {
            return [
                'name' => $supervisor->user->name(),
                'designation' => $supervisor->designation,
                'department' => $supervisor->department->name,
                'faculty_code' => $supervisor->faculty_code,
            ];
        });
        $formData['view'] = (new SupervisorChangeDefinition)->view($formData);

        return $formData;
    
 }
}
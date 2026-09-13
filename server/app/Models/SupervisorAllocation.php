<?php


namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class SupervisorAllocation extends Model
{
    use HasFactory, ModelCommonFormFields;
    
        protected $table = 'supervisor_allocation_form';
        protected $fillable;
    
        protected $casts = [
            'history' => 'array', 
            'steps' => 'array',
            'prefrences' => 'array',
            'supervisors' => 'array',
        ];
    
        public function __construct(array $attributes = [])
        {
            $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
            $this->fillable = array_merge([
                'prefrences',
                'supervisors',
            ], $commonFieldKeys);
    
            parent::__construct($attributes);
        }
    
        public function fullForm($user)
        {
            $commonJSON = $this->fullCommonForm($user);
            return array_merge($commonJSON, [
                'broad_area_of_research' => $this->student->areaPreferences->pluck('broad_area'),
                'prefrences' => collect($this->prefrences)->map(function ($prefrence) {
                    $faculty = Faculty::where('faculty_code', $prefrence)->first();
                    return [
                        'name' => $faculty->user->name(),
                        'designation' => $faculty->designation,
                        'department' => $faculty->department->name,
                        'faculty_code' => $faculty->faculty_code,
                        'email' => $faculty->user->email,
                    ];
                }),                
                'supervisors' => collect($this->supervisors)->map(function ($supervisor) {
                    $faculty = Faculty::where('faculty_code', $supervisor)->first();
                    return [
                        'name' => $faculty->user->name(),
                        'designation' => $faculty->designation,
                        'department' => $faculty->department->name,
                        'faculty_code' => $faculty->faculty_code,
                        'supervised_campus' => $faculty->supervised_campus,
                        'supervised_outside' => $faculty->supervised_outside,
                    ];
                }),
            ]);
        }
        
}

    

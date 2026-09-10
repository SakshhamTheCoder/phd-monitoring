<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class ListOfExaminersForm extends Model
{
    use HasFactory;
    use ModelCommonFormFields;

    // The table associated with the model
    protected $table = 'list_of_examiners_forms';

    // The primary key associated with the table
    protected $primaryKey = 'id';

    // Indicates if the IDs are auto-incrementing
    public $incrementing = true;

    // The attributes that are mass assignable
    protected $fillable;

    // The attributes that should be cast to native types
    protected $casts = [
        'status' => 'string',
        'history' => 'array', // Ensure history is treated as an array
        'steps' => 'array',
    ];

    public function __construct(array $attributes = [])
    {
        // Merge common fields with specific fillable fields
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'status',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    public function fullForm($user)
    {
        // Use the common form data and merge with specific form data
        $commonJSON = $this->fullCommonForm($user);
        return array_merge($commonJSON, [
            'status' => $this->status,
            'history' => $this->history,
            // Flattened, not the raw rows: the screens read an examiner's name
            // and email off the row itself, and moving those to the directory
            // must not change what the form hands them.
            'national' => $this->nationalExaminersRecommendations->map->toFormRow()->values(),
            'international' => $this->internationalExaminersRecommendations->map->toFormRow()->values(),
        ]);
    }
    public function nationalExaminersRecommendations()
    {
        return $this->hasMany(ExaminersRecommendation::class, 'form_id', 'id')
            ->with('examiner')
            ->where('type', 'national');
    }
    public function internationalExaminersRecommendations()
    {
        return $this->hasMany(ExaminersRecommendation::class, 'form_id', 'id')
            ->with('examiner')
            ->where('type', 'international');
    }

    public function examinersRecommendations()
    {
        return $this->hasMany(ExaminersRecommendation::class, 'form_id', 'id');
    }
}

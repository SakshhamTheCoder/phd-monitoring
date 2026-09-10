<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExaminersRecommendation extends Model
{
    use HasFactory;

    // The table associated with the model
    protected $table = 'examiners_recommendation';

    // The primary key associated with the table
    protected $primaryKey = 'id';

    // Indicates if the IDs are auto-incrementing
    public $incrementing = true;

    // What belongs to one form: which examiner, which list, and the verdict.
    // Who the examiner is lives on the Examiner they point at.
    protected $fillable = [
        'form_id',
        'examiner_id',
        'type',
        'comment',
        'faculty_id',
        'recommendation',
    ];

    // The attributes that should be cast to native types
    protected $casts = [
        'recommendation' => 'string',
    ];

    public function examiner()
    {
        return $this->belongsTo(Examiner::class, 'examiner_id', 'id');
    }

    /**
     * This recommendation as the form screens read it: the person's details
     * alongside the verdict, which is the shape the tables were always given.
     */
    public function toFormRow(): array
    {
        return [
            'id' => $this->id,
            'examiner_id' => $this->examiner_id,
            'name' => $this->examiner?->name,
            'email' => $this->examiner?->email,
            'institution' => $this->examiner?->institution,
            'designation' => $this->examiner?->designation,
            'department' => $this->examiner?->department,
            'phone' => $this->examiner?->phone,
            'type' => $this->type,
            'recommendation' => $this->recommendation,
            'comment' => $this->comment,
        ];
    }

    public function listOfExaminers()
    {
        return $this->belongsTo(ListOfExaminersForm::class, 'form_id', 'id');
    }

    public function faculty()
    {
        return $this->belongsTo(Faculty::class, 'faculty_id', 'faculty_code');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Patent extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'student_id',
        'form_id',
        'form_type',
        'title',
        'patent_number',
        'first_page',
        'authors',
        'year',
        'doi_link',
        'status',
        'country',
    ];
    protected $table = 'patents';
    /**
     * The attributes that should be cast to native types.
     *
     * @var array
     */
    protected $casts = [
        
    ];

    /**
     * The attributes that should be hidden for arrays.
     *
     * @var array
     */
    protected $hidden = [
        'created_at',
        'updated_at',
    ];

    /**
     * Get the student associated with the patent.
     */
    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'roll_no');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentSubdomain extends Model
{
    use HasFactory;

    protected $table = 'student_subdomains';

    protected $fillable = [
        'student_id',
        'keyword',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'roll_no');
    }
}

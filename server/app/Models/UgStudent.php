<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A UG student's own details, asked for once at sign-up. */
class UgStudent extends Model
{
    protected $fillable = ['roll_no', 'department_id', 'year'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }
}

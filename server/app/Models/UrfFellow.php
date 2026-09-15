<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A selected student's details for the stipend, one row per student. */
class UrfFellow extends Model
{
    protected $fillable = [
        'full_name', 'dob', 'gender', 'father_name', 'pan', 'aadhaar', 'bank_name', 'account_no', 'ifsc',
    ];

    protected $casts = [
        'dob' => 'date:Y-m-d',
        'pan' => 'encrypted',
        'aadhaar' => 'encrypted',
        'account_no' => 'encrypted',
    ];

    public function application()
    {
        return $this->belongsTo(UrfApplication::class, 'urf_application_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

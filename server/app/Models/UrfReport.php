<?php

namespace App\Models;

use App\Models\Concerns\UrfApprovable;
use Illuminate\Database\Eloquent\Model;

/** A half-yearly progress report or the final report of a URF project. */
class UrfReport extends Model
{
    use UrfApprovable;

    protected $fillable = ['type', 'conference_presentation', 'report'];

    protected $casts = ['history' => 'array'];

    public function approvalApplication()
    {
        return $this->application;
    }

    public function application()
    {
        return $this->belongsTo(UrfApplication::class, 'urf_application_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

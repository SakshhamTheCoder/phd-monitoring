<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A half-yearly progress report or the final report of a URF project. */
class UrfReport extends Model
{
    protected $fillable = ['type', 'conference_presentation', 'report'];

    public function application()
    {
        return $this->belongsTo(UrfApplication::class, 'urf_application_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

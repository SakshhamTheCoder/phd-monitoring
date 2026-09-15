<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A half-yearly progress report or the final report of a URF project. */
class UrfReport extends Model
{
    protected $fillable = ['type', 'conference_presentation', 'report'];
}

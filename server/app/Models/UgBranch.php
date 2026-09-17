<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Several branches can be taught by one department, which is why this is not it. */
class UgBranch extends Model
{
    protected $fillable = ['programme', 'code', 'name', 'department_id'];

    public function scopeOrdered($query)
    {
        return $query->orderBy('programme')->orderBy('name');
    }

    /** Which ADORDC reads the URF forms of students on this branch. */
    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function students()
    {
        return $this->hasMany(UgStudent::class, 'branch_id');
    }
}

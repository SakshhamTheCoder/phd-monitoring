<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A branch of an undergraduate degree: Computer Engineering under BE, say.
 * Several branches can be taught by one department, which is why this is not
 * the departments table.
 */
class UgBranch extends Model
{
    protected $fillable = ['programme', 'code', 'name'];

    /** Branches as the dropdowns want them: by programme, then by name. */
    public function scopeOrdered($query)
    {
        return $query->orderBy('programme')->orderBy('name');
    }

    public function students()
    {
        return $this->hasMany(UgStudent::class, 'branch_id');
    }
}

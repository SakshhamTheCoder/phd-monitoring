<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * An external examiner, once, shared by every form that proposes them.
 *
 * Email is the identity. A supervisor adding someone from inside a form goes
 * through here, so the directory grows from ordinary use rather than needing
 * to be filled in before anyone can work.
 */
class Examiner extends Model
{
    use HasFactory;

    protected $table = 'examiners';

    protected $fillable = [
        'name',
        'email',
        'institution',
        'designation',
        'department',
        'phone',
    ];

    /**
     * The directory entry for this person, created if they are new.
     *
     * Matching is on the email alone: it is what a supervisor searches by and
     * what any imported list is keyed on. Details from a later proposal fill
     * gaps but do not overwrite what is already recorded, so one hurried entry
     * cannot undo a corrected one.
     */
    public static function fromDetails(array $details): self
    {
        $email = strtolower(trim((string) ($details['email'] ?? '')));

        $examiner = static::where('email', $email)->first();
        if (!$examiner) {
            return static::create([
                'name' => $details['name'],
                'email' => $email,
                'institution' => $details['institution'],
                'designation' => $details['designation'],
                'department' => $details['department'],
                'phone' => $details['phone'] ?? null,
            ]);
        }

        $filled = [];
        foreach (['name', 'institution', 'designation', 'department', 'phone'] as $field) {
            if (blank($examiner->$field) && filled($details[$field] ?? null)) {
                $filled[$field] = $details[$field];
            }
        }
        if ($filled) {
            $examiner->update($filled);
        }

        return $examiner;
    }

    public function recommendations()
    {
        return $this->hasMany(ExaminersRecommendation::class, 'examiner_id', 'id');
    }
}

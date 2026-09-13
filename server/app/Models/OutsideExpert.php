<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OutsideExpert extends Model
{
    use HasFactory;

    protected $table = 'outside_experts';

    protected $fillable = [
        'first_name',
        'last_name',
        'designation',
        'department',
        'institution',
        'email',
        'phone',
        'area_of_expertise',
        'website',
    ];

    public function irbOutsideExperts()
    {
        return $this->hasMany(IrbOutsideExpert::class, 'expert_id');
    }

    public function irbCommittees()
{
    return $this->morphMany(IRBCommittee::class, 'member');
}

    /**
     * The expert's faculty record, created on first use.
     *
     * An expert has to exist as a faculty row before they can sit on a doctoral
     * committee, but they are not staff: they never belong to a department, and
     * they reach their reviews through a signed link rather than by logging in.
     *
     * The password is therefore random and never shown to anyone. It used to be
     * one of two shared literals, and the role used to be a hardcoded id, which
     * on this install is the admin row. Both are resolved properly here.
     */
    public function getFaculty()
    {
        $user = \App\Models\User::where('email', $this->email)->first();

        if ($user && $user->faculty) {
            return $user->faculty;
        }

        if (!$user) {
            $roleId = \App\Models\Role::where('role', 'external')->value('id');

            $user = \App\Models\User::create([
                'first_name' => $this->first_name,
                'last_name' => $this->last_name,
                'email' => $this->email,
                'phone' => $this->phone,
                'password' => bcrypt(\Illuminate\Support\Str::password(24)),
                'role_id' => $roleId,
                'current_role_id' => $roleId,
                'default_role_id' => $roleId,
                'status' => 'active',
            ]);
        }

        // The 777 prefix marks a faculty code that no employee id will collide
        // with, since employee ids are assigned well below it.
        return \App\Models\Faculty::create([
            'user_id' => $user->id,
            'faculty_code' => '777' . str_pad($user->id, 6, '0', STR_PAD_LEFT),
            'designation' => $this->designation,
            'department_id' => null,
            'type' => 'external',
            'institution' => $this->institution,
            'website_link' => $this->website,
        ]);
    }
}

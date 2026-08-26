<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Notifications\CustomResetPassword;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'first_name',
        'last_name',
        'phone',
        'email',
        'gender',
        'role_id',
        'current_role_id',
        'default_role_id',
        'profile_picture',
        'address',
        'password',
        'email_verified_at',
        'first_activation',
        'available_roles',
        'status',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'email_verified_at',
        'created_at',
        'updated_at',
    ];

    protected $appends = ['name'];


    public function name()
    {
        return $this->first_name . ' ' . $this->last_name;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'available_roles' => 'array',
        ];
    }
    public function role()
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function current_role()
    {
        return $this->belongsTo(Role::class, 'current_role_id');
    }

    public function default_role()
    {
        return $this->belongsTo(Role::class, 'default_role_id');
    }

    public function student()
    {
        return $this->hasOne(Student::class, 'user_id');
    }

    public function faculty()
    {
        return $this->hasOne(Faculty::class, 'user_id');
    }

    /**
     * Departments this clerk has been tagged with. The linkage lives in its own
     * table (not a column) because a clerk can cover several departments, and it
     * is what authorizes every attendance action the role can take.
     */
    public function clerkDepartments()
    {
        return $this->hasMany(ClerkDepartment::class, 'user_id');
    }

    public function clerkDepartmentsList()
    {
        return $this->belongsToMany(Department::class, 'clerk_departments', 'user_id', 'department_id');
    }

    public function notifications()
    {
        return $this->hasMany(Notifications::class);
    }

    public function availableRoles()
    {
        $roles = [];
        if($this->available_roles){
            return $this->available_roles;
        }
        if ($this->role->role == 'student') {
            array_push($roles, 'student');
        }
        if ($this->role->role == 'faculty') {
            array_push($roles, 'doctoral');
            array_push($roles, 'faculty');
        }
        if ($this->role->role == 'phd_coordinator') {
            array_push($roles, 'doctoral');
            array_push($roles, 'faculty');
            array_push($roles, 'phd_coordinator');
        }
        if ($this->role->role == 'hod') {
            array_push($roles, 'doctoral');
            array_push($roles, 'faculty');
            array_push($roles, 'hod');
        }
        if ($this->role->role == 'external') {
            array_push($roles, 'doctoral');
            array_push($roles, 'external');
        }
        if ($this->role->role == 'dra') {
             array_push($roles, 'doctoral');
            array_push($roles, 'faculty');
            array_push($roles, 'dra');
        }
        if ($this->role->role == 'clerk') {
            array_push($roles, 'clerk');
        }
        if ($this->role->role == 'dordc') {
             array_push($roles, 'doctoral');
            array_push($roles, 'faculty');
            array_push($roles, 'dordc');
        }
        if ($this->role->role == 'adordc') {
             array_push($roles, 'doctoral');
            array_push($roles, 'faculty');
            array_push($roles, 'adordc');
        }
        if ($this->role->role == 'director') {
            array_push($roles, 'director');
        }
        $this->available_roles=$roles;
        $this->save();
        return $roles;
    }

    public function isAuthorized($role)
    {
        $roles = $this->availableRoles();
        return in_array($role, $roles);
    }
    public function getNameAttribute()
    {
        return "{$this->first_name} {$this->last_name}";
    }

    /**
     * Send the password reset notification.
     *
     * @param  string  $token
     * @return void
     */
    public function sendPasswordResetNotification($token)
    {
        $this->notify(new CustomResetPassword($token));
    }
}

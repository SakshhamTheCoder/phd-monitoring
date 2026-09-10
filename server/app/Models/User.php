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
        'physically_handicapped',
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
            'physically_handicapped' => 'boolean',
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

    /**
     * Roles a base role carries with it. The faculty-shaped roles all keep
     * 'faculty' and 'doctoral', because holding one does not stop you being
     * somebody's supervisor or sitting on their committee, and the form chains
     * have steps for both.
     */
    private const ROLE_GRANTS = [
        'student' => ['student'],
        'clerk' => ['clerk'],
        'faculty' => ['doctoral', 'faculty'],
        'phd_coordinator' => ['doctoral', 'faculty', 'phd_coordinator'],
        'hod' => ['doctoral', 'faculty', 'hod'],
        'external' => ['doctoral', 'external'],
        'dra' => ['doctoral', 'faculty', 'dra'],
        'dordc' => ['doctoral', 'faculty', 'dordc'],
        'adordc' => ['doctoral', 'faculty', 'adordc'],
        'director' => ['director'],
    ];

    /**
     * Every role this user may switch into.
     *
     * `available_roles` is an admin override, not a cache. It used to be both:
     * the derived list was written back to the column on first read and then
     * returned verbatim forever, so changing a user's role_id afterwards left
     * them unable to switch into the role they had just been given. Deriving
     * every time and merging the override fixes that, and costs one array
     * lookup.
     *
     * The base role is always included: it is what the account is, so being
     * unable to switch back to it is never intended.
     */
    public function availableRoles(): array
    {
        $base = $this->role?->role;
        $derived = self::ROLE_GRANTS[$base] ?? array_filter([$base]);
        $override = is_array($this->available_roles) ? $this->available_roles : [];

        return array_values(array_unique(array_merge($override, $derived)));
    }

    /**
     * Whether the role being acted as holds a capability, e.g.
     * $user->may('can_mark_attendance').
     *
     * Reads current_role, not role: a permission follows who you are acting as.
     * The columns are enum('true','false'), so an unknown or missing value is
     * not 'true' and the check fails closed.
     */
    public function may(string $capability): bool
    {
        return ($this->current_role?->{$capability} ?? null) === 'true';
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

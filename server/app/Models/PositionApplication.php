<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PositionApplication extends Model {
    use HasFactory;
    protected $table = 'position_applications';
    protected $fillable = ['position_id','project_id','student_id','name','email','phone','degree','institute','cgpa','research','skills','cover_note','resume_path','status','applied_date'];
    protected $casts = ['skills' => 'array'];
    protected $hidden = ['created_at','updated_at'];
    public function position() { return $this->belongsTo(ProjectPosition::class, 'position_id'); }
    public function student() { return $this->belongsTo(Student::class, 'student_id', 'roll_no'); }
}

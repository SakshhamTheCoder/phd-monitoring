<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectMilestone extends Model {
    use HasFactory;
    protected $table = 'project_milestones';
    protected $fillable = ['project_id','name','deliverable','due_date','status'];
    protected $hidden = ['created_at','updated_at'];
    public function project() { return $this->belongsTo(Project::class, 'project_id'); }
}

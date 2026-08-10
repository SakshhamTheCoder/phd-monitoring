<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectPosition extends Model {
    use HasFactory;
    protected $table = 'project_positions';
    protected $fillable = ['project_id','type','title','openings','status','stipend','deadline','eligibility','skills','min_cgpa','description','advertisement_path'];
    protected $casts = ['openings' => 'integer'];
    protected $hidden = ['created_at','updated_at'];
    public function project() { return $this->belongsTo(Project::class, 'project_id'); }
    public function applications() { return $this->hasMany(PositionApplication::class, 'position_id'); }
}

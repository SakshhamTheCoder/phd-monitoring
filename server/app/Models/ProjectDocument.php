<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectDocument extends Model {
    use HasFactory;
    protected $table = 'project_documents';
    protected $fillable = ['project_id','name','type','doc_date','file_path','link'];
    protected $hidden = ['created_at','updated_at'];
    public function project() { return $this->belongsTo(Project::class, 'project_id'); }
}

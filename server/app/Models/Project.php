<?php
namespace App\Models;
use App\Support\ProjectBudget;
use App\Support\ProjectObjectives;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Project extends Model {
    use HasFactory;
    protected $table = 'projects';
    protected $fillable = [
        'pi_faculty_code','title','category','funding_agency','amount','tiet_share','role','status',
        'start_date','end_date','duration_years','duration_months','description','focus_area','grant_type',
        'co_pis','objectives','budget','equipment_details','sanction_letter_link','sanction_letter_name',
        'sdgs','gantt_chart_path','gantt_chart_name',
    ];
    protected $casts = [
        'co_pis' => 'array', 'equipment_details' => 'array', 'sdgs' => 'array',
        'amount' => 'integer', 'tiet_share' => 'integer',
    ];
    protected $hidden = ['created_at','updated_at'];

    public function pi() { return $this->belongsTo(Faculty::class, 'pi_faculty_code', 'faculty_code'); }
    public function coPiFaculty() {
        return $this->belongsToMany(Faculty::class, 'project_co_pis', 'project_id', 'faculty_code', 'id', 'faculty_code');
    }
    public function milestones() { return $this->hasMany(ProjectMilestone::class, 'project_id'); }
    public function documents() { return $this->hasMany(ProjectDocument::class, 'project_id'); }
    public function positions() { return $this->hasMany(ProjectPosition::class, 'project_id'); }

    /**
     * Read forward. A project saved before the budget was restructured still
     * has to add up, so every read goes through the normalizer rather than
     * trusting whatever shape the column happens to hold.
     */
    public function getBudgetAttribute($value) {
        return ProjectBudget::normalize(is_string($value) ? json_decode($value, true) : $value);
    }

    public function getObjectivesAttribute($value) {
        return ProjectObjectives::normalize(is_string($value) ? json_decode($value, true) : $value);
    }

    public function setBudgetAttribute($value) {
        $this->attributes['budget'] = json_encode(ProjectBudget::normalize($value));
    }

    public function setObjectivesAttribute($value) {
        $this->attributes['objectives'] = json_encode(ProjectObjectives::normalize($value));
    }
}

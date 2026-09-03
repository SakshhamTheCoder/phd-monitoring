<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;


class ConstituteOfIRB extends Model
{
    use HasFactory;
    use ModelCommonFormFields;
    protected $table = 'constitute_of_irb';
    protected $fillable;

    protected $casts = [
        'history' => 'array',
        'steps' => 'array',
    ];

    public function __construct(array $attributes = [])
    {
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'cognate_expert',
            'outside_expert',
            'phd_title',
            'irb_pdf',
            'broad_area_of_research',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }


    public function fullForm($user)
    {
        $commonJSON = $this->fullCommonForm($user);
        return array_merge($commonJSON, [
            // Prefill from the student's profile title until this form carries its
            // own (i.e. before the student first submits it).
            'phd_title'=> $this->phd_title ?: $this->student->phd_title,
            'address' => $this->student->address,
            'objectives' => $this->student->objectives()?->where('type', 'draft')->get()->map(function ($objective) {
                return $objective->objective;
            })->values(),
            'subdomains' => $this->student->subdomains->pluck('keyword')->values(),
            'irb_pdf' => $this->irb_pdf,
            // Stored value may be a legacy AreaOfSpecialization id (numeric) or, for
            // newer forms, free text the student typed. If not yet set on form, prefill from tentative_broad_area.
            'broad_area_of_research' => is_numeric($this->broad_area_of_research)
                ? (AreaOfSpecialization::find($this->broad_area_of_research)?->name ?? $this->broad_area_of_research)
                : ($this->broad_area_of_research ?: $this->student->tentative_broad_area),
            'area_of_specialization' => $this->student->areaOfSpecialization ? [
                'id' => $this->student->areaOfSpecialization->id,
                'name' => $this->student->areaOfSpecialization->name,
            ] : null,
            'chairman' => ($this->student->department->hod && $this->student->department->hod->user) ? [
                'name' => $this->student->department->hod->user->name(),
                'designation' => $this->student->department->hod->designation,
                'department' => $this->student->department->name
            ] : null,
            'nominee_cognates' => $this->nomineeCognates->map(function ($nominee) {
                return [
                    'faculty_code' => $nominee->nominee->faculty_code,
                    'name' => $nominee->nominee->user->name(),
                    'designation' => $nominee->nominee->designation,
                    'department' => $nominee->nominee->department->name,
                ];
            }),
            'outside_experts' => $this->outsideExperts->map(function ($expert) {
                $expert = $expert->expert;
                return [
                    'id' => $expert->id,
                    'name' => $expert->first_name . ' ' . $expert->last_name,
                    'designation' => $expert->designation,
                    'department' => $expert->department,
                    'institution' => $expert->institution,
                    'email' => $expert->email,
                    'phone' => $expert->phone
                ];
            }),
            'chairman_experts' => $this->chairmanExperts?->map(function ($expert) {
                return [
                    'name' => $expert->expert->user->name(),
                    'designation' => $expert->expert->designation,
                    'department' => $expert->expert->department->name,
                    'faculty_code' => $expert->expert->user->faculty->faculty_code,
                ];
            }),
            'cognate_expert' => $this->expertCognate ? [
                'faculty_code' => $this->expertCognate->faculty_code,
                'name' => $this->expertCognate->user->name(),
            ] : null,
            'outside_expert' => $this->expertOutside ? [
                'id' => $this->expertOutside->id,
                'name' => $this->expertOutside->first_name . ' ' . $this->expertOutside->last_name,
                'designation' => $this->expertOutside->designation,
                'department' => $this->expertOutside->department,
                'institution' => $this->expertOutside->institution,
                'email' => $this->expertOutside->email,
                'phone' => $this->expertOutside->phone
            ] : null,

        ]);
    }

    public function nomineeCognates()
    {
        return $this->hasMany(IrbNomineeCognate::class, 'irb_form_id', 'id');
    }

    public function outsideExperts()
    {
        return $this->hasMany(IrbOutsideExpert::class, 'irb_form_id');
    }

    public function expertDepartments()
    {
        return $this->hasMany(IrbExpertDepartment::class, 'irb_form_id', 'id');
    }

    public function supervisorApprovals()
    {

        return $this->hasMany(ConstituteIrbSupervisorApproval::class, 'irb_cons_form_id', 'id');
    }

    public function chairmanExperts()
    {
        return $this->hasMany(IrbExpertChairman::class, 'irb_form_id', 'id');
    }

    public function expertCognate()
    {
        return $this->belongsTo(Faculty::class, 'cognate_expert', 'faculty_code');
    }

    public function expertOutside()
    {
        return $this->belongsTo(OutsideExpert::class, 'outside_expert', 'id');
    }
}

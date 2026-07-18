<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;
use Illuminate\Http\Request;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class IrbSubForm extends Model
{
    use HasFactory;
    use ModelCommonFormFields;
    use GeneralFormSubmitter;

    // The table associated with the model
    protected $table = 'irb_sub_forms';

    // The primary key associated with the table
    protected $primaryKey = 'id';

    // Indicates if the IDs are auto-incrementing
    public $incrementing = true;

    // The attributes that are mass assignable
    protected $fillable;

    // The attributes that should be cast to native types
    protected $casts = [
        'form_type' => 'string',
        'status' => 'string',
        'stage' => 'string',
        'steps' => 'array',
        'history' => 'array', // Ensure history is treated as an array
    ];

    public function __construct(array $attributes = [])
    {
        // Merge common fields with specific fillable fields
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([

            'revised_phd_title',
            'revised_irb_pdf',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    public function fullForm($user)
    {
        // Use the common form data and merge with specific form data
        $commonJSON = $this->fullCommonForm($user);
        $formData=array_merge($commonJSON, [
            'date_of_irb' => $this->student->date_of_irb,
            'revised_phd_title' => $this->revised_phd_title,
            'revised_irb_pdf' => $this->revised_irb_pdf,
            'revised_phd_objectives' => $this->student->objectives()?->where('type', 'revised')->get()->map(function ($objective) {
                return $objective->objective;
            })->values(),
            'supervisorApprovals' => $this->supervisorApprovals->map(function($approval){
                return [
                    'supervisor_id' => $approval->supervisor_id,
                    'status' => $approval->status,
                    'comments' => $approval->comments,
                    'name' => $approval->supervisor->user->name(),                
                ];
            }),
             'supervisorReviews' => $this->supervisorApprovals->map(function ($review) {
                return [
                    'faculty' => $review->supervisor->user->name(),
                    'progress' => $review->status,
                    'comments' => $review->comments,
                    'review_status' => $review->status,
                ];
            }),

           
        ]);
        $formData['supervisors']=$this->student->supervisors->map(function ($supervisor) {
            return [
                'name' => $supervisor->user->name(),
                'designation' => $supervisor->designation,
                'department' => $supervisor->department->name,
                'supervised_campus'=>$supervisor->supervised_campus+1,
                'supervised_outside'=>$supervisor->supervised_outside,
            ];
        });
        if($user->current_role->role==='faculty'){
            $currentSupervisor = $this->student->supervisors->where('faculty_code', $user->faculty->faculty_code)->first();
            if ($currentSupervisor) {
            $formData['current_supervisor'] = [
                'name' => $currentSupervisor->user->name(),
                'designation' => $currentSupervisor->designation,
                'department' => $currentSupervisor->department->name,
                'supervised_campus' => $currentSupervisor->supervised_campus,
                'supervised_outside' => $currentSupervisor->supervised_outside,
            ];
            }
        }
        return $formData;
    }


    public function supervisorApprovals()
    {
        return $this->hasMany(IrbSupervisorApproval::class, 'irb_sub_form_id', 'id');
    }

    public function doctoralApprovals()
    {
        return $this->hasMany(IrbDoctoralApproval::class, 'irb_sub_form_id', 'id');
    }

    /**
     * Record the outside expert's external-review decision.
     *
     * Attribution uses an in-memory (never-persisted) User built from the OutsideExpert
     * record, so no login-capable account is required or created. The comment is passed
     * as 'comments' (plural) to match what submitForm reads — the old code passed
     * 'comment' (singular), silently dropping it.
     */
    public function handleApproval($email, $id, $val, $comment = null)
    {
        $expert = OutsideExpert::where('email', $email)->first();

        $actor = new User();
        $actor->first_name = $expert->first_name ?? 'External';
        $actor->last_name = $expert->last_name ?? 'Reviewer';
        $actor->email = $email;
        $actor->setRelation('current_role', Role::where('role', 'external')->first());

        $request = Request::create('/', 'POST', [
            'approval' => $val,
            'comments' => $comment ?? ' ',
        ]);
        $model = IrbSubForm::class;
        Log::info('Handling external review for: ' . $email . ' (recommend=' . var_export($val, true) . ')');

        return $this->submitForm($actor, $request, $id, $model, 'external', 'faculty', 'doctoral', function ($formInstance) use ($request, $actor) {
            $doctoral = $formInstance->student->doctoralCommittee;
            foreach ($doctoral as $doc) {
                IrbDoctoralApproval::create([
                    'irb_sub_form_id' => $formInstance->id,
                    'doctoral_id' => $doc->faculty_code,
                    'status' => 'pending',
                ]);
            }
        });
    }

    /**
     * Create (or reuse) the outside expert's review token and email them a link to the
     * secure review page. One Approval row per (form, expert) — reused on resend and reset
     * to a fresh unconsumed state whenever the external step is (re)entered, so there are
     * no stale or duplicate tokens. Returns null if no outside expert is assigned.
     */
    public function sendExternalReviewRequest(): ?Approval
    {
        $expert = $this->student->outsideExpert();
        if (!$expert) {
            return null;
        }

        $approval = Approval::firstOrNew([
            'model_type' => static::class,
            'model_id' => $this->id,
            'email' => $expert->email,
        ]);
        if (!$approval->exists) {
            $approval->key = Approval::generateKey();
        }
        // Fresh review cycle: clear any prior response.
        $approval->action = 'review';
        $approval->approved = null;
        $approval->comment = null;
        $approval->consumed_at = null;
        $approval->save();

        $reviewUrl = rtrim(config('app.frontend_url'), '/') . '/external-review/' . $approval->key;
        $pdfPath = $this->revised_irb_pdf ? storage_path($this->revised_irb_pdf) : null;

        Mail::send('emails.approval', [
            'expertName' => trim($expert->first_name . ' ' . $expert->last_name),
            'studentName' => $this->student->user->name(),
            'title' => $this->revised_phd_title,
            'formId' => $this->id,
            'reviewUrl' => $reviewUrl,
        ], function ($message) use ($expert, $pdfPath) {
            $message->to($expert->email)->subject('IRB Submission Review Request');
            if ($pdfPath && file_exists($pdfPath)) {
                $message->attach($pdfPath);
            }
        });

        return $approval;
    }
}

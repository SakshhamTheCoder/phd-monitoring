<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\SaveFile;
use App\Models\PositionApplication;
use App\Models\ProjectPosition;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

/**
 * Openings as an outsider sees them. No account, no session: the payloads here
 * are written field by field rather than filtered, so nothing new on a project
 * or a position becomes public by being added.
 */
class PublicOpeningController extends Controller
{
    use SaveFile;

    public function index()
    {
        $positions = ProjectPosition::with('project.pi.user', 'project.pi.department')
            ->where('status', 'Open')
            ->where(fn ($q) => $q->whereNull('deadline')->orWhereDate('deadline', '>=', date('Y-m-d')))
            ->orderByDesc('id')
            ->get();

        return response()->json($positions->map(fn ($p) => $this->card($p))->values());
    }

    public function show($id)
    {
        $position = ProjectPosition::with('project.pi.user', 'project.pi.department')->find($id);
        if (!$position || !$this->isOpen($position)) {
            return response()->json(['message' => 'This opening is no longer available.'], 404);
        }

        $project = $position->project;

        return response()->json(array_merge($this->card($position), [
            'eligibility' => $position->eligibility,
            'skills' => $position->skills,
            'min_cgpa' => $position->min_cgpa,
            'description' => $position->description,
            'openings' => $position->openings,
            'advertisement_url' => $position->advertisement_path
                ? url('/api/public/openings/' . $position->id . '/advertisement')
                : null,
            'project' => $project ? [
                'title' => $project->title,
                'category' => $project->category,
                'focus_area' => $project->focus_area,
                'funding_agency' => $project->funding_agency,
                'description' => $project->description,
            ] : null,
        ]));
    }

    public function advertisement($id)
    {
        $position = ProjectPosition::find($id);
        if (!$position || !$this->isOpen($position) || !$position->advertisement_path) {
            return response()->json(['message' => 'Not found'], 404);
        }
        $path = storage_path($position->advertisement_path);
        if (!file_exists($path)) return response()->json(['message' => 'Not found'], 404);
        return response()->file($path);
    }

    public function apply(Request $request, $id)
    {
        $position = ProjectPosition::with('project')->find($id);
        if (!$position || !$this->isOpen($position)) {
            return response()->json(['message' => 'This opening is no longer accepting applications.'], 404);
        }

        // Bots fill every field they find; a person never sees this one.
        if ($request->filled('website')) {
            return response()->json(['message' => 'Application received.'], 201);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:191',
            'email' => 'required|email|max:191',
            'phone' => 'required|string|max:32',
            'degree' => 'required|string|max:191',
            'institute' => 'required|string|max:191',
            'cgpa' => 'required|string|max:16',
            'research' => 'nullable|string',
            'cover_note' => 'nullable|string',
            'resume' => 'required|file|mimes:pdf,doc,docx|max:15360',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);

        $email = strtolower(trim($request->input('email')));
        if (PositionApplication::where('position_id', $position->id)->where('email', $email)->exists()) {
            return response()->json(['message' => 'An application from this email already exists for this opening.'], 409);
        }

        $app = new PositionApplication();
        $app->token = PositionApplication::generateToken();
        $app->position_id = $position->id;
        $app->project_id = $position->project_id;
        $app->applicant_type = 'external';
        $app->email = $email;
        foreach (['name', 'phone', 'degree', 'institute', 'cgpa', 'research', 'cover_note'] as $field) {
            $app->$field = $request->input($field);
        }
        $skills = $request->input('skills');
        $app->skills = is_string($skills)
            ? array_values(array_filter(array_map('trim', explode(',', $skills))))
            : ($skills ?: []);
        $app->resume_path = $this->saveUploadedFile($request->file('resume'), 'project_resume', 'external');
        $app->status = 'Applied';
        $app->applied_date = date('Y-m-d');
        $app->save();

        $this->sendVerificationEmail($app, $position);

        return response()->json([
            'message' => 'Application received. Check your email to confirm it.',
            'token' => $app->token,
        ], 201);
    }

    public function verify($token)
    {
        $app = PositionApplication::where('token', $token)->first();
        if (!$app) return response()->json(['message' => 'This link is not valid.'], 404);
        if (!$app->email_verified_at) {
            $app->email_verified_at = now();
            $app->save();
        }
        return response()->json(['message' => 'Email confirmed.', 'status' => $app->status]);
    }

    public function status($token)
    {
        $app = PositionApplication::with('position:id,title,type,project_id', 'position.project:id,title')
            ->where('token', $token)->first();
        if (!$app) return response()->json(['message' => 'This link is not valid.'], 404);

        return response()->json([
            'name' => $app->name,
            'status' => $app->status,
            'applied_date' => $app->applied_date,
            'verified' => $app->email_verified_at !== null,
            'position_title' => optional($app->position)->title,
            'position_type' => optional($app->position)->type,
            'project_title' => optional(optional($app->position)->project)->title,
        ]);
    }

    private function isOpen(ProjectPosition $position)
    {
        if ($position->status !== 'Open') return false;
        return !$position->deadline || $position->deadline >= date('Y-m-d');
    }

    private function card(ProjectPosition $position)
    {
        $pi = optional($position->project)->pi;

        return [
            'id' => $position->id,
            'type' => $position->type,
            'title' => $position->title,
            'stipend' => $position->stipend,
            'deadline' => $position->deadline,
            'project_title' => optional($position->project)->title,
            'project_category' => optional($position->project)->category,
            'pi_name' => $pi ? $pi->user->name() : null,
            'pi_designation' => optional($pi)->designation,
            'pi_department' => optional(optional($pi)->department)->name,
        ];
    }

    private function sendVerificationEmail(PositionApplication $app, ProjectPosition $position)
    {
        $base = rtrim(config('app.frontend_url'), '/');

        try {
            Mail::send('emails.application_verify', [
                'applicantName' => $app->name,
                'positionTitle' => $position->title,
                'projectTitle' => optional($position->project)->title,
                'verifyUrl' => $base . '/applications/' . $app->token . '/verify',
                'statusUrl' => $base . '/applications/' . $app->token,
            ], function ($message) use ($app) {
                $message->to($app->email)->subject('Confirm your application');
            });
        } catch (\Exception $e) {
            // A failed mail must not lose the application; the PI still sees it
            // as unverified and the applicant keeps the link from the response.
            Log::error('Application verification email failed: ' . $e->getMessage());
        }
    }
}

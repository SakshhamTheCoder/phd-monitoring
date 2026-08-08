<?php
namespace App\Http\Controllers;
use App\Models\Project;
use App\Models\PositionApplication;
use App\Models\ProjectPosition;
use App\Http\Controllers\Traits\SaveFile;
use App\Http\Controllers\Traits\ProjectAuthorizes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class PositionApplicationController extends Controller {
    use SaveFile, ProjectAuthorizes;

    public function index($projectId) {
        $user = Auth::user();
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        return response()->json(
            PositionApplication::with('position:id,type,title')
                ->where('project_id', $project->id)->orderByDesc('id')->get()
        );
    }

    public function updateStatus(Request $request, $applicationId) {
        $user = Auth::user();
        $app = PositionApplication::find($applicationId);
        if (!$app) return response()->json(['message' => 'Application not found'], 404);
        $project = Project::find($app->project_id);
        if (!$project || !$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:Applied,Shortlisted,Interview Scheduled,Selected,Rejected',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);
        $app->status = $request->input('status');
        $app->save();
        return response()->json(['message' => 'Status updated', 'application' => $app]);
    }

    public function openings() {
        $positions = ProjectPosition::with('project:id,title,category')
            ->orderByDesc('id')->get();
        return response()->json($positions);
    }

    public function apply(Request $request, $positionId) {
        $user = Auth::user();
        if (optional($user->current_role)->role !== 'student') {
            return response()->json(['message' => 'Only students can apply'], 403);
        }
        $position = ProjectPosition::find($positionId);
        if (!$position) return response()->json(['message' => 'Position not found'], 404);
        $rollNo = optional($user->student)->roll_no;
        if ($rollNo && PositionApplication::where('position_id', $position->id)->where('student_id', $rollNo)->exists()) {
            return response()->json(['message' => 'You have already applied to this position'], 409);
        }
        $validator = Validator::make($request->all(), [
            'name' => 'required|string',
            'email' => 'required|string',
            'phone' => 'required|string',
            'degree' => 'required|string',
            'institute' => 'required|string',
            'cgpa' => 'required|string',
            'resume' => 'required|file|mimes:pdf,doc,docx|max:15360',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);

        $app = new PositionApplication();
        $app->position_id = $position->id;
        $app->project_id = $position->project_id;
        $app->student_id = $rollNo;
        foreach (['name','email','phone','degree','institute','cgpa','research','cover_note'] as $f) {
            $app->$f = $request->input($f);
        }
        $skills = $request->input('skills');
        $app->skills = is_string($skills)
            ? array_values(array_filter(array_map('trim', explode(',', $skills))))
            : ($skills ?: []);
        $app->resume_path = $this->saveUploadedFile($request->file('resume'), 'project_resume', $rollNo ?: 'anon');
        $app->status = 'Applied';
        $app->applied_date = date('Y-m-d');
        $app->save();
        return response()->json($app, 201);
    }

    public function myApplications() {
        $user = Auth::user();
        if (optional($user->current_role)->role !== 'student') {
            return response()->json(['message' => 'Only students have applications'], 403);
        }
        $rollNo = optional($user->student)->roll_no;
        return response()->json(
            PositionApplication::with('position.project:id,title')
                ->where('student_id', $rollNo)->orderByDesc('id')->get()
        );
    }

    // Prefill values for the apply form, sourced from the logged-in student's profile.
    public function applicantProfile() {
        $user = Auth::user();
        if (optional($user->current_role)->role !== 'student') {
            return response()->json(['message' => 'Only students have a profile'], 403);
        }
        $s = $user->student;
        return response()->json([
            'name' => trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? '')),
            'email' => $user->email,
            'phone' => $user->phone,
            'cgpa' => $s && $s->cgpa !== null ? (string) $s->cgpa : '',
            'institute' => 'Thapar Institute of Engineering & Technology',
            'degree' => 'PhD',
            'research' => $s ? $s->phd_title : '',
        ]);
    }
}

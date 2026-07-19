<?php
namespace App\Http\Controllers;
use App\Models\Project;
use App\Models\PositionApplication;
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
        return response()->json(PositionApplication::where('project_id', $project->id)->orderByDesc('id')->get());
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
}

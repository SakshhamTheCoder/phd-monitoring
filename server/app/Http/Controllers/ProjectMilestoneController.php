<?php
namespace App\Http\Controllers;
use App\Models\Project;
use App\Models\ProjectMilestone;
use App\Http\Controllers\Traits\ProjectAuthorizes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ProjectMilestoneController extends Controller {
    use ProjectAuthorizes;

    public function store(Request $request, $projectId) {
        $user = Auth::user();
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $validator = Validator::make($request->all(), [
            'name' => 'required|string',
            'status' => 'nullable|in:Not Started,In Progress,Completed,Delayed',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);
        $m = new ProjectMilestone();
        $m->project_id = $project->id;
        $m->name = $request->input('name');
        $m->deliverable = $request->input('deliverable');
        $m->due_date = $request->input('due_date');
        $m->status = $request->input('status', 'Not Started');
        $m->save();
        return response()->json($m, 201);
    }

    public function update(Request $request, $projectId, $milestoneId) {
        $user = Auth::user();
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $m = ProjectMilestone::where('project_id', $project->id)->find($milestoneId);
        if (!$m) return response()->json(['message' => 'Milestone not found'], 404);
        $validator = Validator::make($request->all(), [
            'status' => 'nullable|in:Not Started,In Progress,Completed,Delayed',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);
        foreach (['name','deliverable','due_date','status'] as $f) {
            if ($request->exists($f)) $m->$f = $request->input($f);
        }
        $m->save();
        return response()->json(['message' => 'Milestone updated', 'milestone' => $m]);
    }

    public function destroy($projectId, $milestoneId) {
        $user = Auth::user();
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $m = ProjectMilestone::where('project_id', $project->id)->find($milestoneId);
        if (!$m) return response()->json(['message' => 'Milestone not found'], 404);
        $m->delete();
        return response()->json(['message' => 'Milestone deleted']);
    }
}

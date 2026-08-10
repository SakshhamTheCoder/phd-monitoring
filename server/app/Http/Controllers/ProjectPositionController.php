<?php
namespace App\Http\Controllers;
use App\Models\Project;
use App\Models\ProjectPosition;
use App\Http\Controllers\Traits\SaveFile;
use App\Http\Controllers\Traits\ProjectAuthorizes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ProjectPositionController extends Controller {
    use SaveFile, ProjectAuthorizes;

    private $typeRule = 'in:JRF,SRF,Research Associate,Research Intern,UG Intern,PG Intern';

    public function index($projectId) {
        $user = Auth::user();
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->canView($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        return response()->json(
            ProjectPosition::where('project_id', $project->id)
                ->withCount([
                    'applications',
                    'applications as shortlisted_count' => function ($q) { $q->where('status', 'Shortlisted'); },
                    'applications as selected_count' => function ($q) { $q->where('status', 'Selected'); },
                ])
                ->orderByDesc('id')->get()
        );
    }

    public function store(Request $request, $projectId) {
        $user = Auth::user();
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $validator = Validator::make($request->all(), [
            'type' => 'required|' . $this->typeRule,
            'title' => 'required|string',
            'status' => 'nullable|in:Open,Closed',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);
        $pos = new ProjectPosition();
        $pos->project_id = $project->id;
        $this->fillPos($pos, $request);
        if ($request->hasFile('advertisement')) {
            $pos->advertisement_path = $this->saveUploadedFile($request->file('advertisement'), 'project_advertisement', $project->id);
        }
        $pos->save();
        return response()->json($pos, 201);
    }

    public function update(Request $request, $projectId, $positionId) {
        $user = Auth::user();
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $pos = ProjectPosition::where('project_id', $project->id)->find($positionId);
        if (!$pos) return response()->json(['message' => 'Position not found'], 404);
        $validator = Validator::make($request->all(), [
            'type' => 'sometimes|' . $this->typeRule,
            'status' => 'nullable|in:Open,Closed',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);
        $this->fillPos($pos, $request);
        if ($request->hasFile('advertisement')) {
            $pos->advertisement_path = $this->replaceUploadedFile($pos->advertisement_path, $request->file('advertisement'), 'project_advertisement', $project->id);
        }
        $pos->save();
        $this->commitFileDeletions();
        return response()->json(['message' => 'Position updated', 'position' => $pos]);
    }

    public function destroy($projectId, $positionId) {
        $user = Auth::user();
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $pos = ProjectPosition::where('project_id', $project->id)->find($positionId);
        if (!$pos) return response()->json(['message' => 'Position not found'], 404);
        $this->queueFileDeletion($pos->advertisement_path);
        $pos->delete();
        $this->commitFileDeletions();
        return response()->json(['message' => 'Position deleted']);
    }

    private function fillPos(ProjectPosition $pos, Request $request) {
        foreach (['type','title','status','stipend','deadline','eligibility','skills','min_cgpa','description'] as $f) {
            if ($request->exists($f)) $pos->$f = $request->input($f);
        }
        if ($request->exists('openings')) {
            $pos->openings = (int) $request->input('openings') ?: 1;
        }
    }
}

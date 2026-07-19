<?php
namespace App\Http\Controllers;
use App\Models\Project;
use App\Http\Controllers\Traits\SaveFile;
use App\Http\Controllers\Traits\ProjectAuthorizes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ProjectController extends Controller {
    use SaveFile, ProjectAuthorizes;

    public function index(Request $request) {
        $user = Auth::user();
        if (!$this->canManage($user)) return response()->json(['message' => 'Not authorized'], 403);
        $role = optional($user->current_role)->role;
        $query = Project::query();
        if (!in_array($role, $this->privileged)) {
            $query->where('pi_faculty_code', optional($user->faculty)->faculty_code);
        }
        return response()->json($query->orderByDesc('id')->get());
    }

    public function stats() {
        $user = Auth::user();
        if (!$this->canManage($user)) return response()->json(['message' => 'Not authorized'], 403);
        return response()->json([
            'active' => Project::where('status','Active')->count(),
            'completed' => Project::where('status','Completed')->count(),
            'totalFunding' => (int) Project::sum('amount'),
            'consultancy' => Project::where('category','Consultancy')->count(),
            'industry' => Project::where('category','Industry')->count(),
            'international' => Project::where('category','International')->count(),
        ]);
    }

    public function show($id) {
        $project = Project::with(['milestones','documents','positions'])->find($id);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        return response()->json($project);
    }

    public function store(Request $request) {
        $user = Auth::user();
        if (!$this->canManage($user)) return response()->json(['message' => 'Not authorized'], 403);
        $validator = Validator::make($request->all(), [
            'title' => 'required|string',
            'category' => 'required|in:In-house,Research,Consultancy,Industry,International,Other',
            'status' => 'nullable|in:Active,Completed,Pending,On Hold',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);

        $project = new Project();
        $piCode = optional($user->faculty)->faculty_code;
        if (!$piCode && $request->filled('pi_faculty_code')) {
            $piCode = (int) $request->input('pi_faculty_code');
        }
        if (!$piCode) {
            return response()->json(['message' => 'A PI faculty is required to create a project.'], 400);
        }
        $project->pi_faculty_code = $piCode;
        $this->fill($project, $request);
        $project->save();
        return response()->json($project, 201);
    }

    public function update(Request $request, $id) {
        $user = Auth::user();
        $project = Project::find($id);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $validator = Validator::make($request->all(), [
            'category' => 'sometimes|in:In-house,Research,Consultancy,Industry,International,Other',
            'status' => 'sometimes|in:Active,Completed,Pending,On Hold',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);
        $this->fill($project, $request);
        if ($request->hasFile('sanction_letter')) {
            $project->sanction_letter_link = $this->saveUploadedFile($request->file('sanction_letter'), 'project_sanction', $project->id);
            $project->sanction_letter_name = $request->file('sanction_letter')->getClientOriginalName();
        } elseif ($request->filled('sanction_letter_link')) {
            $project->sanction_letter_link = $request->sanction_letter_link;
            $project->sanction_letter_name = $request->input('sanction_letter_name', 'Sanction Letter');
        }
        $project->save();
        return response()->json(['message' => 'Project updated', 'project' => $project]);
    }

    public function destroy($id) {
        $user = Auth::user();
        $project = Project::find($id);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $project->delete();
        return response()->json(['message' => 'Project deleted']);
    }

    private function fill(Project $project, Request $request) {
        foreach (['title','category','funding_agency','role','status','start_date','end_date',
                  'description','focus_area','grant_type'] as $f) {
            if ($request->exists($f)) $project->$f = $request->input($f);
        }
        foreach (['amount','tiet_share','duration_years','duration_months'] as $f) {
            if ($request->exists($f)) $project->$f = (int) $request->input($f);
        }
        foreach (['co_pis','objectives','budget','equipment_details'] as $f) {
            if ($request->exists($f)) {
                $val = $request->input($f);
                $project->$f = is_string($val) ? json_decode($val, true) : $val;
            }
        }
    }
}

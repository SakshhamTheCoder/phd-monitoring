<?php
namespace App\Http\Controllers;
use App\Models\Project;
use App\Models\PositionApplication;
use App\Http\Controllers\Traits\SaveFile;
use App\Http\Controllers\Traits\ProjectAuthorizes;
use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Support\ProjectBudget;
use App\Support\ProjectDuration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ProjectController extends Controller {
    use SaveFile, ProjectAuthorizes, FilterLogicTrait;

    public function index(Request $request) {
        $user = Auth::user();
        if (!$this->canManage($user)) return response()->json(['message' => 'Not authorized'], 403);
        $projects = $this->visibleTo($user)->orderByDesc('id')->get();
        $projects->each(fn ($project) => $project->can_edit = $this->owns($user, $project));
        return response()->json($projects);
    }

    public function stats() {
        $user = Auth::user();
        if (!$this->canManage($user)) return response()->json(['message' => 'Not authorized'], 403);
        $base = $this->visibleTo($user);
        return response()->json([
            'active' => (clone $base)->where('status','Active')->count(),
            'completed' => (clone $base)->where('status','Completed')->count(),
            'totalFunding' => (int) (clone $base)->sum('amount'),
            'consultancy' => (clone $base)->where('category','Consultancy')->count(),
            'industry' => (clone $base)->where('category','Industry')->count(),
            'international' => (clone $base)->where('category','International')->count(),
        ]);
    }

    /**
     * The option lists the create wizard and the details page draw from.
     *
     * These live here rather than in the client so that adding an SDG or
     * renaming a budget head is a backend change, and so the validation in
     * store()/update() and the menus the user sees can never drift apart.
     */
    public function meta() {
        $user = Auth::user();
        if (!$this->canManage($user)) return response()->json(['message' => 'Not authorized'], 403);
        return response()->json([
            'sdgs' => config('sdgs.goals'),
            'manpowerCategories' => ProjectBudget::MANPOWER_CATEGORIES,
            'budgetHeads' => ProjectBudget::heads(),
            'duration' => [
                'years' => ProjectDuration::yearOptions(),
                'maxMonths' => ProjectDuration::MAX_MONTHS,
            ],
        ]);
    }

    public function listFilters(Request $request) {
        return response()->json($this->getAvailableFilters('projects'));
    }

    public function show($id) {
        $user = Auth::user();
        $project = Project::with(['milestones','documents','positions','pi.user','pi.department'])->find($id);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->canView($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $project->can_edit = $this->owns($user, $project);
        return response()->json($project);
    }

    public function store(Request $request) {
        $user = Auth::user();
        if (!$this->canManage($user)) return response()->json(['message' => 'Not authorized'], 403);
        $validator = Validator::make($request->all(), [
            'title' => 'required|string',
            'category' => 'required|in:In-house,Research,Consultancy,Industry,International,Other',
            'status' => 'nullable|in:Active,Completed,Pending,On Hold',
            'pi_faculty_code' => 'sometimes|integer|exists:faculty,faculty_code',
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
        $this->syncCoPis($project);
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
            $project->sanction_letter_link = $this->replaceUploadedFile($project->sanction_letter_link, $request->file('sanction_letter'), 'project_sanction', $project->id);
            $project->sanction_letter_name = $request->file('sanction_letter')->getClientOriginalName();
        } elseif ($request->filled('sanction_letter_link')) {
            // Switching to an external link supersedes any stored file.
            $this->queueFileDeletion($project->sanction_letter_link);
            $project->sanction_letter_link = $request->sanction_letter_link;
            $project->sanction_letter_name = $request->input('sanction_letter_name', 'Sanction Letter');
        }
        $project->save();
        if ($request->exists('co_pis')) $this->syncCoPis($project);
        $this->commitFileDeletions();
        return response()->json(['message' => 'Project updated', 'project' => $project]);
    }

    public function destroy($id) {
        $user = Auth::user();
        $project = Project::with(['documents','positions'])->find($id);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        // The rows cascade, the files on disk do not.
        $this->queueFileDeletion($project->sanction_letter_link);
        foreach ($project->documents as $doc) $this->queueFileDeletion($doc->file_path);
        foreach ($project->positions as $pos) $this->queueFileDeletion($pos->advertisement_path);
        foreach (PositionApplication::where('project_id', $project->id)->pluck('resume_path') as $resume) {
            $this->queueFileDeletion($resume);
        }
        $project->delete();
        $this->commitFileDeletions();
        return response()->json(['message' => 'Project deleted']);
    }

    private function visibleTo($user) {
        $query = Project::query();
        if (in_array(optional($user->current_role)->role, $this->privileged)) return $query;

        $code = optional($user->faculty)->faculty_code;
        $department = $this->departmentScope($user);
        return $query->where(function ($q) use ($code, $department) {
            $q->where('pi_faculty_code', $code)
              ->orWhereHas('coPiFaculty', fn ($f) => $f->where('faculty.faculty_code', $code));
            if ($department !== null) {
                $q->orWhereHas('pi', fn ($f) => $f->where('department_id', $department));
            }
        });
    }

    /**
     * projects.co_pis stays the display record; this keeps the access index in
     * step with it so an internal Co-PI can reach the project.
     */
    private function syncCoPis(Project $project) {
        $codes = collect($project->co_pis ?: [])
            ->pluck('faculty_code')->filter()->map(fn ($c) => (int) $c)->unique()->all();
        $project->coPiFaculty()->sync($codes);
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

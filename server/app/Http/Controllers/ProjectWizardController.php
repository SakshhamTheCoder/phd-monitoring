<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ProjectAuthorizes;
use App\Models\Faculty;
use App\Models\Project;
use App\Projects\ProjectWizard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * The project wizard's review and save.
 *
 * Saving used to be the browser's job: create or update the project, then
 * each milestone one request at a time, then the sanction letter and the
 * Gantt chart, reporting whichever parts failed. It is one request now, run
 * through the same endpoints in one transaction, so a project is saved
 * whole or not at all and every client saves it the same way.
 *
 * The values arrive as the wizard holds them (`values`, JSON), with the two
 * files beside them.
 */
class ProjectWizardController extends Controller
{
    use ProjectAuthorizes;

    public function review(Request $request)
    {
        if (!$this->canManage(Auth::user())) {
            return response()->json(['message' => 'Not authorized'], 403);
        }
        $values = $this->values($request);
        $pi = $request->input('pi');

        return response()->json(['blocks' => ProjectWizard::review($values, is_array($pi) ? $pi : null)]);
    }

    public function store(Request $request)
    {
        return $this->save($request, null);
    }

    public function update(Request $request, $id)
    {
        return $this->save($request, (int) $id);
    }

    private function save(Request $request, ?int $id)
    {
        $user = Auth::user();
        if (!$this->canManage($user)) {
            return response()->json(['message' => 'Not authorized'], 403);
        }
        $values = $this->values($request);
        if ($missing = ProjectWizard::missing($values)) {
            return response()->json($missing, 422);
        }

        $failure = null;
        $projectId = $id;
        DB::beginTransaction();
        try {
            $body = ProjectWizard::toProjectBody($values);
            $answer = $id
                ? $this->call(ProjectController::class, 'update', "/projects/{$id}", $body, [], $id)
                : $this->call(ProjectController::class, 'store', '/projects', $body);
            if ($answer->getStatusCode() >= 300) {
                $failure = $answer;
            } else {
                $projectId ??= $answer->getData()->id;
                $failure = $this->saveMilestones($projectId, $id ? $this->storedMilestones($projectId) : [], $values['milestones'] ?? [])
                    ?? $this->saveFiles($request, $projectId, $values, $id !== null);
            }
        } catch (\Throwable $error) {
            DB::rollBack();
            throw $error;
        }

        if ($failure) {
            DB::rollBack();
            $data = $failure->getData(true);
            return response()->json(['message' => $data['message'] ?? 'The project could not be saved.', 'errors' => $data['errors'] ?? null], $failure->getStatusCode() === 400 ? 422 : $failure->getStatusCode());
        }
        DB::commit();

        return response()->json(['id' => $projectId, 'message' => $id ? 'Project updated.' : 'Project created.'], $id ? 200 : 201);
    }

    /** The wizard's values, sent as JSON beside any files. */
    private function values(Request $request): array
    {
        $values = $request->input('values');
        $values = is_string($values) ? json_decode($values, true) : $values;
        return is_array($values) ? $values : [];
    }

    private function storedMilestones(int $projectId): array
    {
        return \App\Models\ProjectMilestone::where('project_id', $projectId)->get()
            ->map(fn ($m) => ['id' => $m->id, 'name' => $m->name, 'deliverable' => $m->deliverable, 'dueDate' => $m->due_date, 'status' => $m->status])
            ->all();
    }

    /**
     * Brings the stored milestones in line with the wizard's: a row without an
     * id is added, a changed row updated, and a stored row removed or emptied
     * is deleted. In order, since the table keeps the order rows were added.
     */
    private function saveMilestones(int $projectId, array $before, array $after): ?Response
    {
        $body = fn (array $m) => ['name' => $m['name'] ?? null, 'deliverable' => $m['deliverable'] ?? null, 'due_date' => ($m['dueDate'] ?? '') ?: null, 'status' => $m['status'] ?? null];
        $named = fn (array $m) => trim((string) ($m['name'] ?? '')) !== '';
        $kept = collect($after)->filter(fn ($m) => !empty($m['id']) && $named($m))->pluck('id')->all();
        $stored = collect($before)->keyBy('id');
        $url = "/projects/{$projectId}/milestones";

        foreach ($before as $m) {
            if (!in_array($m['id'], $kept)) {
                $answer = $this->call(ProjectMilestoneController::class, 'destroy', "{$url}/{$m['id']}", [], [], $projectId, $m['id']);
                if ($answer->getStatusCode() >= 300) return $answer;
            }
        }
        foreach (array_filter($after, $named) as $m) {
            $old = !empty($m['id']) ? $stored->get($m['id']) : null;
            if ($old && $body($old) == $body($m)) continue;
            $answer = $old
                ? $this->call(ProjectMilestoneController::class, 'update', "{$url}/{$m['id']}", $body($m), [], $projectId, $m['id'])
                : $this->call(ProjectMilestoneController::class, 'store', $url, $body($m), [], $projectId);
            if ($answer->getStatusCode() >= 300) return $answer;
        }
        return null;
    }

    /**
     * The sanction letter (a file, a link, or a link emptied) and the Gantt
     * chart, through the update endpoint that already swaps a file for a link
     * and cleans up whichever it replaced.
     */
    private function saveFiles(Request $request, int $projectId, array $values, bool $editing): ?Response
    {
        $url = "/projects/{$projectId}";
        $link = trim((string) ($values['sanctionLetterLink'] ?? ''));
        $sanction = match (true) {
            $request->hasFile('sanction_letter') => [[], ['sanction_letter' => $request->file('sanction_letter')]],
            (bool) preg_match('#^https?://#i', $link) => [['sanction_letter_link' => $link, 'sanction_letter_name' => 'Sanction Letter'], []],
            // A stored link that was emptied is cleared, or the old one would come back.
            $editing && $link === '' && $this->storedLink($projectId) => [['sanction_letter_link' => null], []],
            default => null,
        };
        foreach (array_filter([$sanction, $request->hasFile('gantt_chart') ? [[], ['gantt_chart' => $request->file('gantt_chart')]] : null]) as [$body, $files]) {
            $answer = $this->call(ProjectController::class, 'update', $url, $body, $files, $projectId);
            if ($answer->getStatusCode() >= 300) return $answer;
        }
        return null;
    }

    private function storedLink(int $projectId): bool
    {
        return (bool) preg_match('#^https?://#i', (string) Project::whereKey($projectId)->value('sanction_letter_link'));
    }

    /** One of the project endpoints, answered as it would answer the browser. */
    private function call(string $controller, string $method, string $uri, array $body, array $files = [], ...$arguments): Response
    {
        $inner = Request::create('/api' . $uri, 'POST', $body, [], $files);
        $inner->setUserResolver(fn () => Auth::user());
        return app($controller)->{$method}(...($method === 'destroy' ? $arguments : [$inner, ...$arguments]));
    }
}

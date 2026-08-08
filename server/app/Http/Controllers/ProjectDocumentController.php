<?php
namespace App\Http\Controllers;
use App\Models\Project;
use App\Models\ProjectDocument;
use App\Http\Controllers\Traits\SaveFile;
use App\Http\Controllers\Traits\ProjectAuthorizes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ProjectDocumentController extends Controller {
    use SaveFile, ProjectAuthorizes;

    public function store(Request $request, $projectId) {
        $user = Auth::user();
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $validator = Validator::make($request->all(), ['name' => 'required|string']);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);

        $doc = new ProjectDocument();
        $doc->project_id = $project->id;
        $doc->name = $request->input('name');
        $doc->doc_date = $request->input('doc_date') ?: date('Y-m-d');
        if ($request->hasFile('file')) {
            $doc->file_path = $this->saveUploadedFile($request->file('file'), 'project_document', $project->id);
            $doc->type = $request->file('file')->getClientOriginalExtension();
        } elseif ($request->filled('link')) {
            $doc->link = $request->input('link');
            $doc->type = $request->input('type', 'LINK');
        } else {
            return response()->json(['message' => 'A file or link is required'], 400);
        }
        $doc->save();
        return response()->json($doc, 201);
    }

    public function update(Request $request, $projectId, $documentId) {
        $user = Auth::user();
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $doc = ProjectDocument::where('project_id', $project->id)->find($documentId);
        if (!$doc) return response()->json(['message' => 'Document not found'], 404);
        $validator = Validator::make($request->all(), ['name' => 'required|string']);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);

        $doc->name = $request->input('name');
        if ($request->filled('doc_date')) $doc->doc_date = $request->input('doc_date');
        if ($request->hasFile('file')) {
            // Optional replace: swap the file and clean up the old one.
            $doc->file_path = $this->replaceUploadedFile($doc->file_path, $request->file('file'), 'project_document', $project->id);
            $doc->type = $request->file('file')->getClientOriginalExtension();
            $doc->link = null;
        } elseif ($request->filled('link')) {
            $this->deleteStoredFile($doc->file_path);
            $doc->file_path = null;
            $doc->link = $request->input('link');
            $doc->type = $request->input('type', 'LINK');
        }
        // No file/link supplied -> keep the existing one (name-only edit).
        $doc->save();
        return response()->json(['message' => 'Document updated', 'document' => $doc]);
    }

    public function destroy($projectId, $documentId) {
        $user = Auth::user();
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
        if (!$this->owns($user, $project)) return response()->json(['message' => 'Not authorized'], 403);
        $doc = ProjectDocument::where('project_id', $project->id)->find($documentId);
        if (!$doc) return response()->json(['message' => 'Document not found'], 404);
        $this->deleteStoredFile($doc->file_path);
        $doc->delete();
        return response()->json(['message' => 'Document deleted']);
    }
}

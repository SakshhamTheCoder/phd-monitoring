<?php
namespace App\Http\Controllers;

use App\Models\Faculty;
use App\Models\FacultyPublication;
use App\Models\Patent;
use App\Models\Publication;
use App\Jobs\SyncFacultyPublications;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class FacultyProfileController extends Controller
{
    private $identifierFields = ['orcid_id', 'scopus_id', 'google_scholar_id', 'joined_on', 'citations', 'h_index'];

    public function show($facultyCode)
    {
        $faculty = Faculty::with(['user', 'department'])->find($facultyCode);
        if (!$faculty) return response()->json(['message' => 'Faculty not found'], 404);

        $own = FacultyPublication::where('faculty_code', $faculty->faculty_code)->orderByDesc('year')->get();
        $rollNumbers = $faculty->supervisedStudents()->pluck('students.roll_no');

        return response()->json([
            'profile' => $this->profilePayload($faculty, $own),
            'can_edit' => $this->canEdit($faculty),
            'can_sync' => $this->canSync($faculty),
            'publications' => $this->groupOwn($own),
            'student_publications' => $this->groupStudent($rollNumbers),
        ]);
    }

    public function update(Request $request, $facultyCode)
    {
        $faculty = Faculty::find($facultyCode);
        if (!$faculty) return response()->json(['message' => 'Faculty not found'], 404);
        if (!$this->canEdit($faculty)) return response()->json(['message' => 'Not authorized'], 403);

        $validator = Validator::make($request->all(), [
            'joined_on' => 'nullable|date',
            'citations' => 'nullable|integer|min:0',
            'h_index' => 'nullable|integer|min:0',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);

        foreach ($this->identifierFields as $field) {
            if ($request->exists($field)) $faculty->$field = $request->input($field) ?: null;
        }
        $faculty->save();
        return response()->json(['message' => 'Profile updated']);
    }

    public function storePublication(Request $request, $facultyCode)
    {
        $faculty = Faculty::find($facultyCode);
        if (!$faculty) return response()->json(['message' => 'Faculty not found'], 404);
        if (!$this->canEdit($faculty)) return response()->json(['message' => 'Not authorized'], 403);

        $validator = Validator::make($request->all(), $this->publicationRules());
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);

        $publication = new FacultyPublication();
        $publication->faculty_code = $faculty->faculty_code;
        $publication->source = 'manual';
        // Hand-typed records are not confirmed by an external source. `verified`
        // is the hook if a review step is added later.
        $publication->verified = false;
        $this->fill($publication, $request);
        $publication->save();
        return response()->json($publication, 201);
    }

    public function updatePublication(Request $request, $facultyCode, $publicationId)
    {
        $faculty = Faculty::find($facultyCode);
        if (!$faculty) return response()->json(['message' => 'Faculty not found'], 404);
        if (!$this->canEdit($faculty)) return response()->json(['message' => 'Not authorized'], 403);

        $publication = FacultyPublication::where('faculty_code', $faculty->faculty_code)->find($publicationId);
        if (!$publication) return response()->json(['message' => 'Publication not found'], 404);

        $validator = Validator::make($request->all(), $this->publicationRules(true));
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);

        $this->fill($publication, $request);
        $publication->save();
        return response()->json(['message' => 'Publication updated', 'publication' => $publication]);
    }

    public function destroyPublication($facultyCode, $publicationId)
    {
        $faculty = Faculty::find($facultyCode);
        if (!$faculty) return response()->json(['message' => 'Faculty not found'], 404);
        if (!$this->canEdit($faculty)) return response()->json(['message' => 'Not authorized'], 403);

        $publication = FacultyPublication::where('faculty_code', $faculty->faculty_code)->find($publicationId);
        if (!$publication) return response()->json(['message' => 'Publication not found'], 404);

        $publication->delete();
        return response()->json(['message' => 'Publication deleted']);
    }

    public function sync($facultyCode)
    {
        $faculty = Faculty::find($facultyCode);
        if (!$faculty) return response()->json(['message' => 'Faculty not found'], 404);
        if (!$this->canEdit($faculty)) return response()->json(['message' => 'Not authorized'], 403);

        if (!$this->canSync($faculty)) {
            return response()->json([
                'message' => 'Add an ORCID iD, or a Scopus ID with the Scopus key configured, before you sync.',
            ], 422);
        }

        SyncFacultyPublications::dispatch($faculty->faculty_code);
        return response()->json(['message' => 'Sync started. New records appear once it finishes.']);
    }

    // ORCID reads from the public record, so it needs an iD only. Scopus also
    // needs the API key to be configured.
    private function canSync($faculty)
    {
        return (bool) $faculty->orcid_id || ($faculty->scopus_id && config('services.scopus.key'));
    }

    private function canEdit($faculty)
    {
        $user = Auth::user();
        if (!$user) return false;
        if (optional($user->current_role)->role === 'admin') return true;
        return optional($user->faculty)->faculty_code === $faculty->faculty_code;
    }

    private function publicationRules($isUpdate = false)
    {
        $required = $isUpdate ? 'sometimes|required' : 'required';
        return [
            'title' => $required . '|string',
            'publication_type' => $required . '|in:journal,conference,book,patent',
            'type' => 'nullable|in:national,international,sci,non-sci',
            'year' => 'nullable|integer|min:1900|max:2100',
            'impact_factor' => 'nullable|numeric',
            'issn' => 'nullable|integer',
        ];
    }

    private function fill(FacultyPublication $publication, Request $request)
    {
        foreach (['title', 'authors', 'doi_link', 'year', 'name', 'publisher', 'volume',
                  'page_no', 'issn', 'country', 'state', 'city', 'impact_factor',
                  'publication_type', 'type'] as $field) {
            if ($request->exists($field)) $publication->$field = $request->input($field);
        }
    }

    private function profilePayload(Faculty $faculty, $own)
    {
        return [
            'faculty_code' => $faculty->faculty_code,
            'name' => $faculty->user ? $faculty->user->name() : '',
            'designation' => $faculty->designation,
            'department' => $faculty->department->name ?? '',
            'email' => $faculty->user->email ?? '',
            'phone' => $faculty->user->phone ?? '',
            'website' => $faculty->website_link,
            'joined' => $faculty->joined_on,
            'orcid_id' => $faculty->orcid_id,
            'scopus_id' => $faculty->scopus_id,
            'google_scholar_id' => $faculty->google_scholar_id,
            'citations' => $faculty->citations,
            'h_index' => $faculty->h_index,
            'last_sync' => $faculty->last_synced_at,
            'last_sync_source' => $faculty->last_sync_source,
            'total_publications' => $own->count(),
            'synced' => $own->whereIn('source', ['scopus', 'orcid'])->count(),
            'self_reported' => $own->where('source', 'manual')->count(),
        ];
    }

    // The page renders one table per key, so both sets are grouped the same way.
    private function emptyGroups()
    {
        return ['sci' => [], 'non_sci' => [], 'international' => [], 'national' => [], 'book' => [], 'patents' => []];
    }

    private function bucket($publicationType, $type)
    {
        if ($publicationType === 'patent') return 'patents';
        if ($publicationType === 'book') return 'book';
        if ($publicationType === 'journal') return $type === 'sci' ? 'sci' : 'non_sci';
        if ($publicationType === 'conference') return $type === 'national' ? 'national' : 'international';
        return null;
    }

    private function groupOwn($own)
    {
        $groups = $this->emptyGroups();
        foreach ($own as $publication) {
            $key = $this->bucket($publication->publication_type, $publication->type);
            if ($key) $groups[$key][] = $publication->toArray();
        }
        return $groups;
    }

    private function groupStudent($rollNumbers)
    {
        $groups = $this->emptyGroups();
        if ($rollNumbers->isEmpty()) return $groups;

        foreach (Publication::whereIn('student_id', $rollNumbers)->orderByDesc('year')->get() as $publication) {
            $key = $this->bucket($publication->publication_type, $publication->type);
            if ($key) $groups[$key][] = $publication->toArray() + ['source' => 'student', 'verified' => true];
        }
        foreach (Patent::whereIn('student_id', $rollNumbers)->orderByDesc('year')->get() as $patent) {
            $groups['patents'][] = $patent->toArray() + ['source' => 'student', 'verified' => true];
        }
        return $groups;
    }
}

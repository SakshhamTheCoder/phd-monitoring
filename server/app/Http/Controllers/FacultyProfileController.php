<?php
namespace App\Http\Controllers;

use App\Models\Faculty;
use App\Models\FacultyPublication;
use App\Models\Patent;
use App\Models\Publication;
use App\Jobs\SyncFacultyPublications;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
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
            'expertise' => 'nullable',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 400);

        foreach ($this->identifierFields as $field) {
            if ($request->exists($field)) $faculty->$field = $request->input($field) ?: null;
        }
        if ($request->has('expertise')) {
            $val = $request->input('expertise');
            if (is_string($val)) $val = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $val))));
            $faculty->expertise = $val;
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

        // An imported row that someone has corrected is pinned, so the next sync
        // does not put it back. Neither ORCID nor Scopus can tell SCI from
        // Scopus indexing, or a national conference from an international one,
        // so a human correction is the only accurate value on the row.
        if (in_array($publication->source, ['orcid', 'scopus'], true)) {
            $publication->manually_edited = true;
        }

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

        $requester = optional(Auth::user())->email ?? 'unknown';
        Log::info("Sync requested for faculty {$faculty->faculty_code} by {$requester} (orcid=".($faculty->orcid_id ?: 'null').", scopus=".($faculty->scopus_id ?: 'null').")");

        // Run inline so prod works even without a queue worker (QUEUE_CONNECTION=database needs `php artisan queue:work`).
        // Job has $timeout 300 and $tries 3; dispatchSync runs it now and propagates errors to the response.
        $beforeCount = \App\Models\FacultyPublication::where('faculty_code', $faculty->faculty_code)->count();
        $beforeSync = $faculty->last_synced_at;
        try {
            SyncFacultyPublications::dispatchSync($faculty->faculty_code);
        } catch (\Throwable $e) {
            Log::error("Sync failed for faculty {$faculty->faculty_code}: ".$e->getMessage(), ['exception' => $e]);
            return response()->json(['message' => 'Sync failed: '.$e->getMessage()], 500);
        }
        $faculty->refresh();
        $afterCount = \App\Models\FacultyPublication::where('faculty_code', $faculty->faculty_code)->count();
        $imported = $afterCount - $beforeCount;
        $didSync = $faculty->last_synced_at && (!$beforeSync || $faculty->last_synced_at->gt($beforeSync));
        if ($didSync) {
            Log::info("Sync finished for faculty {$faculty->faculty_code}: imported {$imported} new, source={$faculty->last_sync_source}, last_sync={$faculty->last_synced_at}");
        } else {
            Log::warning("Sync finished for faculty {$faculty->faculty_code} but no new records: imported {$imported}, beforeSync=".($beforeSync ?: 'never').", source=".($faculty->last_sync_source ?: 'null'));
        }
        return response()->json([
            'message' => $didSync ? 'Sync finished. '.$faculty->last_synced_at->diffForHumans().' from '.($faculty->last_sync_source ?? 'unknown')." ({$imported} new)." : 'Sync finished, but no new records were imported.',
            'last_sync' => $faculty->last_synced_at,
            'last_sync_source' => $faculty->last_sync_source,
            'imported' => $imported,
        ]);
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
        return $faculty->toProfilePayload($own);
    }

    // The page renders one table per key, so both sets are grouped the same way.
    private function emptyGroups()
    {
        return ['sci' => [], 'non_sci' => [], 'international' => [], 'national' => [], 'book' => [], 'patents' => [], 'uncategorised' => []];
    }

    private function bucket($publicationType, $type)
    {
        if ($publicationType === 'patent') return 'patents';
        if ($publicationType === 'book') return 'book';
        if ($publicationType === 'conference') return $type === 'national' ? 'national' : 'international';

        if ($publicationType === 'journal') {
            // A journal article is only listed as Scopus indexed when something
            // actually said so. ORCID carries no indexing information, so its
            // articles arrive with no type and are shown as unclassified for
            // the faculty member to place, rather than being claimed as Scopus.
            if ($type === 'sci') return 'sci';
            if ($type === 'non-sci') return 'non_sci';
            return 'uncategorised';
        }

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

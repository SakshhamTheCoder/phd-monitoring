<?php

namespace App\Http\Controllers;

use App\Models\AreaOfSpecialization;
use App\Models\Department;
use App\Models\Examiner;
use App\Models\Faculty;
use App\Models\OutsideExpert;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SuggestionController extends Controller
{

    /**
     * The research areas the caller's department offers.
     *
     * This used to read a second list that the allocation form itself wrote to,
     * so every area a scholar typed became a suggestion for everyone else. There
     * is one list now and only the admin page and the research area import add
     * to it, which is what makes it a fixed vocabulary the forms can present as
     * a dropdown.
     *
     * `text` is optional: without it the whole list comes back, which is what a
     * dropdown needs.
     */
    public function suggestSpecialization(Request $request)
    {
        $loggenInUser = Auth::user();
        $department = $loggenInUser->current_role->role == 'student'
            ? $loggenInUser->student?->department
            : $loggenInUser->faculty?->department;

        if (!$department) {
            return response()->json([]);
        }

        $request->validate([
            'text' => 'nullable|string',
        ]);

        // What is offered, not what is allowed: the field this feeds is free
        // text, and a scholar naming something nobody here works on yet is the
        // point of it. Two sources, both from this department:
        //
        //   - the specific areas its faculty list, which is what the
        //     recommender matches against, rather than the dozen broad areas
        //     the matrix names, which are the heading a supervisor is filed
        //     under. One expertise cell holds several, comma separated;
        //   - what scholars here have named before, kept in
        //     student_area_preferences, so a word somebody had to type once is
        //     offered to the next scholar.
        $typed = trim((string) $request->input('text'));

        // expertise is a JSON list of areas, and an entry of it is itself
        // sometimes a list: "CAD, CAM, Design Automation" in one string.
        $listed = \App\Models\Faculty::where('department_id', $department->id)
            ->whereNotNull('expertise')
            ->pluck('expertise')
            ->flatMap(fn ($expertise) => is_array($expertise) ? $expertise : [(string) $expertise])
            ->flatMap(fn ($area) => preg_split('/[;,]/', (string) $area));

        $named = \App\Models\StudentAreaPreference::whereIn(
            'student_id',
            \App\Models\Student::where('department_id', $department->id)->select('roll_no')
        )->pluck('broad_area');

        $areas = $listed->concat($named)
            ->map(fn ($area) => trim(preg_replace('/\s+/', ' ', (string) $area)))
            ->filter(fn ($area) => $area !== '' && mb_strlen($area) <= 80)
            ->filter(fn ($area) => $typed === '' || mb_stripos($area, $typed) !== false)
            // Two people write the same area in two cases; the first spelling
            // seen is the one offered.
            ->unique(fn ($area) => mb_strtolower($area))
            ->sort(fn ($a, $b) => strcasecmp($a, $b))
            ->take(50)
            // The field stores the wording itself, so it is both value and key.
            ->map(fn ($area) => ['id' => $area, 'name' => $area])
            ->values();

        return response()->json($areas);
    }

    public function suggestSubdomain(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
        ]);
        $text = trim($request->text);
        if ($text === '') {
            return response()->json([]);
        }
        // Only surface keywords that at least 2 distinct students have used, so a
        // one-off gibberish entry never leaks into everyone else's suggestions.
        // (Free-typed keywords still always work client-side; this only gates suggestions.)
        $keywords = \App\Models\StudentSubdomain::where('keyword', 'LIKE', '%' . $text . '%')
            ->select('keyword')
            ->groupBy('keyword')
            ->havingRaw('COUNT(DISTINCT student_id) >= 2')
            ->orderBy('keyword')
            ->limit(10)
            ->pluck('keyword');

        return response()->json(
            $keywords->map(fn ($k) => ['id' => $k, 'name' => $k])->values()
        );
    }

    public function suggestExaminer(Request $request)
    {
        $loggenInUser = Auth::user();
        if (!$loggenInUser->may('can_suggest_examiners')) {
            return response()->json(["message" => "Only faculty can view examiners"]);
        }

        $request->validate(
        [
            'text' => 'required|string',
        ]
        );
        if (!$request->has('text')) {
            return response()->json([], 200);
        }
        // Word by word, in any order, for the same reason as suggestFaculty.
        $tokens = preg_split('/[\s.,]+/', trim($request->text), -1, PREG_SPLIT_NO_EMPTY);

        if (empty($tokens)) {
            return response()->json([], 200);
        }

        // The directory, not the per-form rows. Searching the rows returned the
        // same person once per form they had ever been proposed on, each hit
        // carrying that form's verdict.
        $examinerQuery = Examiner::query();

        foreach ($tokens as $token) {
            $examinerQuery->where(function ($query) use ($token) {
                $like = '%' . $token . '%';

                $query->where('name', 'LIKE', $like)
                    ->orWhere('email', 'LIKE', $like)
                    ->orWhere('phone', 'LIKE', $like);
            });
        }

        $examiners = $examinerQuery
            ->orderBy('name')
            ->limit(25)
            ->get();

        // Return the examiners as a JSON response
        return response()->json($examiners);

    }

    public function suggestFaculty(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'department_id' => 'nullable|integer',
            'type' => 'nullable|in:internal,external',
        ]);

        // Mirrors the authorization check in the faculty directory endpoints.
        $user = Auth::user();
        if (!$user?->may('can_read_faculty_directory')) {
            return $this->refuse();
        }

        if (!$request->text) {
            return response()->json([], 200);
        }

        // Match each word separately rather than the whole string at once.
        // Names are stored inconsistently, often entirely in first_name with a
        // blank last name, so "Dr. S. S. Bhatia" was only findable by typing the
        // punctuation exactly right: "S.S. Bhatia", "SS Bhatia" and "bhatia s"
        // all found nothing. Splitting on spaces and punctuation means every
        // word has to match something, in any order, and the search also covers
        // email, faculty code and designation.
        $tokens = preg_split('/[\s.,]+/', trim($request->text), -1, PREG_SPLIT_NO_EMPTY);

        if (empty($tokens)) {
            return response()->json([], 200);
        }

        $facultyQuery = Faculty::query();

        foreach ($tokens as $token) {
            $facultyQuery->where(function ($query) use ($token) {
                $like = '%' . $token . '%';

                $query->whereHas('user', function ($user) use ($like) {
                    $user->where('first_name', 'LIKE', $like)
                        ->orWhere('last_name', 'LIKE', $like)
                        ->orWhere('email', 'LIKE', $like)
                        ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like]);
                })
                    ->orWhere('faculty_code', 'LIKE', $like)
                    ->orWhere('designation', 'LIKE', $like);
            });
        }

        // The URF form asks for internal faculty only: a mentor is institute staff.
        if ($request->filled('type')) {
            $facultyQuery->where('type', $request->type);
        }

        if (!empty($request->department_id)) {
            $department = Department::find($request->department_id);
            if (!$department) {
                return response()->json(['message' => 'Department not found'], 404);
            }
            $facultyQuery->where('department_id', $request->department_id);
        }

        $faculty = $facultyQuery->with(['user', 'department'])
            ->orderBy(User::select('first_name')->whereColumn('users.id', 'faculty.user_id'))
            ->orderBy(User::select('last_name')->whereColumn('users.id', 'faculty.user_id'))
            // A single letter can match a large slice of the table, so cap what
            // comes back. Anyone past this point should type another word.
            ->limit(25)
            ->get()
            ->map(function ($faculty) {
            return [
            'id' => $faculty->faculty_code,
            'name' => $faculty->user->name(),
            'email' => $faculty->user->email,
            'designation' => $faculty->designation,
            'department' => $faculty->department->name ?? 'N/A',
            ];
        });

        return response()->json($faculty);
    }
    /**
     * Scholars matching what the user has typed.
     *
     * The alternative was a plain dropdown holding every scholar, which is what
     * the course tagging dialog had: it asked for one page of the directory and
     * offered whatever came back, so most of the register was simply missing
     * from the list and there was no way to reach it.
     *
     * Matching follows suggestFaculty: each word has to match something, in any
     * order, because names are stored inconsistently and a registration number
     * is as likely a search term as a name.
     */
    public function suggestStudent(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'department_id' => 'nullable|integer',
        ]);

        $user = Auth::user();
        if (!$user?->may('can_read_all_students') && !$user?->may('can_read_department_students')) {
            return $this->refuse();
        }

        $tokens = preg_split('/[\s.,]+/', trim($request->text), -1, PREG_SPLIT_NO_EMPTY);
        if (empty($tokens)) {
            return response()->json([], 200);
        }

        $studentQuery = \App\Models\Student::query();

        foreach ($tokens as $token) {
            $studentQuery->where(function ($query) use ($token) {
                $like = '%' . $token . '%';

                $query->whereHas('user', function ($user) use ($like) {
                    $user->where('first_name', 'LIKE', $like)
                        ->orWhere('last_name', 'LIKE', $like)
                        ->orWhere('email', 'LIKE', $like)
                        ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like]);
                })->orWhere('roll_no', 'LIKE', $like);
            });
        }

        // A reader limited to their own department sees only that department,
        // the same scoping the student directory applies.
        if (!$user->may('can_read_all_students')) {
            $studentQuery->where('department_id', $user->faculty?->department_id);
        }

        if (!empty($request->department_id)) {
            $studentQuery->where('department_id', $request->department_id);
        }

        $students = $studentQuery->with(['user', 'department'])
            ->orderBy(User::select('first_name')->whereColumn('users.id', 'students.user_id'))
            // A single letter can match a large slice of the register, so cap
            // what comes back. Anyone past this point should type another word.
            ->limit(25)
            ->get()
            ->map(fn ($student) => [
                'id' => $student->roll_no,
                'name' => $student->user->name(),
                'roll_no' => $student->roll_no,
                'email' => $student->user->email,
                'department' => $student->department->name ?? 'N/A',
            ]);

        return response()->json($students);
    }

    public function suggestDepartment(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
        ]);

        if (!$request->has('text')) {
            return response()->json([], 200);
        }

        // Search the code as well as the name. Names used to hold the code, so
        // typing CSED found the department; now that names are the full title,
        // matching on name alone would return nothing for a code, or worse,
        // match the wrong campus. Superseded codes resolve too, so anyone still
        // typing DOM finds Mathematics.
        $text = trim($request->text);
        $legacyOf = \App\Support\DepartmentCodes::LEGACY_ALIASES[strtoupper($text)] ?? null;

        $departments = Department::where(function ($query) use ($text, $legacyOf) {
                $query->where('name', 'LIKE', '%' . $text . '%')
                    ->orWhere('code', 'LIKE', '%' . $text . '%');

                if ($legacyOf) {
                    $query->orWhere('code', 'LIKE', '%' . $legacyOf . '%');
                }
            })
            ->orderBy('name')
            ->get()
            ->map(function ($department) {
            return [
            'id' => $department->id,
            // Kept as the bare name: the filter bar sends this value back to be
            // matched against departments.name, so decorating it would stop
            // department filters matching anything.
            'name' => $department->name,
            'code' => $department->code,
            ];
        });

        return response()->json($departments);
    }

    public function suggestOutsideExpert(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
        ]);

        if (!$request->has('text')) {
            return response()->json([], 200);
        }

        // Word by word, in any order, for the same reason as suggestFaculty.
        $tokens = preg_split('/[\s.,]+/', trim($request->text), -1, PREG_SPLIT_NO_EMPTY);

        if (empty($tokens)) {
            return response()->json([], 200);
        }

        $expertQuery = OutsideExpert::query();

        foreach ($tokens as $token) {
            $expertQuery->where(function ($query) use ($token) {
                $like = '%' . $token . '%';

                $query->where('first_name', 'LIKE', $like)
                    ->orWhere('last_name', 'LIKE', $like)
                    ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like])
                    ->orWhere('designation', 'LIKE', $like)
                    ->orWhere('email', 'LIKE', $like)
                    ->orWhere('phone', 'LIKE', $like)
                    ->orWhere('institution', 'LIKE', $like);
            });
        }

        $outsideExperts = $expertQuery
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->limit(25)
            ->get()->map(function ($faculty) {
            return [
            'id' => $faculty->id,
            'name' => $faculty->first_name . ' ' . $faculty->last_name,
            'email' => $faculty->email,
            'designation' => $faculty->designation,
            'department' => $faculty->department ?? 'N/A',
            'institution' => $faculty->institution,
            'phone' => $faculty->phone,

            ];
        });

        return response()->json($outsideExperts);
    }

    public function suggestInstitute(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
        ]);

        if (!$request->has('text') || strlen($request->text) < 3) {
            return response()->json([], 200);
        }

        $institutes = OutsideExpert::where('institution', 'LIKE', '%' . $request->text . '%')
            ->get();

        return response()->json($institutes);
    }

    public function suggestCountry(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
        ]);

        if (strlen($request->text) < 1) {
            return response()->json([], 200);
        }

        // Cache the full country list for 24 hours
        $countriesList = Cache::remember('all_countries_list', now()->addHours(24), function () {
            try {
                $response = Http::get('https://restcountries.com/v3.1/all?fields=name,cca2');
                if ($response->successful()) {
                    return collect($response->json())->map(function ($country) {
                        return [
                            'name' => $country['name']['common'],
                            'code' => $country['cca2'],
                        ];
                    })->all();
                }
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error('Country list fetch failed:', ['msg' => $e->getMessage()]);
            }
            return [];
        });

        $filtered = collect($countriesList)->filter(function ($country) use ($request) {
            return stripos($country['name'], $request->text) !== false;
        })->values()->all();

        return response()->json($filtered);
    }
    

    /**
     * Suggest state names based on input text and country code.
     */
    public function suggestState(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'country_code' => 'nullable|string|max:2',
            'country' => 'nullable|string'
        ]);

        if (strlen($request->text) < 1) {
            return response()->json([], 200);
        }

        $countryCode = $request->country_code;
        
        // Fallback: If country_code is missing but country name is provided
        if (!$countryCode && $request->country) {
            $countryName = $request->country;
            $countryCode = Cache::remember("ccode_for_" . md5($countryName), now()->addHours(24), function () use ($countryName) {
                $response = Http::get("https://restcountries.com/v3.1/name/" . urlencode($countryName) . "?fullText=true");
                if ($response->successful()) {
                    return $response->json()[0]['cca2'] ?? null;
                }
                return null;
            });
        }

        if (!$countryCode) {
            \Illuminate\Support\Facades\Log::debug('suggestState: No country code found for ' . ($request->country ?? 'unknown'));
            return response()->json([], 200);
        }

        $apiKey = 'd73532d63bmsh3810e432a029c30p12ba79jsn73893239d31d';
        $countryCode = strtoupper($countryCode);
        $text = strtolower($request->text);
        $cacheKey = "states_{$countryCode}_{$text}";

        $states = Cache::remember($cacheKey, now()->addHours(24), function () use ($apiKey, $countryCode, $text) {
            $response = Http::withHeaders([
                'X-RapidAPI-Key' => $apiKey,
                'X-RapidAPI-Host' => 'wft-geo-db.p.rapidapi.com'
            ])->get("https://wft-geo-db.p.rapidapi.com/v1/geo/countries/{$countryCode}/regions", [
                'namePrefix' => $text
            ]);

            if ($response->failed()) {
                \Illuminate\Support\Facades\Log::error('suggestState GeoDB error:', ['status' => $response->status(), 'body' => $response->body()]);
                return [];
            }
         
            return collect($response->json()['data'] ?? [])->map(function ($state) {
                return [
                    'name' => $state['name'],
                    'code' => $state['isoCode'],
                ];
            })->values()->all();
        });

        return response()->json($states);
    }

    /**
     * Suggest city names based on input text, country code, and state code.
     */
    public function suggestCity(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'country_code' => 'nullable|string|max:2',
            'state_code' => 'nullable|string|max:3',
            'country' => 'nullable|string',
            'state' => 'nullable|string'
        ]);

        if (strlen($request->text) < 1) {
            return response()->json([], 200);
        }

        $countryCode = $request->country_code;
        $stateCode = $request->state_code;

        // Fallback for country code
        if (!$countryCode && $request->country) {
            $countryName = $request->country;
            $countryCode = Cache::remember("ccode_for_" . md5($countryName), now()->addHours(24), function () use ($countryName) {
                $response = Http::get("https://restcountries.com/v3.1/name/" . urlencode($countryName) . "?fullText=true");
                if ($response->successful()) {
                    return $response->json()[0]['cca2'] ?? null;
                }
                return null;
            });
        }

        // Fallback for state code
        if ($countryCode && !$stateCode && $request->state) {
            $apiKey = 'd73532d63bmsh3810e432a029c30p12ba79jsn73893239d31d';
            $stateName = $request->state;
            $stateCode = Cache::remember("scode_for_" . $countryCode . "_" . md5($stateName), now()->addHours(24), function () use ($apiKey, $countryCode, $stateName) {
                $stateResponse = Http::withHeaders([
                    'X-RapidAPI-Key' => $apiKey,
                    'X-RapidAPI-Host' => 'wft-geo-db.p.rapidapi.com'
                ])->get("https://wft-geo-db.p.rapidapi.com/v1/geo/countries/".strtoupper($countryCode)."/regions", [
                    'namePrefix' => $stateName
                ]);

                if ($stateResponse->successful() && !empty($stateResponse->json()['data'])) {
                    return $stateResponse->json()['data'][0]['isoCode'] ?? null;
                }
                return null;
            });
        }

        if (!$countryCode || !$stateCode) {
            \Illuminate\Support\Facades\Log::debug('suggestCity: Codes not found', ['cc' => $countryCode, 'sc' => $stateCode]);
            return response()->json([], 200);
        }

        $apiKey = 'd73532d63bmsh3810e432a029c30p12ba79jsn73893239d31d';
        $countryCode = strtoupper($countryCode);
        $stateCode = strtoupper($stateCode);
        $text = strtolower($request->text);
        $cacheKey = "cities_{$countryCode}_{$stateCode}_{$text}";

        $cities = Cache::remember($cacheKey, now()->addHours(24), function () use ($apiKey, $countryCode, $stateCode, $text) {
            $response = Http::withHeaders([
                'X-RapidAPI-Key' => $apiKey,
                'X-RapidAPI-Host' => 'wft-geo-db.p.rapidapi.com'
            ])->get("https://wft-geo-db.p.rapidapi.com/v1/geo/countries/{$countryCode}/regions/{$stateCode}/cities", [
                'namePrefix' => $text
            ]);

            if ($response->failed()) {
                \Illuminate\Support\Facades\Log::error('suggestCity GeoDB error:', ['status' => $response->status(), 'body' => $response->body()]);
                return [];
            }

            return collect($response->json()['data'] ?? [])->map(function ($city) {
                return [
                    'name' => $city['name'],
                    'id' => $city['id'],
                ];
            })->values()->all();
        });

        return response()->json($cities);
    }
    public function suggestDesignation(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
        ]);

        if (!$request->has('text') || strlen($request->text) < 3) {
            return response()->json([], 200);
        }
        $designations = Faculty::where('designation', 'LIKE', '%' . $request->text . '%')
            ->distinct()
            ->pluck('designation')
            ->map(function ($designation) {
            return [
            'name' => $designation,
            'id' => $designation,
            ];
        });

        return response()->json($designations);
    }

    /**
     * A publication's record, read from its DOI.
     *
     * doi.org's own content negotiation is asked rather than Crossref directly:
     * it answers for DataCite and mEDRA DOIs as well, and returns one flat
     * CSL-JSON record instead of Crossref's envelope. A DOI with nothing
     * registered against it still comes back as a row, so a paper whose
     * publisher deposited no metadata can still be entered by hand.
     */
    public function suggestDoi(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
        ]);

        // A DOI is pasted as "10.1000/xyz", "doi:10.1000/xyz" or the doi.org
        // link, all three of which are the same DOI. The text goes into a URL,
        // so nothing but this shape may reach it.
        $doi = preg_replace('#^(https?://(dx\.)?doi\.org/|doi:)#i', '', trim($request->text));
        if (!preg_match('#^10\.\d{4,9}/\S+$#', $doi)) {
            return response()->json([], 200);
        }

        // Only a record that was found is kept, so a timeout is not remembered
        // as "this DOI has nothing" for the rest of the day.
        $key = 'doi_record_' . strtolower($doi);
        $record = Cache::get($key);
        if ($record === null) {
            $record = $this->fetchDoiRecord($doi);
            if ($record) {
                Cache::put($key, $record, now()->addHours(24));
            }
        }

        return response()->json([$this->doiRow($doi, $record)]);
    }

    /**
     * What doi.org holds for a DOI, as CSL-JSON, or an empty list.
     *
     * The contact address identifies the portal to Crossref, which answers
     * identified callers from a separate pool with a higher rate limit.
     */
    private function fetchDoiRecord(string $doi): array
    {
        $path = implode('/', array_map('rawurlencode', explode('/', $doi)));

        try {
            $response = Http::withHeaders([
                'Accept' => 'application/vnd.citationstyles.csl+json',
                'User-Agent' => config('app.name', 'PhD Monitoring') . ' (mailto:' . config('mail.from.address') . ')',
            ])->timeout(10)->get('https://doi.org/' . $path);

            if (!$response->successful()) {
                return [];
            }

            return is_array($response->json()) ? $response->json() : [];
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('DOI lookup failed', ['doi' => $doi, 'msg' => $e->getMessage()]);
            return [];
        }
    }

    /**
     * One suggestion row: the text the box shows, and the values the form's
     * fields are filled from. A value the record does not carry is left out
     * rather than sent empty, so picking a thin record does not wipe what the
     * scholar has already typed.
     */
    private function doiRow(string $doi, array $record): array
    {
        $first = fn ($value) => is_array($value) ? (string) ($value[0] ?? '') : (string) ($value ?? '');

        $title = $first($record['title'] ?? null);
        $journal = $first($record['container-title'] ?? null);
        $year = data_get($record, 'issued.date-parts.0.0') ?: data_get($record, 'published.date-parts.0.0');

        // The form offers this year and three either side, so a year outside
        // that has no option to land in and is left to be answered.
        $year = $year && abs((int) $year - (int) now()->year) <= 3 ? (string) (int) $year : null;

        $authors = collect($record['author'] ?? [])
            ->map(function ($author) {
                $family = trim((string) ($author['family'] ?? $author['literal'] ?? ''));
                $given = trim((string) ($author['given'] ?? ''));
                // "Bhatia T." - the style the faculty sync already writes.
                return $family === '' ? null : $family . ($given !== '' ? ' ' . mb_substr($given, 0, 1) . '.' : '');
            })
            ->filter()
            ->unique()
            ->implode(', ');

        $values = array_filter([
            'doi' => 'https://doi.org/' . $doi,
            'title' => $title,
            'authors' => $authors,
            'journal' => $journal,
            'volume' => (string) ($record['volume'] ?? ''),
            'page_no' => (string) ($record['page'] ?? ''),
            'year' => $year,
            'issn' => $first($record['ISSN'] ?? null),
            'publisher' => (string) ($record['publisher'] ?? ''),
        ], fn ($value) => $value !== null && $value !== '');

        $shown = $title === ''
            ? $doi . ' (no record found)'
            : $title . ($journal !== '' ? ' - ' . $journal : '') . ($year ? ', ' . $year : '');

        return ['id' => $doi, 'name' => $shown] + $values;
    }
}

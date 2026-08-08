<?php

namespace App\Http\Controllers;

use App\Models\BroadAreaSpecialization;
use App\Models\Department;
use App\Models\ExaminersDetail;
use App\Models\ExaminersRecommendation;
use App\Models\Faculty;
use App\Models\OutsideExpert;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SuggestionController extends Controller
{

    public function suggestSpecialization(Request $request)
    {
        $department = null;
        $loggenInUser = Auth::user();
        if ($loggenInUser->current_role->role == 'student') {
            $department = $loggenInUser->student->department;
        }
        else {
            $department = $loggenInUser->faculty->department;
        }

        $request->validate(
        [
            'text' => 'required|string',
        ]
        );

        $specializations = BroadAreaSpecialization::where('department_id', $department->id)
            ->where('broad_area', 'LIKE', '%' . $request->text . '%')
            ->orderBy('broad_area')
            ->get();
        foreach ($specializations as $specialization) {
            $specialization->name = $specialization->broad_area;
        }
        // Return the specializations as a JSON response
        return response()->json($specializations);

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
        if ($loggenInUser->current_role->role != 'faculty') {
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

        $examinerQuery = ExaminersRecommendation::query();

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
            ->get()
            ->makeHidden('added_by');

        // Return the examiners as a JSON response
        return response()->json($examiners);

    }

    public function suggestFaculty(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'department_id' => 'nullable|integer',
        ]);

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
}
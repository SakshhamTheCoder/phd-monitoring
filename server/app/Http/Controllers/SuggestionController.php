<?php

namespace App\Http\Controllers;

use App\Models\BroadAreaSpecialization;
use App\Models\Department;
use App\Models\ExaminersDetail;
use App\Models\ExaminersRecommendation;
use App\Models\Faculty;
use App\Models\OutsideExpert;
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
            ->get();
        foreach ($specializations as $specialization) {
            $specialization->name = $specialization->broad_area;
        }
        // Return the specializations as a JSON response
        return response()->json($specializations);

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
        $examiners = ExaminersRecommendation::where('name', 'LIKE', '%' . $request->text . '%')
            ->orWhere('email', 'LIKE', '%' . $request->text . '%')
            ->orWhere('phone', 'LIKE', '%' . $request->text . '%')
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

        $facultyQuery = Faculty::with([]) // Include related user and department
            ->whereHas('user', function ($query) use ($request) {
            $query->where('first_name', 'LIKE', '%' . $request->text . '%')
                ->orWhere('last_name', 'LIKE', '%' . $request->text . '%');
        });

        if (!empty($request->department_id)) {
            $department = Department::find($request->department_id);
            if (!$department) {
                return response()->json(['message' => 'Department not found'], 404);
            }
            $facultyQuery->where('department_id', $request->department_id);
        }

        $faculty = $facultyQuery->get()->map(function ($faculty) {
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

        $departments = Department::where('name', 'LIKE', '%' . $request->text . '%')
            ->get()
            ->map(function ($department) {
            return [
            'id' => $department->id,
            'name' => $department->name,
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

        $outsideExperts = OutsideExpert::where('first_name', 'LIKE', '%' . $request->text . '%')
            ->orWhere('last_name', 'LIKE', '%' . $request->text . '%')
            ->orWhere('designation', 'LIKE', '%' . $request->text . '%')
            ->orWhere('email', 'LIKE', '%' . $request->text . '%')
            ->orWhere('phone', 'LIKE', '%' . $request->text . '%')
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
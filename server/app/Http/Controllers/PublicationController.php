<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\Patent;
use App\Models\Publication;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class PublicationController extends Controller
{
    /**
     * Display a listing of the publications.
     *
     * @return \Illuminate\Http\Response
     */
    use SaveFile;
    use FilterLogicTrait;

    public function listFilters(Request $request)
    {
        return response()->json($this->getAvailableFilters("publications"));
    }

    public function get(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role->role;
        if ($role != 'student') {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $id = $user->student->roll_no;
        $publicationsQuery = Publication::where('student_id', $id)->where('form_id', null);
        $patents = Patent::where('student_id', $id)->get()->where('form_id', null);

        $ret = [
            'sci' => $publicationsQuery->clone()->where('publication_type', 'journal')->where('type', 'sci')->get(),
            'non_sci' => $publicationsQuery->clone()->where('publication_type', 'journal')->where('type', 'non-sci')->get(),
            'national' => $publicationsQuery->clone()->where('publication_type', 'conference')->where('type', 'national')->get(),
            'international' => $publicationsQuery->clone()->where('publication_type', 'conference')->where('type', 'international')->get(),
            'book' => $publicationsQuery->clone()->where('publication_type', 'book')->get(),
            'patents' => $patents
        ];

        return response()->json($ret);
    }
    /**
     * Store a newly created publication in storage.
     *
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        \Illuminate\Support\Facades\Log::info('Store Publication Request:', $request->all());
        try {
            $user = Auth::user();
            $role = $user->current_role->role;
            if ($role != 'student') {
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
            }
            $id = $user->student->roll_no;

            $validator = Validator::make($request->all(), [
                'title' => 'required|string|max:255',
                'publication_type' => ['required', 'in:journal,conference,book'],
                'authors' => 'required|string',
                'status' => 'required|in:published,accepted',
                'doi_link' => 'required|string',
                'first_page' => 'required|file|mimes:pdf|max:15360',
                'year' => 'required|string',
                'name' => 'required|string'
            ]);

            if ($validator->fails()) {
                \Illuminate\Support\Facades\Log::error('Validation failed:', $validator->errors()->toArray());
                return response()->json(['errors' => $validator->errors()], 400);
            }

            $authors = $request->authors;
            if (str_contains($authors, ';')) {
                return response()->json([
                    'errors' => [
                        'authors' => 'Please use commas (,) instead of semicolons (;) to separate authors.'
                    ]
                ], 400);
            }

            $publication = new Publication();
            $publication->student_id = $user->student->roll_no;
            $publication->publication_type = $request->publication_type;
            $publication->title = $request->title;
            $publication->authors = $request->authors;
            $publication->doi_link = $request->doi_link;
            $publication->year = (int)$request->year;
            $publication->name = $request->name;
            $publication->status = $request->status;

            $link = $this->saveUploadedFile($request->first_page, 'publication', $user->student->roll_no);
            $publication->first_page = $link;

            switch ($request->publication_type) {
                case 'journal':
                    $request->validate([
                        'impact_factor' => 'required|numeric',
                        'type' => 'required|in:sci,non-sci',
                        'volume' => 'required|string',
                        'page_no' => 'required|string',
                    ]);
                    $publication->volume = $request->volume;
                    $publication->page_no = $request->page_no;
                    $publication->impact_factor = $request->impact_factor;
                    $publication->type = $request->type;
                    break;
                case 'conference':
                    $request->validate([
                        'country' => 'required|string',
                        'state' => 'required|string',
                        'city' => 'required|string',
                        'type' => 'required|in:national,international'
                    ]);
                    $publication->country = $request->country;
                    $publication->state = $request->state;
                    $publication->city = $request->city;
                    $publication->type = $request->type;
                    break;
                case 'book':
                    $request->validate([
                        'issn' => 'required|string',
                        'volume' => 'required|string',
                        'page_no' => 'required|string',
                        'publisher' => 'required|string',
                    ]);
                    $publication->issn = $request->issn;
                    $publication->volume = $request->volume;
                    $publication->page_no = $request->page_no;
                    $publication->publisher = $request->publisher;
                    break;
            }

            $publication->save();
            \Illuminate\Support\Facades\Log::info('Publication stored successfully:', $publication->toArray());
            return response()->json($publication, 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            \Illuminate\Support\Facades\Log::error('Publication validation failed (inner):', $e->errors());
            return response()->json(['errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Publication store error:', ['message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Internal server error'], 500);
        }
    }

    /**
     * Display the specified publication.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show($id)
    {
        $publication = Publication::find($id);

        if (!$publication) {
            return response()->json(['error' => 'Publication not found'], 404);
        }

        return response()->json($publication);
    }

    /**
     * Update the specified publication in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, $id)
    {
        \Illuminate\Support\Facades\Log::info('Update Publication Request:', array_merge($request->all(), ['id' => $id]));
        try {
            $publication = Publication::find($id);
            if (!$publication) {
                return response()->json(['error' => 'Publication not found'], 404);
            }

            $user = Auth::user();
            $role = $user->current_role->role;
            if ($role != 'student' || $publication->student_id != $user->student->roll_no) {
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
            }

            $validator = Validator::make($request->all(), [
                'title' => 'required|string|max:255',
                'publication_type' => ['required', 'in:journal,conference,book'],
                'authors' => 'required|string',
                'status' => 'required|in:published,accepted',
                'doi_link' => 'required|string',
                'first_page' => 'nullable|file|mimes:pdf|max:15360',
                'year' => 'required|string',
                'name' => 'required|string'
            ]);

            if ($validator->fails()) {
                \Illuminate\Support\Facades\Log::error('Update validation failed:', $validator->errors()->toArray());
                return response()->json(['errors' => $validator->errors()], 400);
            }

            $authors = $request->authors;
            if (str_contains($authors, ';')) {
                return response()->json([
                    'errors' => [
                        'authors' => 'Please use commas (,) instead of semicolons (;) to separate authors.'
                    ]
                ], 400);
            }

            $publication->publication_type = $request->publication_type;
            $publication->title = $request->title;
            $publication->authors = $request->authors;
            $publication->doi_link = $request->doi_link;
            $publication->year = (int)$request->year;
            $publication->name = $request->name;
            $publication->status = $request->status;

            if ($request->hasFile('first_page')) {
                $link = $this->saveUploadedFile($request->first_page, 'publication', $user->student->roll_no);
                $publication->first_page = $link;
            }

            switch ($request->publication_type) {
                case 'journal':
                    $request->validate([
                        'impact_factor' => 'required|numeric',
                        'type' => 'required|in:sci,non-sci',
                        'volume' => 'required|string',
                        'page_no' => 'required|string',
                    ]);
                    $publication->volume = $request->volume;
                    $publication->page_no = $request->page_no;
                    $publication->impact_factor = $request->impact_factor;
                    $publication->type = $request->type;
                    break;
                case 'conference':
                    $request->validate([
                        'country' => 'required|string',
                        'state' => 'required|string',
                        'city' => 'required|string',
                        'type' => 'required|in:national,international'
                    ]);
                    $publication->country = $request->country;
                    $publication->state = $request->state;
                    $publication->city = $request->city;
                    $publication->type = $request->type;
                    break;
                case 'book':
                    $request->validate([
                        'issn' => 'required|string',
                        'volume' => 'required|string',
                        'page_no' => 'required|string',
                        'publisher' => 'required|string',
                    ]);
                    $publication->issn = $request->issn;
                    $publication->volume = $request->volume;
                    $publication->page_no = $request->page_no;
                    $publication->publisher = $request->publisher;
                    break;
            }

            $publication->save();
            \Illuminate\Support\Facades\Log::info('Publication updated successfully:', $publication->toArray());
            return response()->json($publication, 200);

        } catch (\Illuminate\Validation\ValidationException $e) {
            \Illuminate\Support\Facades\Log::error('Publication update validation failed (inner):', $e->errors());
            return response()->json(['errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Publication update error:', ['message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Internal server error'], 500);
        }
    }


}
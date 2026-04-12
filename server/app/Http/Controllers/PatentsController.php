<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\Patent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class PatentsController extends Controller
{
    use SaveFile;
    use FilterLogicTrait;
    /**
     * Display a listing of the patents.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        $patents = Patent::all();
        return response()->json($patents);
    }

    public function listFilters(Request $request)
    {
        return response()->json($this->getAvailableFilters("patents"));
    }
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'authors' => 'required|string',
            'status' => 'required|in:filed,published,granted',
            'doi_link' => 'required|string',
            'first_page' => 'required|file|mimes:pdf|max:15360',
            'year' => 'required|string',
            'country' => 'required|in:National,International'
        ]);
        $user = Auth::user();
        $role = $user->current_role->role;
        if ($role != 'student') {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }
        $patents = new Patent();
        $patents->student_id = $user->student->roll_no;
        $patents->title = $request->title;
        $patents->authors = $request->authors;
        $patents->doi_link = $request->doi_link;
        $patents->year = $request->year;
        $patents->country = $request->country;
        $patents->status = $request->status;
        $file = $this->saveUploadedFile($request->file('first_page'), 'patents', $patents->student_id);
        $patents->first_page = $file;
        $patents->save();
        return response()->json(['message' => 'Patent added successfully'], 201);

    }

    public function show($id)
    {
        $patents = Patent::find($id);
        if ($patents) {
            return response()->json($patents);
        }
        return response()->json(['message' => 'Patent not found'], 404);
    }

    public function update(Request $request, $id)
    {
        $patents = Patent::find($id);
        if ($patents) {
            $validator = Validator::make($request->all(), [
                'title' => 'required|string|max:255',
                'authors' => 'required|string',
                'status' => 'required|in:filed,published,granted',
                'doi_link' => 'required|string',
                'first_page' => 'nullable|file|mimes:pdf|max:15360',
                'year' => 'required|string',
                'country' => 'required|in:National,International'
            ]);
            $user = Auth::user();
            $role = $user->current_role->role;
            if ($role != 'student' || $patents->student_id != $user->student->roll_no) {
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
            }
            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 400);
            }
            $patents->title = $request->title;
            $patents->authors = $request->authors;
            $patents->doi_link = $request->doi_link;
            $patents->year = $request->year;
            $patents->country = $request->country;
            $patents->status = $request->status;

            if ($request->hasFile('first_page')) {
                $file = $this->saveUploadedFile($request->file('first_page'), 'patents', $patents->student_id);
                $patents->first_page = $file;
            }

            $patents->save();
            return response()->json(['message' => 'Patent updated successfully'], 200);
        }
        return response()->json(['message' => 'Patent not found'], 404);
    }

}
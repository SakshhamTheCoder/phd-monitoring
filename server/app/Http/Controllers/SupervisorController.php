<?php
namespace App\Http\Controllers;

use App\Models\DoctoralCommittee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use PhpParser\Comment\Doc;

class SupervisorController extends Controller
{

    public function assign(Request $request)
    {
        $loggenInUser = Auth::user();
        if(!$loggenInUser->may('can_manage_supervisor_records')){
            return response()->json([
                'message' => 'You do not have permission to create supervisor'
            ], 403);
        }

        $request->validate(
            [
                'student_id' => 'required|integer',
                'faculty_id' => 'required|integer',
            ]
        );
        $supervisor = new \App\Models\Supervisor();
        // $supervisor->name = $request->name;
        $supervisor->student_id = $request->student_id;
        $supervisor->faculty_id = $request->faculty_id;
        // $supervisor->department_id = $request->department_id;
        $supervisor->save();

        return response()->json([
            'message' => 'Supervisor added successfully'
        ], 200);
    }

    public function showAssignForm()
{
    $loggedInUser = Auth::user();
    $errors=[];

    return view('assign');
}


    public function assignDoctoral(Request $request)
    {
        $loggenInUser = Auth::user();
        if(!$loggenInUser->may('can_manage_supervisor_records')){
            return response()->json([
                'message' => 'You do not have permission to create supervisor'
            ], 403);
        }

        $request->validate(
            [
                'student_id' => 'required|integer',
                'faculty_id' => 'required|integer',
            ]
        );
       
        $doc= DoctoralCommittee::create([
            'student_id' => $request->student_id,
            'faculty_id' => $request->faculty_id,
        ]);
        
        return response()->json([
            'message' => 'Doctoral added successfully'
            
        ], 200);
    }
}
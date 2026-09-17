<?php
namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use App\Models\Forms;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\Patent;
use App\Models\Publication;
use App\Models\ThesisSubmission;


class UserController extends Controller{
    public function list(Request $request){
        $user = Auth::user();
        return response()->json($user);
    }
    use FilterLogicTrait;
    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("forms"));
    }

    public function listForms(Request $request, $roll_no = null){
        $user = Auth::user();
        $role = $user->current_role;
        $data = null;
        switch ($role->role) {
            case 'student':
                $data = $user->student->forms();
                break;
            case 'hod':
            case 'phd_coordinator':
            case 'adordc':
            case 'faculty':
            case 'external':
            case 'doctoral':
                $data = $user->faculty->forms($roll_no);
                break;
            // Most institute officer accounts have no faculty row, and their
            // branches of Faculty::forms() read only the acting role, so an
            // unsaved Faculty carrying the user answers the same.
            case 'dra':
            case 'dordc':
            case 'director':
                $faculty = $user->faculty ?? (new \App\Models\Faculty())->setRelation('user', $user);
                $data = $faculty->forms($roll_no);
                break;
            // Every branch above reads a per-role `<role>_available` column,
            // and there is no admin one: an admin is not a step in any chain,
            // which is why they fell through to the 403 below and the profile's
            // View Forms page refused them. They read the lot instead.
            case 'admin':
                if (!$roll_no) {
                    return response()->json(['message' => 'Open a scholar to read their forms'], 422);
                }
                $data = Forms::where('student_id', $roll_no)->get()
                    ->each(fn ($form) => $form['action_required'] = false);
                break;
            default:
                return $this->refuse();
        }
        return response()->json($data, 200);
    }


}
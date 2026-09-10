<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use App\Models\Role;

class RolesController extends Controller {
    public function add(Request $request){
        $request->validate(
            [
                'role' => 'required|string',
            ]
        );
        $role = new Role();
        $role->role = $request->role;
        $role->can_read_all_students = $request->can_read_all_students;
        $role->can_read_all_faculties = $request->can_read_all_faculties;
        $role->can_read_supervised_students = $request->can_read_supervised_students;
        $role->can_read_department_students = $request->can_read_department_students;
        $role->can_read_department_faculties = $request->can_read_department_faculties;
        $role->can_edit_all_students = $request->can_edit_all_students;
        $role->can_edit_all_faculties = $request->can_edit_all_faculties;
        $role->can_edit_department_students = $request->can_edit_department_students;
        $role->can_edit_department_faculties = $request->can_edit_department_faculties;
        $role->can_edit_own_profile = $request->can_edit_own_profile;
        $role->can_edit_phd_title = $request->can_edit_phd_title;
        $role->can_add_department_students = $request->can_add_department_students;
        $role->can_add_department_faculties = $request->can_add_department_faculties;
        $role->can_manage_faculties = $request->can_manage_faculties;
        $role->can_manage_students = $request->can_manage_students;
        $role->can_read_supervisors = $request->can_read_supervisors;
        $role->can_read_doctoral_committee = $request->can_read_doctoral_committee;
        $role->can_edit_supervisors = $request->can_edit_supervisors;
        $role->can_edit_doctoral_committee = $request->can_edit_doctoral_committee;
        $role->can_delete_department_students = $request->can_delete_department_students;
        $role->can_delete_department_faculties = $request->can_delete_department_faculties;
        $role->can_delete_faculties = $request->can_delete_faculties;
        $role->can_delete_students = $request->can_delete_students;
        $role->can_manage_roles = $request->can_manage_roles;
        $role->can_edit_department = $request->can_edit_department;
        $role->can_add_department = $request->can_add_department;
              
        
        $role->save();
        return response()->json([
            'message' => 'Role added successfully'
        ], 200);
    }
}
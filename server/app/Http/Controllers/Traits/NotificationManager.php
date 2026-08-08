<?php
namespace App\Http\Controllers\Traits;

use App\Models\Faculty;
use App\Models\Notifications;
use App\Models\Role;
use App\Models\User;

trait NotificationManager
{
    public function sendNotification($user, $title, $body, $link, $role_id = null, $email_req = false)
    {
        if(!$role_id){
            $role_id=$user->role_id;
        }
        $notification = new Notifications();
        $notification->user_id = $user->id;
        // Ensure the first character is capitalised (titles are built from
        // lowercase form-type slugs). Only affects newly-created notifications.
        $notification->title = $title === null ? $title : ucfirst($title);
        $notification->body = $body === null ? $body : ucfirst($body);
        $notification->link = $link;
        $notification->role_id = $role_id;
        $notification->email_req = $email_req;
        $notification->save();
    }

    public function formNotification($student, $title, $body, $link, $role, $email_req = false)
    {
        
        switch ($role) {
            case 'faculty':
                $this->sendSupervisorNotification($student, $title, $body, $link, $email_req);
                break;
            case 'doctoral':
            case 'external':
                $this->sendDoctoralNotification($student, $title, $body, $link, $email_req);
                    break;
            case 'phd_coordinator':
                $this->phdCoordinatorNotification($student, $title, $body, $link, $email_req);
                break;

            case 'hod':
                $this->sendHodNotification($student, $title, $body, $link, $email_req);
                break;

            case 'dordc':
                $this->sendDordcNotification($student, $title, $body, $link, $email_req);
                break;

            case 'dra':
                $this->sendDraNotification($student, $title, $body, $link, $email_req);
                break;

            case 'director':
                $this->sendDirectorNotification($student, $title, $body, $link, $email_req);
                break;

            case 'adordc':
                $this->sendAdordcNotification($student, $title, $body, $link, $email_req);
                break;

            default:
                break;
         }
         $this->sendStudentNotification($student, $title, "Your Form has moved to ".$role .", ". $body, $link, $email_req);
    }
    private function sendStudentNotification($student,$title,$body,$link,$email_req=false){
        $user=$student->user;
        $this->sendNotification($user,$title,$body,$link,null,$email_req);
    }

    private function sendSupervisorNotification($student,$title,$body,$link,$email_req=false){
        $supervisors=$student->supervisors;
        $role_id=Role::where('role','faculty')->first()->id;
        foreach ($supervisors as $supervisor) {
            $faculty=Faculty::where('faculty_code',$supervisor->faculty_code)->first();
            $user=$faculty->user;
            $this->sendNotification($user,$title,$body,$link,$role_id,$email_req);
        }
    }
    private function sendDoctoralNotification($student,$title,$body,$link,$email_req=false){
        $doctoral=$student->doctoralCommittee;
        $role_id=Role::where('role','doctoral')->first()->id;
        foreach ($doctoral as $doctoral) {
            $faculty=Faculty::where('faculty_code',$doctoral->faculty_code)->first();
            $user=$faculty->user;
            $this->sendNotification($user,$title,$body,$link,$role_id,$email_req);
        }
    }
    private function sendHodNotification($student,$title,$body,$link,$email_req=false){
        $hod=$student->department->hod;
        $user=$hod->user;
        $this->sendNotification($user,$title,$body,$link,null,$email_req);
    }
    private function phdCoordinatorNotification($student,$title,$body,$link,$email_req=false){
        $phdCoordinator=$student->department->phdCoordinators;
      
        foreach ($phdCoordinator as $phdCoordinator) {
            $faculty=Faculty::where('faculty_code',$phdCoordinator->faculty_id)->first();
            $user= $faculty->user;
            $this->sendNotification($user,$title,$body,$link,null,$email_req);
        }
    }
    
    private function sendDordcNotification($student,$title,$body,$link,$email_req=false){
        $this->notifyRoleHolders('dordc',$title,$body,$link,$email_req);
    }
    private function sendDraNotification($student,$title,$body,$link,$email_req=false){
        $this->notifyRoleHolders('dra',$title,$body,$link,$email_req);
    }
    private function sendDirectorNotification($student,$title,$body,$link,$email_req=false){
        $this->notifyRoleHolders('director',$title,$body,$link,$email_req);
    }

    /**
     * Notify the ADORDC of the student's department (department-scoped, unlike the
     * institute-wide roles). Tagged with the adordc role id for active-role filtering.
     */
    private function sendAdordcNotification($student,$title,$body,$link,$email_req=false){
        $adordc=$student->department?->adordc;
        if(!$adordc || !$adordc->user){
            return;
        }
        $role=Role::where('role','adordc')->first();
        $this->sendNotification($adordc->user,$title,$body,$link,$role?->id,$email_req);
    }

    /**
     * Notify every user whose primary role is the given institute-wide role
     * (dra / dordc / director). Tags each notification with that role's id so it
     * shows up only when the recipient is acting in that role.
     */
    private function notifyRoleHolders($roleName,$title,$body,$link,$email_req=false){
        $role=Role::where('role',$roleName)->first();
        if(!$role){
            return;
        }
        $users=User::where('role_id',$role->id)->get();
        foreach($users as $user){
            $this->sendNotification($user,$title,$body,$link,$role->id,$email_req);
        }
    }
    

}
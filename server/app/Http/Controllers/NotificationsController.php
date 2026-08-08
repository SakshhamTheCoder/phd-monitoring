<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\SaveFile;
use App\Models\Patent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class NotificationsController extends Controller
{
    public function unreadNotifications()
    {
        $user = Auth::user();
        // Only show notifications relevant to the role the user is currently acting as,
        // plus role-agnostic (common) ones that have no specific role.
        $activeRoleId = $user->current_role_id ?? $user->role_id;
        $notifications = $user->notifications
            ->where('is_read', false)
            ->filter(function ($n) use ($activeRoleId) {
                return is_null($n->role_id) || $n->role_id == $activeRoleId;
            });
        $ret=[];
        foreach($notifications as $notification)
        {
            $ret[]=[
                'id'=>$notification->id,
                // Capitalise on read so existing lowercase notifications also display correctly.
                'title'=>ucfirst((string) $notification->title),
                'body'=>ucfirst((string) $notification->body),
                'link'=>$notification->link,
                'created_at'=>$notification->created_at,
                'role'=>$notification->role?->role
            ];
        }
        return response()->json($ret);
    }

    public function markAsRead($id)
    {
        $user = Auth::user();
        $notification = $user->notifications->find($id);
        if ($notification) {
            $notification->is_read = true;
            $notification->save();
            return response()->json(['message' => 'Notification marked as read']);
        }
        return response()->json(['message' => 'Notification not found'], 404);
    }

    public function markAllAsRead()
    {
        $user = Auth::user();
        $user->notifications()->where('is_read', false)->update(['is_read' => true]);
        return response()->json(['message' => 'All notifications marked as read']);
    }

    public function deleteNotification($id)
    {
        $user = Auth::user();
        $notification = $user->notifications->find($id);
        if ($notification) {
            $notification->delete();
            return response()->json(['message' => 'Notification deleted']);
        }
        return response()->json(['message' => 'Notification not found'], 404);
    }

    public function allNotifications()
    {
        $user = Auth::user();
        // Only show notifications relevant to the role the user is currently acting as,
        // plus role-agnostic (common) ones that have no specific role.
        $activeRoleId = $user->current_role_id ?? $user->role_id;
        $notifications = $user->notifications->filter(function ($n) use ($activeRoleId) {
            return is_null($n->role_id) || $n->role_id == $activeRoleId;
        });
        $ret=[];
        foreach($notifications as $notification)
        {
            $ret[]=[
                'id'=>$notification->id,
                // Capitalise on read so existing lowercase notifications also display correctly.
                'title'=>ucfirst((string) $notification->title),
                'body'=>ucfirst((string) $notification->body),
                'link'=>$notification->link,
                'is_read'=>$notification->is_read,
                'created_at'=>$notification->created_at,
                'role'=>$notification->role?->role
            ];
        }
        return response()->json($ret);
    }
    
}
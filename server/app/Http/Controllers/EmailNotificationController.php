<?php

namespace App\Http\Controllers;

use App\Services\EmailService;
use Illuminate\Http\Request;

class EmailNotificationController extends Controller
{
    protected $emailService;
    
    public function __construct(EmailService $emailService)
    {
        $this->emailService = $emailService;
    }
    
    public function scheduleReminder(Request $request)
    {
        // Example of scheduled email
        $success = $this->emailService->sendEmail(
            $request->input('email'),
            'reminder',
            [
                'event' => $request->input('event'),
                'details' => $request->input('details')
            ],
            true,  // Scheduled
            $request->input('send_at'), // Format: '2025-04-15 14:30:00'
            "Reminder: {$request->input('event')}"
        );
        
        return response()->json(['success' => $success]);
    }
}
<?php

namespace App\Services;

use App\Mail\TemplatedEmail;
use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;
use Exception;
use Illuminate\Support\Facades\Log;

class EmailService
{
    /**
     * Send an email with the specified template and data using Gmail SMTP
     * 
     * @param string|array $to Recipient email address(es)
     * @param string $templateName The name of the email template to use
     * @param array $data Data to pass to the email template
     * @param bool $scheduled Whether the email should be scheduled
     * @param string|null $scheduledTime When to send the email (if scheduled), in format 'Y-m-d H:i:s'
     * @param string|null $subject Optional email subject (overrides template default)
     * @param array $attachments Optional array of file paths to attach
     * @return bool Whether the operation was successful
     */
    public function sendEmail(
        $to, 
        string $templateName, 
        array $data = [], 
        bool $scheduled = false, 
        ?string $scheduledTime = null,
        ?string $subject = null,
        array $attachments = []
    ): bool {
        try {
            // Ensure Gmail SMTP configuration is used
            config([
                'mail.default' => 'smtp',
                'mail.mailers.smtp.host' => 'smtp.gmail.com',
                'mail.mailers.smtp.port' => 587,
                'mail.mailers.smtp.encryption' => 'tls',
                // The credentials stay as config/mail.php read them from .env.
                // Repeating them here with env() read null once the deploy
                // cached the configuration, which left SMTP unauthenticated.
            ]);
            
            // Create the mailable
            $email = new TemplatedEmail($templateName, $data, $subject);
            
            // Add attachments if any
            foreach ($attachments as $attachment) {
                $email->attach($attachment);
            }
            
            // If scheduled, use Laravel's built-in scheduling
            if ($scheduled && $scheduledTime) {
                $sendAt = Carbon::parse($scheduledTime);
                Log::error("Inside me: { $scheduledTime}");
                
                // Make sure the scheduled time is in the future
                if ($sendAt->isPast()) {
                    Log::error("Cannot schedule email for past time: {$scheduledTime}");
                    return false;
                }
                
                // Calculate the delay for the email
                $delay = $sendAt->diffInSeconds(Carbon::now());
                
                Mail::to($to)->later(now()->addSeconds($delay), $email);
                Log::info("Current Time: " . Carbon::now()->toDateTimeString());
                
                Log::info("Email scheduled for {$scheduledTime} to " . (is_array($to) ? implode(', ', $to) : $to));
                return true;
            }
            
            // Otherwise send immediately
            Mail::to($to)->send($email);
            
            Log::info("Email sent immediately to " . (is_array($to) ? implode(', ', $to) : $to));
            return true;
        } catch (Exception $e) {
            Log::error("Failed to send/schedule email: " . $e->getMessage());
            return false;
        }
    }
}
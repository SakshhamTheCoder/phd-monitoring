<?php

namespace App\Helpers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CloudflareHelper
{
    public static function verifyCaptcha($token)
    {
        $secretKey = config('services.cloudflare.secret_key');
        
        if (!$secretKey) {
            Log::warning('Cloudflare secret key not configured');
            return false;
        }

        try {
            $response = Http::asForm()->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                'secret' => $secretKey,
                'response' => $token,
            ]);

            $result = $response->json();
            
            if (isset($result['success']) && $result['success'] === true) {
                return true;
            }

            Log::warning('Cloudflare captcha verification failed', ['result' => $result]);
            return false;
        } catch (\Exception $e) {
            Log::error('Cloudflare captcha verification error: ' . $e->getMessage());
            return false;
        }
    }
}

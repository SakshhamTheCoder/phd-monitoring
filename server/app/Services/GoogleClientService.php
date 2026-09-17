<?php

namespace App\Services;

use Google_Client;
use Google_Service_Calendar;
use Illuminate\Support\Facades\Storage;

class GoogleClientService
{
    public function getClient()
    {
        $client = new Google_Client();
        $client->setApplicationName('PhD Presentation Scheduler');
        // config(), not env(): the deploy caches the configuration, and a
        // cached configuration stops Laravel from loading .env at all, so
        // every env() outside config/ read null in production.
        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri(config('services.google.redirect'));
        $client->setAccessType('offline');
        $client->setScopes([\Google_Service_Calendar::CALENDAR]);

        // Load previously authorized token from storage.
        if (Storage::exists('google-token.json')) {
            $accessToken = json_decode(Storage::get('google-token.json'), true);
            $client->setAccessToken($accessToken);

            // Refresh the token if it's expired
            if ($client->isAccessTokenExpired()) {
                if ($client->getRefreshToken()) {
                    $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                    Storage::put('google-token.json', json_encode($client->getAccessToken()));
                }
            }
        }

        return $client;
    }
}

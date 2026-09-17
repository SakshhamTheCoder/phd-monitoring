<?php

namespace App\Services;

use Carbon\Carbon;
use Google_Client;
use Illuminate\Support\Facades\Storage;
use Google_Service_Calendar;
use Google_Service_Calendar_Event;

class PresentationService
{
    public static function scheduleCalendarEvent(string $title,string $description, string $date, string $time, array $participants = []): array
    {
        $client = self::getGoogleClient();
        $service = new Google_Service_Calendar($client);

        $start = Carbon::parse("{$date} {$time}", 'Asia/Kolkata');
        $end = $start->copy()->addHour();

        $event = new Google_Service_Calendar_Event([
            'summary' => $title,
            'description' => $description ?? 'PhD Presentation Scheduled via Portal',
            'start' => [
                'dateTime' => $start->toRfc3339String(),
                'timeZone' => 'Asia/Kolkata',
            ],
            'end' => [
                'dateTime' => $end->toRfc3339String(),
                'timeZone' => 'Asia/Kolkata',
            ],
            'attendees' => array_map(function ($email, $index) {
                return [
                    'email' => $email,
                    'optional' => false,
                    'organizer' => $index === 0
                ];
            }, $participants, array_keys($participants)),
            'conferenceData' => [
                'createRequest' => [
                    'requestId' => uniqid(),
                    'conferenceSolutionKey' => ['type' => 'hangoutsMeet'],
                ],
            ],
        ]);

        $created = $service->events->insert('primary', $event, [
            'conferenceDataVersion' => 1,
            'sendUpdates' => 'all',
        ]);

        return [
            'event_link' => $created->htmlLink,
            'meet_link' => optional($created->getConferenceData()->getEntryPoints())[0]->uri ?? null,
        ];
    }

    private static function getGoogleClient(): Google_Client
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
        $client->setScopes([Google_Service_Calendar::CALENDAR]);

        if (Storage::exists('google-token.json')) {
            $token = json_decode(Storage::get('google-token.json'), true);
            $client->setAccessToken($token);

            if ($client->isAccessTokenExpired() && $client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                Storage::put('google-token.json', json_encode($client->getAccessToken()));
            }
        }

        return $client;
    }
}

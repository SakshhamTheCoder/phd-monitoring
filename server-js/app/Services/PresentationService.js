import { google } from 'googleapis';
import GoogleClientService from './GoogleClientService.js';

/**
 * PresentationService - Handles Google Calendar event scheduling with Meet links
 * Ported from PHP Laravel's App\Services\PresentationService
 */
class PresentationService {
    /**
     * Schedule a calendar event with Google Meet link
     * 
     * @param {string} title - Event title
     * @param {string} description - Event description
     * @param {string} date - Date in 'YYYY-MM-DD' format
     * @param {string} time - Time in 'HH:mm' or 'HH:mm:ss' format
     * @param {string[]} participants - Array of participant email addresses
     * @returns {Promise<{event_link: string, meet_link: string|null}>}
     */
    static async scheduleCalendarEvent(title, description, date, time, participants = []) {
        const client = await GoogleClientService.getClient();
        const calendar = google.calendar({ version: 'v3', auth: client });

        // Parse the date and time (Asia/Kolkata timezone like in Laravel)
        const startDateTime = new Date(`${date}T${time}`);
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // Add 1 hour

        // Format attendees
        const attendees = participants.map((email, index) => ({
            email: email,
            optional: false,
            organizer: index === 0
        }));

        const event = {
            summary: title,
            description: description || 'PhD Presentation Scheduled via Portal',
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'Asia/Kolkata',
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'Asia/Kolkata',
            },
            attendees: attendees,
            conferenceData: {
                createRequest: {
                    requestId: `phd-presentation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            },
        };

        try {
            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: event,
                conferenceDataVersion: 1,
                sendUpdates: 'all',
            });

            const createdEvent = response.data;

            // Extract Meet link from conference data
            let meetLink = null;
            if (createdEvent.conferenceData && 
                createdEvent.conferenceData.entryPoints && 
                createdEvent.conferenceData.entryPoints.length > 0) {
                const videoEntry = createdEvent.conferenceData.entryPoints.find(
                    ep => ep.entryPointType === 'video'
                );
                meetLink = videoEntry ? videoEntry.uri : null;
            }

            return {
                event_link: createdEvent.htmlLink,
                meet_link: meetLink,
            };
        } catch (error) {
            console.error('Failed to create calendar event:', error.message);
            throw error;
        }
    }

    /**
     * Update an existing calendar event
     * 
     * @param {string} eventId - Google Calendar event ID
     * @param {object} updates - Fields to update
     * @returns {Promise<object>}
     */
    static async updateCalendarEvent(eventId, updates) {
        const client = await GoogleClientService.getClient();
        const calendar = google.calendar({ version: 'v3', auth: client });

        try {
            const response = await calendar.events.patch({
                calendarId: 'primary',
                eventId: eventId,
                resource: updates,
                sendUpdates: 'all',
            });

            return response.data;
        } catch (error) {
            console.error('Failed to update calendar event:', error.message);
            throw error;
        }
    }

    /**
     * Delete a calendar event
     * 
     * @param {string} eventId - Google Calendar event ID
     * @returns {Promise<void>}
     */
    static async deleteCalendarEvent(eventId) {
        const client = await GoogleClientService.getClient();
        const calendar = google.calendar({ version: 'v3', auth: client });

        try {
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: eventId,
                sendUpdates: 'all',
            });
        } catch (error) {
            console.error('Failed to delete calendar event:', error.message);
            throw error;
        }
    }

    /**
     * Get calendar event by ID
     * 
     * @param {string} eventId - Google Calendar event ID
     * @returns {Promise<object|null>}
     */
    static async getCalendarEvent(eventId) {
        const client = await GoogleClientService.getClient();
        const calendar = google.calendar({ version: 'v3', auth: client });

        try {
            const response = await calendar.events.get({
                calendarId: 'primary',
                eventId: eventId,
            });

            return response.data;
        } catch (error) {
            console.error('Failed to get calendar event:', error.message);
            return null;
        }
    }
}

export default PresentationService;

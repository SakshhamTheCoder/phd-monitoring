import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GoogleClientService - Handles Google OAuth2 client management
 * Ported from PHP Laravel's App\Services\GoogleClientService
 */
class GoogleClientService {
    constructor() {
        this.tokenPath = path.join(__dirname, '../../storage/app/google-token.json');
    }

    /**
     * Get configured Google OAuth2 client
     * @returns {Promise<google.auth.OAuth2>}
     */
    async getClient() {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Load previously authorized token from storage
        if (fs.existsSync(this.tokenPath)) {
            try {
                const tokenContent = fs.readFileSync(this.tokenPath, 'utf8');
                const accessToken = JSON.parse(tokenContent);
                oauth2Client.setCredentials(accessToken);

                // Check if token is expired and refresh if needed
                if (this.isTokenExpired(accessToken)) {
                    if (accessToken.refresh_token) {
                        const { credentials } = await oauth2Client.refreshAccessToken();
                        oauth2Client.setCredentials(credentials);
                        
                        // Save the new token
                        this.saveToken(credentials);
                    }
                }
            } catch (error) {
                console.error('Error loading Google token:', error.message);
            }
        }

        return oauth2Client;
    }

    /**
     * Check if token is expired
     * @param {object} token 
     * @returns {boolean}
     */
    isTokenExpired(token) {
        if (!token.expiry_date) return false;
        return Date.now() >= token.expiry_date;
    }

    /**
     * Save token to storage
     * @param {object} token 
     */
    saveToken(token) {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.tokenPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.tokenPath, JSON.stringify(token));
        } catch (error) {
            console.error('Error saving Google token:', error.message);
        }
    }

    /**
     * Generate OAuth2 authorization URL
     * @returns {string}
     */
    getAuthUrl() {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/calendar'],
            prompt: 'consent'
        });
    }

    /**
     * Exchange authorization code for tokens
     * @param {string} code 
     * @returns {Promise<object>}
     */
    async getTokenFromCode(code) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        const { tokens } = await oauth2Client.getToken(code);
        this.saveToken(tokens);
        return tokens;
    }
}

// Export singleton instance
export default new GoogleClientService();

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Kernel {
    /*
     * Define the application's command schedule.
     */
    schedule(schedule) {
        // This ensures scheduled emails are processed
        schedule.command('queue:work --stop-when-empty').everyMinute();
    }

    /*
     * Register the commands for the application.
     */
    async commands() {
        // Load commands from the 'Commands' directory
        // Implementation might involve reading the dir and registering classes

        // Require console routes
        const consoleRoutesPath = path.resolve(__dirname, '../../routes/console.js');

        try {
            await import(consoleRoutesPath);
        } catch (e) {
            // console.warn('Console routes not found:', consoleRoutesPath);
        }
    }
}

export default new Kernel();

/**
 * ParseRollNumber Middleware
 * Ported from PHP Laravel's App\Http\Middleware\ParseRollNumber
 * 
 * Handles route parameter parsing for roll numbers and form IDs
 */
export default function parseRollNumber(req, res, next) {
    // Retrieve the route parameters
    const { form_id, id } = req.params;

    // If both form_id and id exist, set id to form_id value
    // This matches Laravel's behavior for certain routes
    if (form_id !== undefined && id !== undefined) {
        req.params.id = form_id;
    }

    // Continue processing the request
    next();
}

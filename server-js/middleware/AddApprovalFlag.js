/**
 * AddApprovalFlag Middleware
 * Ported from PHP Laravel's App\Http\Middleware\AddApprovalFlag
 * 
 * Adds an 'approval' flag to requests if it's missing
 */
export default function addApprovalFlag(req, res, next) {
    // Only add if it's missing
    if (req.body && req.body.approval === undefined) {
        req.body.approval = true;
    }
    
    // Also add to query params if needed
    if (req.query && req.query.approval === undefined) {
        req.query.approval = 'true';
    }

    next();
}

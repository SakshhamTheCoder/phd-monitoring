/**
 * LogRequestResponse Middleware
 * Ported from PHP Laravel's App\Http\Middleware\LogRequestResponse
 * 
 * Logs incoming requests and outgoing responses with sensitive data filtering
 */

// Sensitive routes to skip logging
const sensitiveRoutes = [
    'api/admin/logs',
    'api/notifications/unread'
];

/**
 * Check if a route path matches any sensitive routes
 * @param {string} path 
 * @returns {boolean}
 */
function isSensitiveRoute(path) {
    // Remove leading slash for comparison
    const normalizedPath = path.replace(/^\//, '');
    return sensitiveRoutes.some(route => normalizedPath.includes(route));
}

/**
 * Filter sensitive data from headers
 * @param {object} headers 
 * @param {boolean} isSensitive 
 * @returns {object|string}
 */
function filterHeaders(headers, isSensitive) {
    if (isSensitive) {
        return 'Sensitive Data Skipped';
    }
    
    // Clone and filter authorization header
    const filtered = { ...headers };
    if (filtered.authorization) {
        filtered.authorization = '[REDACTED]';
    }
    return filtered;
}

/**
 * Filter sensitive data from body
 * @param {object} body 
 * @param {boolean} isSensitive 
 * @returns {object|string}
 */
function filterBody(body, isSensitive) {
    if (isSensitive) {
        return 'Sensitive Data Skipped';
    }
    
    // Clone and filter password fields
    const filtered = { ...body };
    const sensitiveFields = ['password', 'password_confirmation', 'current_password', 'token'];
    sensitiveFields.forEach(field => {
        if (filtered[field]) {
            filtered[field] = '[REDACTED]';
        }
    });
    return filtered;
}

/**
 * Middleware function
 */
export default function logRequestResponse(req, res, next) {
    const isSensitive = isSensitiveRoute(req.path);

    if (!isSensitive) {
        // Log the incoming request
        console.log('📥 Incoming Request', {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection?.remoteAddress,
            headers: filterHeaders(req.headers, isSensitive),
            body: filterBody(req.body, isSensitive)
        });
    }

    // Store original json method to intercept response
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
        if (!isSensitive) {
            console.log('📤 Outgoing Response', {
                status: res.statusCode,
                content: typeof data === 'object' ? data : 'Non-JSON response'
            });
        }
        return originalJson(data);
    };

    next();
}

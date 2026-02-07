/**
 * Middleware Index
 * Export all middleware for easy importing
 */

import authMiddleware from './auth.middleware.js';
import addApprovalFlag from './AddApprovalFlag.js';
import logRequestResponse from './LogRequestResponse.js';
import parseRollNumber from './ParseRollNumber.js';

export {
    authMiddleware,
    addApprovalFlag,
    logRequestResponse,
    parseRollNumber
};

export default {
    authMiddleware,
    addApprovalFlag,
    logRequestResponse,
    parseRollNumber
};

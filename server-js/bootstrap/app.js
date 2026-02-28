// Bootstrap application configuration for Express (ported from Laravel)
import express from 'express';
import logRequestResponse from '../middleware/LogRequestResponse.js';
import parseRollNumber from '../middleware/ParseRollNumber.js';
import addApprovalFlag from '../middleware/AddApprovalFlag.js';
import apiRoutes from '../routes/api.js';

const app = express();

// Middleware registration (aliases and global)
app.use(parseRollNumber); // Alias: parseRollNumber
app.use(logRequestResponse); // Global middleware
app.use('/approval', addApprovalFlag); // Alias: add.approval

// Exception handling (global error handler)
app.use((err, req, res, next) => {
    console.error('Global Exception Handler', {
        message: err.message,
        url: req.originalUrl,
        stack: err.stack,
    });
    res.status(500).json({ error: 'Internal Server Error' });
});

// Routing
app.use('/api', apiRoutes);

export default app;

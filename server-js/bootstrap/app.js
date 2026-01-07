// Bootstrap application configuration for Express (ported from Laravel)
import express from 'express';
import logRequestResponse from '../app/Http/Middleware/LogRequestResponse.js';
import parseRollNumber from '../app/Http/Middleware/ParseRollNumber.js';
import addApprovalFlag from '../app/Http/Middleware/AddApprovalFlag.js';
import routes from '../routes/index.js';

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
app.use('/', routes);

export default app;


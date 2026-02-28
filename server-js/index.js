// Entry point for Express app
import express from 'express';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { connectDB } from "./database/connection.js";
import "./app/Models/relations.js";    

import cors from "cors";

// Import middleware
import logRequestResponse from './middleware/LogRequestResponse.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// Apply middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logRequestResponse);  // Request/Response logging


app.use(cors());

// Static files (public directory)
app.use(express.static('public'));

// Main routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.send('Express server replica root');
});

// Connect to the database
connectDB();

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Entry point for Express app
import express from 'express';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { connectDB } from "./database/connection.js";
import "./models/relations.js";    
// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (public directory)
app.use(express.static('public'));

// Main routes
app.use('/', routes);

// Connect to the database
connectDB();

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


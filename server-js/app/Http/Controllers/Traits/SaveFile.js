   import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SaveFile utility functions for handling file uploads
 * Equivalent to Laravel's SaveFile trait
 */

export const saveUploadedFile = (file, formName, rollNo) => {
  if (!file) {
    throw new Error('No file provided');
  }

  // Generate timestamp and random number
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const randomNumber = Math.floor(Math.random() * 9000) + 1000;

  // Get file extension
  const ext = path.extname(file.originalname);

  // Define the file name format
  const fileName = `${formName}_${rollNo}_${timestamp}${randomNumber}${ext}`;

  // Define the folder path for the form type
  const folderPath = path.join(__dirname, '../../../../storage/app/public/uploads', formName);

  // Create directory if it doesn't exist
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Full file path
  const filePath = path.join(folderPath, fileName);

  // Write file to disk
  fs.writeFileSync(filePath, file.buffer);

  // Return the relative URL to access the file (starting with /app/public/)
  return `/app/public/uploads/${formName}/${fileName}`;
};

/**
 * Delete a file from storage
 * @param {string} filePath - The file path to delete
 */
export const deleteFile = (filePath) => {
  try {
    const fullPath = path.join(__dirname, '../../../../storage', filePath.replace('/app/public/', ''));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Check if a file exists
 * @param {string} filePath - The file path to check
 */
export const fileExists = (filePath) => {
  try {
    const fullPath = path.join(__dirname, '../../../../storage', filePath.replace('/app/public/', ''));
    return fs.existsSync(fullPath);
  } catch (error) {
    return false;
  }
};

export default {
  saveUploadedFile,
  deleteFile,
  fileExists
};

import { Patent, User, Student } from '../../../models/index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TODO: Implement FilterLogicTrait equivalent
const getAvailableFilters = (model) => {
  return [];
};

// TODO: Implement SaveFile trait equivalent
const saveUploadedFile = (file, folder, studentId) => {
  // This should save the file to storage/uploads/{folder}/{filename}
  // and return the file path
  if (!file) return null;

  const uploadDir = path.join(__dirname, '../../../storage/uploads', folder);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `${folder}_${studentId}_${timestamp}${path.extname(file.originalname)}`;
  const filePath = path.join(uploadDir, fileName);

  fs.writeFileSync(filePath, file.buffer);

  return `uploads/${folder}/${fileName}`;
};

export const index = async (req, res) => {
  try {
    const patents = await Patent.findAll({
      include: [
        {
          model: Student,
          as: 'student',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'first_name', 'last_name', 'email']
            }
          ]
        }
      ]
    });

    return res.status(200).json(patents);
  } catch (error) {
    console.error('Error fetching patents:', error);
    return res.status(500).json({
      message: 'Failed to fetch patents',
      error: error.message
    });
  }
};

export const listFilters = async (req, res) => {
  try {
    const filters = getAvailableFilters('patents');
    return res.status(200).json(filters);
  } catch (error) {
    console.error('Error fetching filters:', error);
    return res.status(500).json({
      message: 'Failed to fetch filters',
      error: error.message
    });
  }
};

export const store = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student']
    });

    if (!user || user.current_role?.role !== 'student') {
      return res.status(403).json({
        message: 'You are not authorized to access this resource'
      });
    }

    const { title, authors, status, doi_link, year, country } = req.body;

    // Validation
    if (!title || !authors || !status || !doi_link || !year || !country) {
      return res.status(400).json({
        errors: {
          message: 'title, authors, status, doi_link, year, and country are required'
        }
      });
    }

    if (!['filed', 'published', 'granted'].includes(status)) {
      return res.status(400).json({
        errors: {
          status: 'Status must be one of: filed, published, granted'
        }
      });
    }

    if (!['National', 'International'].includes(country)) {
      return res.status(400).json({
        errors: {
          country: 'Country must be National or International'
        }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        errors: {
          first_page: 'PDF file is required'
        }
      });
    }

    // Save file
    const filePath = saveUploadedFile(req.file, 'patents', user.student.roll_no);

    const patent = await Patent.create({
      student_id: user.student.roll_no,
      title,
      authors,
      doi_link,
      year,
      country,
      status,
      first_page: filePath
    });

    return res.status(201).json({
      message: 'Patent added successfully',
      patent
    });
  } catch (error) {
    console.error('Error creating patent:', error);
    return res.status(500).json({
      message: 'Failed to create patent',
      error: error.message
    });
  }
};

export const show = async (req, res) => {
  try {
    const { id } = req.params;

    const patent = await Patent.findByPk(id, {
      include: [
        {
          model: Student,
          as: 'student',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'first_name', 'last_name', 'email']
            }
          ]
        }
      ]
    });

    if (!patent) {
      return res.status(404).json({
        message: 'Patent not found'
      });
    }

    return res.status(200).json(patent);
  } catch (error) {
    console.error('Error fetching patent:', error);
    return res.status(500).json({
      message: 'Failed to fetch patent',
      error: error.message
    });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student']
    });

    if (!user || user.current_role?.role !== 'student') {
      return res.status(403).json({
        message: 'You are not authorized to access this resource'
      });
    }

    const patent = await Patent.findByPk(id);
    if (!patent) {
      return res.status(404).json({
        message: 'Patent not found'
      });
    }

    const { title, authors, status, doi_link, year, country } = req.body;

    // Validation
    if (!title || !authors || !status || !doi_link || !year || !country) {
      return res.status(400).json({
        errors: {
          message: 'title, authors, status, doi_link, year, and country are required'
        }
      });
    }

    if (!['filed', 'published', 'granted'].includes(status)) {
      return res.status(400).json({
        errors: {
          status: 'Status must be one of: filed, published, granted'
        }
      });
    }

    if (!['National', 'International'].includes(country)) {
      return res.status(400).json({
        errors: {
          country: 'Country must be National or International'
        }
      });
    }

    // Update fields
    patent.student_id = user.student.roll_no;
    patent.title = title;
    patent.authors = authors;
    patent.doi_link = doi_link;
    patent.year = year;
    patent.country = country;
    patent.status = status;

    // Update file if provided
    if (req.file) {
      const filePath = saveUploadedFile(req.file, 'patents', user.student.roll_no);
      patent.first_page = filePath;
    }

    await patent.save();

    return res.status(200).json({
      message: 'Patent updated successfully',
      patent
    });
  } catch (error) {
    console.error('Error updating patent:', error);
    return res.status(500).json({
      message: 'Failed to update patent',
      error: error.message
    });
  }
};

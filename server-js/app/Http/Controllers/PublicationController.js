import { Publication, Patent, User, Student } from '../../../models/index.js';
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

export const listFilters = async (req, res) => {
  try {
    const filters = getAvailableFilters('publications');
    return res.status(200).json(filters);
  } catch (error) {
    console.error('Error fetching filters:', error);
    return res.status(500).json({
      message: 'Failed to fetch filters',
      error: error.message
    });
  }
};

export const get = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student']
    });

    if (!user || user.current_role?.role !== 'student') {
      return res.status(403).json({
        message: 'You are not authorized to access this resource'
      });
    }

    const studentId = user.student.roll_no;

    // Fetch publications by type
    const sciPublications = await Publication.findAll({
      where: {
        student_id: studentId,
        form_id: null,
        publication_type: 'journal',
        type: 'sci'
      }
    });

    const nonSciPublications = await Publication.findAll({
      where: {
        student_id: studentId,
        form_id: null,
        publication_type: 'journal',
        type: 'non-sci'
      }
    });

    const nationalPublications = await Publication.findAll({
      where: {
        student_id: studentId,
        form_id: null,
        publication_type: 'conference',
        type: 'national'
      }
    });

    const internationalPublications = await Publication.findAll({
      where: {
        student_id: studentId,
        form_id: null,
        publication_type: 'conference',
        type: 'international'
      }
    });

    const bookPublications = await Publication.findAll({
      where: {
        student_id: studentId,
        form_id: null,
        publication_type: 'book'
      }
    });

    const patents = await Patent.findAll({
      where: {
        student_id: studentId,
        form_id: null
      }
    });

    const ret = {
      sci: sciPublications,
      non_sci: nonSciPublications,
      national: nationalPublications,
      international: internationalPublications,
      book: bookPublications,
      patents: patents
    };

    return res.status(200).json(ret);
  } catch (error) {
    console.error('Error fetching publications:', error);
    return res.status(500).json({
      message: 'Failed to fetch publications',
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

    const { title, publication_type, authors, status, doi_link, year, name } = req.body;

    // Basic validation
    if (!title || !publication_type || !authors || !status || !doi_link || !year || !name) {
      return res.status(400).json({
        errors: {
          message: 'title, publication_type, authors, status, doi_link, year, and name are required'
        }
      });
    }

    if (!['journal', 'conference', 'book'].includes(publication_type)) {
      return res.status(400).json({
        errors: {
          publication_type: 'Must be journal, conference, or book'
        }
      });
    }

    if (!['published', 'accepted'].includes(status)) {
      return res.status(400).json({
        errors: {
          status: 'Must be published or accepted'
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
    const filePath = saveUploadedFile(req.file, 'publication', user.student.roll_no);

    const publicationData = {
      student_id: user.student.roll_no,
      title,
      authors,
      doi_link,
      year: parseInt(year),
      name,
      first_page: filePath,
      status,
      publication_type
    };

    // Type-specific validation and fields
    switch (publication_type) {
      case 'journal':
        const { impact_factor, type, volume, page_no } = req.body;

        if (!impact_factor || !type || !volume || !page_no) {
          return res.status(400).json({
            errors: {
              message: 'For journal: impact_factor, type, volume, and page_no are required'
            }
          });
        }

        if (!['sci', 'non-sci'].includes(type)) {
          return res.status(400).json({
            errors: {
              type: 'Type must be sci or non-sci for journal'
            }
          });
        }

        publicationData.impact_factor = parseFloat(impact_factor);
        publicationData.type = type;
        publicationData.volume = parseInt(volume);
        publicationData.page_no = parseInt(page_no);
        break;

      case 'conference':
        const { country, state, city, type: confType } = req.body;

        if (!country || !state || !city || !confType) {
          return res.status(400).json({
            errors: {
              message: 'For conference: country, state, city, and type are required'
            }
          });
        }

        if (!['national', 'international'].includes(confType)) {
          return res.status(400).json({
            errors: {
              type: 'Type must be national or international for conference'
            }
          });
        }

        publicationData.country = country;
        publicationData.state = state;
        publicationData.city = city;
        publicationData.type = confType;
        break;

      case 'book':
        const { issn, volume: bookVolume, page_no: bookPageNo, publisher } = req.body;

        if (!issn || !bookVolume || !bookPageNo || !publisher) {
          return res.status(400).json({
            errors: {
              message: 'For book: issn, volume, page_no, and publisher are required'
            }
          });
        }

        publicationData.issn = parseInt(issn);
        publicationData.volume = parseInt(bookVolume);
        publicationData.page_no = parseInt(bookPageNo);
        publicationData.publisher = publisher;
        break;
    }

    const publication = await Publication.create(publicationData);

    return res.status(201).json(publication);
  } catch (error) {
    console.error('Error creating publication:', error);
    return res.status(500).json({
      message: 'Failed to create publication',
      error: error.message
    });
  }
};

export const show = async (req, res) => {
  try {
    const { id } = req.params;

    const publication = await Publication.findByPk(id, {
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

    if (!publication) {
      return res.status(404).json({
        error: 'Publication not found'
      });
    }

    return res.status(200).json(publication);
  } catch (error) {
    console.error('Error fetching publication:', error);
    return res.status(500).json({
      message: 'Failed to fetch publication',
      error: error.message
    });
  }
};

export const update = async (req, res) => {
  // TODO: Implement update method
  return res.status(501).json({
    message: 'Update method not yet implemented'
  });
};

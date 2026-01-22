import { OutsideExpert } from '../../../models/index.js';
import { Op } from 'sequelize';
import fs from 'fs';
import csvParser from 'csv-parser';

// TODO: Implement FilterLogicTrait equivalent
const applyDynamicFilters = (query, filters) => {
  // Placeholder for dynamic filtering logic
  return query;
};

const getAvailableFilters = (model) => {
  // TODO: Implement filter metadata based on model
  return [];
};

export const list = async (req, res) => {
  try {
    const perPage = parseInt(req.query.rows) || 15;
    const page = parseInt(req.query.page) || 1;
    const filters = req.query.filters || [];
    const offset = (page - 1) * perPage;

    let queryOptions = {
      order: [['created_at', 'DESC']],
      limit: perPage,
      offset: offset
    };

    // TODO: Apply filters if provided
    // if (filters) {
    //   queryOptions = applyDynamicFilters(queryOptions, filters);
    // }

    const { rows: experts, count: total } = await OutsideExpert.findAndCountAll(queryOptions);

    return res.status(200).json({
      data: experts,
      total: total,
      per_page: perPage,
      current_page: page,
      totalPages: Math.ceil(total / perPage),
      fields: ['first_name', 'last_name', 'email', 'phone', 'institution', 'designation'],
      fieldsTitles: ['First Name', 'Last Name', 'Email', 'Phone', 'Institution', 'Designation']
    });
  } catch (error) {
    console.error('Error fetching outside experts:', error);
    return res.status(500).json({
      message: `An error occurred: ${error.message}`
    });
  }
};

export const all = async (req, res) => {
  try {
    const experts = await OutsideExpert.findAll({
      attributes: ['id', 'first_name', 'last_name', 'email', 'institution', 'designation'],
      order: [['first_name', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: experts
    });
  } catch (error) {
    console.error('Error fetching all outside experts:', error);
    return res.status(500).json({
      message: `An error occurred: ${error.message}`
    });
  }
};

export const add = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      designation,
      department,
      institution,
      email,
      phone,
      area_of_expertise,
      website
    } = req.body;

    // Validation
    if (!first_name || !last_name || !designation || !department || !institution || !email) {
      return res.status(422).json({
        message: 'Validation failed',
        errors: {
          required: 'first_name, last_name, designation, department, institution, and email are required'
        }
      });
    }

    // Check for unique email
    const existingEmail = await OutsideExpert.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(422).json({
        message: 'Validation failed',
        errors: {
          email: 'Email already exists'
        }
      });
    }

    // Check for unique phone if provided
    if (phone) {
      const existingPhone = await OutsideExpert.findOne({ where: { phone } });
      if (existingPhone) {
        return res.status(422).json({
          message: 'Validation failed',
          errors: {
            phone: 'Phone number already exists'
          }
        });
      }
    }

    const expert = await OutsideExpert.create({
      first_name,
      last_name,
      designation,
      department,
      institution,
      email,
      phone,
      area_of_expertise,
      website
    });

    return res.status(201).json({
      success: true,
      message: 'Outside expert added successfully',
      data: expert
    });
  } catch (error) {
    console.error('Error adding outside expert:', error);
    return res.status(500).json({
      message: `An error occurred: ${error.message}`
    });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      designation,
      department,
      institution,
      email,
      phone,
      area_of_expertise,
      website
    } = req.body;

    const expert = await OutsideExpert.findByPk(id);
    if (!expert) {
      return res.status(404).json({
        message: 'Outside expert not found'
      });
    }

    // Validation
    if (!first_name || !last_name || !designation || !department || !institution || !email) {
      return res.status(422).json({
        message: 'Validation failed',
        errors: {
          required: 'first_name, last_name, designation, department, institution, and email are required'
        }
      });
    }

    // Check for unique email (excluding current record)
    const existingEmail = await OutsideExpert.findOne({
      where: {
        email,
        id: { [Op.ne]: id }
      }
    });
    if (existingEmail) {
      return res.status(422).json({
        message: 'Validation failed',
        errors: {
          email: 'Email already exists'
        }
      });
    }

    // Check for unique phone if provided (excluding current record)
    if (phone) {
      const existingPhone = await OutsideExpert.findOne({
        where: {
          phone,
          id: { [Op.ne]: id }
        }
      });
      if (existingPhone) {
        return res.status(422).json({
          message: 'Validation failed',
          errors: {
            phone: 'Phone number already exists'
          }
        });
      }
    }

    await expert.update({
      first_name,
      last_name,
      designation,
      department,
      institution,
      email,
      phone,
      area_of_expertise,
      website
    });

    return res.status(200).json({
      success: true,
      message: 'Outside expert updated successfully',
      data: expert
    });
  } catch (error) {
    console.error('Error updating outside expert:', error);
    return res.status(500).json({
      message: `An error occurred: ${error.message}`
    });
  }
};

export const deleteExpert = async (req, res) => {
  try {
    const { id } = req.params;

    const expert = await OutsideExpert.findByPk(id);
    if (!expert) {
      return res.status(404).json({
        message: 'Outside expert not found'
      });
    }

    await expert.destroy();

    return res.status(200).json({
      success: true,
      message: 'Outside expert deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting outside expert:', error);
    return res.status(500).json({
      message: `An error occurred: ${error.message}`
    });
  }
};

export const listFilters = async (req, res) => {
  try {
    const filters = getAvailableFilters('outside_experts');
    return res.status(200).json(filters);
  } catch (error) {
    console.error('Error fetching filters:', error);
    return res.status(500).json({
      message: `An error occurred: ${error.message}`
    });
  }
};

export const bulkImportFromCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'CSV file is required'
      });
    }

    const filePath = req.file.path;
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    let rowNumber = 1; // Header is row 1

    // Read and parse CSV
    const parseCSV = () => {
      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csvParser())
          .on('data', (row) => {
            results.push(row);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });
    };

    try {
      await parseCSV();

      // Process each row
      for (const row of results) {
        rowNumber++;

        try {
          // CSV Format: first_name,last_name,email,phone,designation,department,institution,area_of_expertise,website
          const firstName = row.first_name?.trim();
          const lastName = row.last_name?.trim();
          const email = row.email?.trim();
          const phone = row.phone?.trim() || null;
          const designation = row.designation?.trim();
          const department = row.department?.trim();
          const institution = row.institution?.trim();
          const areaOfExpertise = row.area_of_expertise?.trim() || null;
          const website = row.website?.trim() || null;

          // Validate required fields
          if (!firstName || !lastName || !email || !designation || !department || !institution) {
            errors.push(`Row ${rowNumber}: Missing required fields`);
            errorCount++;
            continue;
          }

          // Validate email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            errors.push(`Row ${rowNumber}: Invalid email format`);
            errorCount++;
            continue;
          }

          // Check if already exists
          const existing = await OutsideExpert.findOne({ where: { email } });

          if (existing) {
            // Update existing record
            await existing.update({
              first_name: firstName,
              last_name: lastName,
              phone,
              designation,
              department,
              institution,
              area_of_expertise: areaOfExpertise,
              website
            });
          } else {
            // Create new record
            await OutsideExpert.create({
              first_name: firstName,
              last_name: lastName,
              email,
              phone,
              designation,
              department,
              institution,
              area_of_expertise: areaOfExpertise,
              website
            });
          }

          successCount++;
        } catch (rowError) {
          errors.push(`Row ${rowNumber}: ${rowError.message}`);
          errorCount++;
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      return res.status(200).json({
        success: true,
        message: `Import completed: ${successCount} successful, ${errorCount} errors`,
        data: {
          success_count: successCount,
          error_count: errorCount,
          errors: errors
        }
      });
    } catch (parseError) {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      throw parseError;
    }
  } catch (error) {
    console.error('Error importing outside experts from CSV:', error);
    return res.status(500).json({
      message: `An error occurred: ${error.message}`
    });
  }
};

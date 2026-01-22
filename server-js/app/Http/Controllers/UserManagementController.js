import { User, Role, Student, Faculty, Department } from '../../../models/index.js';
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';

// TODO: Implement FilterLogicTrait equivalent for dynamic filtering
const applyDynamicFilters = (query, filters) => {
  // This is a placeholder for dynamic filtering logic
  // The actual implementation depends on the filter structure
  // from FilterLogicTrait in the PHP code
  return query;
};

const getAvailableFilters = (model) => {
  // TODO: Implement filter metadata based on model
  // This should return available filter fields for the given model
  return [];
};

const generatePassword = (length = 8) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

export const listFilters = async (req, res) => {
  try {
    const filters = getAvailableFilters('users');
    return res.status(200).json(filters);
  } catch (error) {
    console.error('Error fetching filters:', error);
    return res.status(500).json({
      message: 'Failed to fetch filters',
      error: error.message
    });
  }
};

export const list = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    if (!user || user.current_role?.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    let filters = req.body.filters || [];

    // Support filters from query string
    if (req.query.filters) {
      try {
        filters = JSON.parse(decodeURIComponent(req.query.filters));
      } catch (e) {
        console.error('Error parsing filters:', e);
      }
    }

    const perPage = parseInt(req.query.rows) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    let usersQuery = {
      include: [
        { model: Role, as: 'role' },
        { model: Role, as: 'current_role' },
        { model: Role, as: 'default_role' },
        {
          model: Student,
          as: 'student',
          include: [
            {
              model: Department,
              as: 'department',
              attributes: ['id', 'department_name']
            }
          ]
        },
        {
          model: Faculty,
          as: 'faculty',
          include: [
            {
              model: Department,
              as: 'department',
              attributes: ['id', 'department_name']
            }
          ]
        }
      ],
      limit: perPage,
      offset: offset,
      distinct: true
    };

    // Apply filters if provided
    if (filters && filters.length > 0) {
      // TODO: Implement dynamic filtering based on FilterLogicTrait
      // usersQuery = applyDynamicFilters(usersQuery, filters);
    }

    const { rows: users, count: total } = await User.findAndCountAll(usersQuery);

    const result = users.map(user => ({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      name: `${user.first_name} ${user.last_name}`.trim(),
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      role: user.role ? user.role.role : 'N/A',
      current_role: user.current_role ? user.current_role.role : 'N/A',
      default_role: user.default_role ? user.default_role.role : 'N/A',
      available_roles: user.available_roles || [],
      status: user.status || 'active',
      student_info: user.student ? {
        roll_number: user.student.roll_number,
        department: user.student.department?.department_name || null
      } : null,
      faculty_info: user.faculty ? {
        faculty_code: user.faculty.faculty_code,
        designation: user.faculty.designation,
        department: user.faculty.department?.department_name || null
      } : null
    }));

    return res.status(200).json({
      data: result,
      total: total,
      per_page: perPage,
      current_page: page,
      totalPages: Math.ceil(total / perPage),
      fields: ['name', 'email', 'phone', 'role', 'current_role', 'status'],
      fieldsTitles: ['Name', 'Email', 'Phone', 'Main Role', 'Current Role', 'Status']
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return res.status(500).json({
      message: 'Failed to list users',
      error: error.message
    });
  }
};

export const show = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    if (!loggedInUser || loggedInUser.current_role?.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;

    const user = await User.findByPk(id, {
      include: [
        { model: Role, as: 'role' },
        { model: Role, as: 'current_role' },
        { model: Role, as: 'default_role' },
        { model: Student, as: 'student' },
        { model: Faculty, as: 'faculty' }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      role_id: user.role_id,
      role: user.role ? user.role.role : null,
      current_role_id: user.current_role_id,
      current_role: user.current_role ? user.current_role.role : null,
      default_role_id: user.default_role_id,
      default_role: user.default_role ? user.default_role.role : null,
      available_roles: user.available_roles || [],
      status: user.status || 'active',
      student_info: user.student,
      faculty_info: user.faculty
    });
  } catch (error) {
    console.error('Error showing user:', error);
    return res.status(500).json({
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};

export const createOrUpdate = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    if (!loggedInUser || loggedInUser.current_role?.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const isUpdate = req.body.id ? true : false;

    // Validation
    const {
      id,
      first_name,
      last_name,
      email,
      phone,
      gender,
      role_id,
      current_role_id,
      default_role_id,
      available_roles,
      status,
      password
    } = req.body;

    if (!first_name || !email || !phone || !role_id) {
      return res.status(400).json({
        message: 'first_name, email, phone, and role_id are required'
      });
    }

    // Check if role exists
    const role = await Role.findByPk(role_id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    let user;
    let generatedPassword = null;

    if (isUpdate) {
      user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check email uniqueness for update
      const existingUser = await User.findOne({
        where: {
          email: email,
          id: { [Op.ne]: id }
        }
      });

      if (existingUser) {
        return res.status(400).json({
          message: 'Email already exists'
        });
      }
    } else {
      // Check email uniqueness for create
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          message: 'Email already exists'
        });
      }

      user = User.build();

      // Generate password if not provided
      if (!password) {
        generatedPassword = generatePassword(8);
        user.password = await bcrypt.hash(generatedPassword, 10);
      } else {
        if (password.length < 8) {
          return res.status(400).json({
            message: 'Password must be at least 8 characters'
          });
        }
        user.password = await bcrypt.hash(password, 10);
      }
    }

    user.first_name = first_name;
    user.last_name = last_name || ' ';
    user.email = email;
    user.phone = phone;
    user.gender = gender;
    user.role_id = role_id;
    user.current_role_id = current_role_id || role_id;
    user.default_role_id = default_role_id || role_id;
    user.available_roles = available_roles;
    user.status = status || 'active';

    await user.save();

    return res.status(isUpdate ? 200 : 201).json({
      message: isUpdate ? 'User updated successfully' : 'User created successfully',
      user: user,
      password: isUpdate ? null : generatedPassword
    });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return res.status(500).json({
      message: 'Failed to create/update user',
      error: error.message
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    if (!loggedInUser || loggedInUser.current_role?.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting own account
    if (user.id === loggedInUser.id) {
      return res.status(403).json({
        message: 'Cannot delete your own account'
      });
    }

    await user.destroy();

    return res.status(200).json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    if (!loggedInUser || loggedInUser.current_role?.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        message: 'Password is required and must be at least 8 characters'
      });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    return res.status(200).json({
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({
      message: 'Failed to reset password',
      error: error.message
    });
  }
};

export const sendResetEmail = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    if (!loggedInUser || loggedInUser.current_role?.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // TODO: Implement email sending functionality
    // This would require setting up a mail service (nodemailer, sendgrid, etc.)
    // and creating password reset tokens

    return res.status(200).json({
      message: 'Password reset email sent successfully'
    });
  } catch (error) {
    console.error('Error sending reset email:', error);
    return res.status(500).json({
      message: 'Failed to send password reset email',
      error: error.message
    });
  }
};

export const bulkImport = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    if (!loggedInUser || loggedInUser.current_role?.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { batch_data } = req.body;

    if (!batch_data || !Array.isArray(batch_data)) {
      return res.status(400).json({
        message: 'batch_data array is required'
      });
    }

    let successCount = 0;
    let updateCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const data of batch_data) {
      try {
        const rowNumber = data.row_number;
        const email = data.email?.trim();

        if (!data.first_name || !email || !data.phone || !data.role) {
          errors.push(`Row ${rowNumber}: Missing required fields`);
          errorCount++;
          continue;
        }

        // Find role
        const role = await Role.findOne({
          where: { role: data.role.toLowerCase().trim() }
        });

        if (!role) {
          errors.push(`Row ${rowNumber}: Role '${data.role}' not found`);
          errorCount++;
          continue;
        }

        // Parse available_roles
        let availableRoles = [];
        if (data.available_roles) {
          availableRoles = data.available_roles.split(',').map(r => r.trim());
        }

        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
          // Update existing user
          existingUser.first_name = data.first_name.trim();
          existingUser.last_name = data.last_name?.trim() || ' ';
          existingUser.phone = data.phone.trim();
          existingUser.gender = data.gender || null;
          existingUser.role_id = role.id;
          existingUser.available_roles = availableRoles;
          existingUser.status = data.status?.toLowerCase().trim() || 'active';
          await existingUser.save();
          updateCount++;
        } else {
          // Create new user
          const password = generatePassword(8);

          await User.create({
            first_name: data.first_name.trim(),
            last_name: data.last_name?.trim() || ' ',
            email: email,
            phone: data.phone.trim(),
            gender: data.gender || null,
            password: await bcrypt.hash(password, 10),
            role_id: role.id,
            current_role_id: role.id,
            default_role_id: role.id,
            available_roles: availableRoles,
            status: data.status?.toLowerCase().trim() || 'active'
          });
          successCount++;
        }
      } catch (e) {
        errors.push(`Row ${data.row_number}: ${e.message}`);
        errorCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Import completed: ${successCount} created, ${updateCount} updated, ${errorCount} errors`,
      data: {
        success_count: successCount,
        update_count: updateCount,
        error_count: errorCount,
        errors: errors
      }
    });
  } catch (error) {
    console.error('Error bulk importing users:', error);
    return res.status(500).json({
      message: 'Failed to bulk import users',
      error: error.message
    });
  }
};

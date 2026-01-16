import { User } from "../../../models/User.js";
import { Faculty } from "../../../models/Faculty.js";
import { Department } from "../../../models/Department.js";
import { Role } from "../../../models/Role.js";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { sequelize } from "../../../config/database.js";

/**
 * Faculty Controller
 * Handles faculty CRUD operations and bulk upload
 */

/**
 * Generate random password
 */
const generatePassword = (length = 8) => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

/**
 * Get available filters for faculty
 */
export const listFilters = async (req, res) => {
  try {
    // TODO: Implement getAvailableFilters logic
    const filters = {
      department_id: [],
      type: ["internal", "external"],
    };
    return res.json(filters);
  } catch (error) {
    console.error("Error in listFilters:", error);
    return res.status(500).json({
      message: "An error occurred",
      error: error.message,
    });
  }
};

/**
 * Add a new faculty member
 */
export const add = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ["role"],
    });

    if (!user?.role?.can_add_faculties) {
      return res.status(403).json({
        message: "You do not have permission to add faculty",
      });
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      department_id,
      designation,
      type,
      faculty_code,
      institution,
      website_link,
    } = req.body;

    // Validation
    if (!first_name || !email || !phone || !designation || !type) {
      return res.status(422).json({
        message: "Required fields are missing",
      });
    }

    if (!["internal", "external"].includes(type)) {
      return res.status(422).json({
        message: "Type must be 'internal' or 'external'",
      });
    }

    // Validate type-specific requirements
    if (type === "internal" && !faculty_code) {
      return res.status(422).json({
        message: "Faculty code is required for internal faculty",
      });
    }

    if (type === "external" && !institution) {
      return res.status(422).json({
        message: "Institution is required for external faculty",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    let newUser, password = null;

    if (existingUser) {
      // Check if faculty already exists
      const existingFaculty = await Faculty.findOne({
        where: { user_id: existingUser.id },
      });

      if (existingFaculty) {
        return res.status(422).json({
          message: "Faculty with this email already exists",
        });
      }
      newUser = existingUser;
    } else {
      // Create new user
      password = generatePassword(8);
      const facultyRole = await Role.findOne({ where: { role: "faculty" } });

      newUser = await User.create({
        first_name,
        last_name: last_name || " ",
        phone,
        email,
        password: await bcrypt.hash(password, 10),
        role_id: facultyRole.id,
        current_role_id: facultyRole.id,
        default_role_id: facultyRole.id,
      });
    }

    // Generate faculty code for external faculty
    let finalFacultyCode = faculty_code;
    if (type === "external") {
      finalFacultyCode = "777" + String(newUser.id).padStart(6, "0");
    }

    // Create faculty record
    const newFaculty = await Faculty.create({
      user_id: newUser.id,
      department_id: department_id || null,
      designation,
      faculty_code: finalFacultyCode,
      type,
      institution: institution || "Thapar Institute of Engineering and Technology",
      website_link,
    });

    return res.json({
      message: "Faculty added successfully",
      password: password,
      faculty_code: finalFacultyCode,
    });
  } catch (error) {
    console.error("Error adding faculty:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Update faculty member
 */
export const update = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ["role"],
    });

    if (!user?.role?.can_add_faculties) {
      return res.status(403).json({
        message: "You do not have permission to update faculty",
      });
    }

    const { id } = req.params;
    const faculty = await Faculty.findOne({
      where: { faculty_code: id },
      include: ["user"],
    });

    if (!faculty) {
      return res.status(404).json({
        message: "Faculty not found",
      });
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      department_id,
      designation,
      type,
      faculty_code,
      institution,
      website_link,
    } = req.body;

    // Validation
    if (!first_name || !email || !phone || !designation || !type) {
      return res.status(422).json({
        message: "Required fields are missing",
      });
    }

    if (!["internal", "external"].includes(type)) {
      return res.status(422).json({
        message: "Type must be 'internal' or 'external'",
      });
    }

    if (type === "internal" && !faculty_code) {
      return res.status(422).json({
        message: "Faculty code is required for internal faculty",
      });
    }

    if (type === "external" && !institution) {
      return res.status(422).json({
        message: "Institution is required for external faculty",
      });
    }

    // Check email uniqueness
    const existingUser = await User.findOne({
      where: {
        email,
        id: { [Op.ne]: faculty.user_id },
      },
    });

    if (existingUser) {
      return res.status(422).json({
        message: "Email already in use",
      });
    }

    // Update user
    await faculty.user.update({
      first_name,
      last_name: last_name || " ",
      email,
      phone,
    });

    // Update faculty
    const updateData = {
      department_id: department_id || null,
      designation,
      type,
      institution: institution || "Thapar Institute of Engineering and Technology",
      website_link,
    };

    if (type === "internal") {
      updateData.faculty_code = faculty_code;
    }
    // External faculty code remains unchanged

    await faculty.update(updateData);

    return res.json({
      message: "Faculty updated successfully",
      faculty_code: faculty.faculty_code,
    });
  } catch (error) {
    console.error("Error updating faculty:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * List faculty members with pagination
 */
export const list = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role", "faculty"],
    });

    const role = loggedInUser.current_role.role;

    const filtersParam = req.query.filters;
    let filters = {};
    if (filtersParam) {
      try {
        filters = typeof filtersParam === "string" ? JSON.parse(decodeURIComponent(filtersParam)) : filtersParam;
      } catch (e) {
        console.error("Error parsing filters:", e);
      }
    }

    const perPage = parseInt(req.query.rows) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    // Build where clause based on role
    const whereClause = {};

    if (role === "hod" || role === "phd_coordinator") {
      if (loggedInUser.faculty?.department_id) {
        whereClause.department_id = loggedInUser.faculty.department_id;
      }
    } else if (role === "adordc") {
      // TODO: Implement adordcDepartments relationship
      // const departments = await loggedInUser.faculty.getAdordcDepartments();
      // whereClause.department_id = { [Op.in]: departments.map(d => d.id) };
    } else if (!["admin", "director", "dra", "dordc"].includes(role)) {
      return res.status(403).json({
        message: "You are not authorized to access this resource",
      });
    }

    // TODO: Apply dynamic filters

    const { count, rows: faculties } = await Faculty.findAndCountAll({
      where: whereClause,
      include: [
        "user",
        "department",
        { association: "supervisedStudents", include: ["user"] },
        { association: "doctoralCommittee", include: ["user"] },
      ],
      limit: perPage,
      offset: offset,
    });

    const result = faculties.map((faculty) => ({
      id: faculty.faculty_code,
      faculty_code: faculty.faculty_code,
      first_name: faculty.user?.first_name,
      last_name: faculty.user?.last_name,
      name: `${faculty.user?.first_name} ${faculty.user?.last_name}`,
      designation: faculty.designation,
      email: faculty.user?.email,
      phone: faculty.user?.phone,
      department: faculty.department?.name,
      department_id: faculty.department_id,
      type: faculty.type,
      institution: faculty.institution,
      website_link: faculty.website_link,
      supervised_students: faculty.supervisedStudents?.map((s) => ({
        name: `${s.user?.first_name} ${s.user?.last_name}`,
        roll_number: s.roll_no,
      })),
      doctored_students: faculty.doctoralCommittee?.map((s) => ({
        name: `${s.user?.first_name} ${s.user?.last_name}`,
        roll_number: s.roll_no,
      })),
      supervised_outside: faculty.supervised_outside,
      supervised_campus: faculty.supervised_campus,
    }));

    return res.json({
      data: result,
      total: count,
      per_page: perPage,
      current_page: page,
      totalPages: Math.ceil(count / perPage),
      role: role,
      fields: ["name", "designation", "email", "phone", "department"],
      fieldsTitles: ["Name", "Designation", "Email", "Phone", "Department"],
    });
  } catch (error) {
    console.error("Error listing faculty:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Bulk upload faculty members
 */
export const upload = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ["role"],
    });

    if (!user?.role?.can_add_faculties) {
      return res.status(403).json({
        message: "You do not have permission to upload faculty",
      });
    }

    const { batch_data } = req.body;

    if (!batch_data || !Array.isArray(batch_data)) {
      return res.status(422).json({
        message: "batch_data array is required",
      });
    }

    let successCount = 0;
    let updateCount = 0;
    let errorCount = 0;
    const errors = [];
    const createdDepartments = [];

    for (const data of batch_data) {
      try {
        const rowNumber = data.row_number;
        const firstName = data.first_name?.trim();
        const lastName = data.last_name?.trim() || "";
        const email = data.email?.trim();
        const phone = data.phone?.trim();
        const designation = data.designation?.trim();
        const type = data.type?.toLowerCase().trim();
        let facultyCode = data.faculty_code?.trim() || null;
        const departmentCode = data.department_code?.trim() || null;
        let institution = data.institution?.trim() || null;
        const websiteLink = data.website_link?.trim() || null;

        // Validate type
        if (!["internal", "external"].includes(type)) {
          errors.push(`Row ${rowNumber}: Invalid type (must be 'internal' or 'external')`);
          errorCount++;
          continue;
        }

        // Validate required fields based on type
        if (type === "internal") {
          if (!facultyCode) {
            errors.push(`Row ${rowNumber}: Faculty code required for internal faculty`);
            errorCount++;
            continue;
          }
          if (!departmentCode) {
            errors.push(`Row ${rowNumber}: Department code required for internal faculty`);
            errorCount++;
            continue;
          }
          if (!institution) {
            institution = "Thapar Institute of Engineering and Technology";
          }
        } else {
          // External faculty
          if (!institution) {
            errors.push(`Row ${rowNumber}: Institution required for external faculty`);
            errorCount++;
            continue;
          }
          facultyCode = null; // Will be auto-generated
        }

        // Validate required fields
        if (!firstName || !email || !designation) {
          errors.push(`Row ${rowNumber}: Missing required fields (first_name, email, designation)`);
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

        // Find or create department
        let department = null;
        if (departmentCode) {
          department = await Department.findOne({
            where: { code: departmentCode },
          });

          if (!department) {
            // Auto-create department for bulk upload
            department = await Department.create({
              code: departmentCode,
              name: departmentCode.charAt(0).toUpperCase() + departmentCode.slice(1) + " Department",
            });

            if (!createdDepartments.includes(departmentCode)) {
              createdDepartments.push(departmentCode);
            }
          }
        }

        // Check if user exists
        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
          // Check if faculty already exists
          const existingFaculty = await Faculty.findOne({
            where: { user_id: existingUser.id },
          });

          if (existingFaculty) {
            // Update existing faculty
            await existingUser.update({
              first_name: firstName,
              last_name: lastName || " ",
              phone,
            });

            const updateData = {
              department_id: department?.id,
              designation,
              type,
              institution,
              website_link: websiteLink,
            };

            if (type === "internal" && facultyCode) {
              updateData.faculty_code = facultyCode;
            }

            await existingFaculty.update(updateData);
            updateCount++;
          } else {
            // User exists but not faculty - create faculty record
            if (type === "external") {
              facultyCode = "777" + String(existingUser.id).padStart(6, "0");
            }

            await Faculty.create({
              user_id: existingUser.id,
              faculty_code: facultyCode,
              department_id: department?.id,
              designation,
              type,
              institution,
              website_link: websiteLink,
            });

            successCount++;
          }
        } else {
          // Create new user
          const password = generatePassword(8);
          const facultyRole = await Role.findOne({ where: { role: "faculty" } });

          const newUser = await User.create({
            first_name: firstName,
            last_name: lastName || " ",
            email,
            phone,
            password: await bcrypt.hash(password, 10),
            role_id: facultyRole.id,
            current_role_id: facultyRole.id,
            default_role_id: facultyRole.id,
          });

          // Generate faculty code for external
          if (type === "external") {
            facultyCode = "777" + String(newUser.id).padStart(6, "0");
          }

          await Faculty.create({
            user_id: newUser.id,
            faculty_code: facultyCode,
            department_id: department?.id,
            designation,
            type,
            institution,
            website_link: websiteLink,
          });

          successCount++;
        }
      } catch (error) {
        errors.push(`Row ${data.row_number}: ${error.message}`);
        errorCount++;
      }
    }

    return res.json({
      success: true,
      message: `Import completed: ${successCount} created, ${updateCount} updated, ${errorCount} errors` +
        (createdDepartments.length > 0 ? `, ${createdDepartments.length} department(s) auto-created` : ""),
      data: {
        success_count: successCount,
        update_count: updateCount,
        error_count: errorCount,
        errors: errors,
        created_departments: createdDepartments,
      },
    });
  } catch (error) {
    console.error("Error in bulk upload:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

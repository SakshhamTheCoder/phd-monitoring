import { User } from "../../../models/User.js";
import { Student } from "../../../models/Student.js";
import { Role } from "../../../models/Role.js";
import { Department } from "../../../models/Department.js";
import { Forms } from "../../../models/Forms.js";
import { Faculty } from "../../../models/Faculty.js";
import bcrypt from "bcrypt";
import { sequelize } from "../../../config/database.js";
import { Op } from "sequelize";

/**
 * Student Controller
 * Handles CRUD operations for students
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
 * Format student profile for listing
 */
const ListStudentProfile = (student) => {
  return {
    roll_no: student.roll_no,
    name: `${student.user?.first_name} ${student.user?.last_name}`,
    email: student.user?.email,
    phone: student.user?.phone,
    department: student.department?.name,
    department_id: student.department_id,
    overall_progress: student.overall_progress,
    current_status: student.current_status,
    phd_title: student.phd_title,
    cgpa: student.cgpa,
    date_of_registration: student.date_of_registration,
    date_of_irb: student.date_of_irb,
    date_of_synopsis: student.date_of_synopsis,
    fathers_name: student.fathers_name,
    address: student.address,
    supervisors: student.supervisors?.map((s) => ({
      faculty_code: s.faculty_code,
      name: `${s.user?.first_name} ${s.user?.last_name}`,
    })),
    doctoralCommittee: student.doctoralCommittee?.map((f) => ({
      faculty_code: f.faculty_code,
      name: `${f.user?.first_name} ${f.user?.last_name}`,
    })),
  };
};

/**
 * Get available filters for students
 */
export const listFilters = async (req, res) => {
  try {
    // TODO: Implement getAvailableFilters logic
    const filters = {
      department_id: [],
      current_status: ["part-time", "full-time", "executive"],
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
 * Add a new student
 */
export const add = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    if (!loggedInUser?.current_role?.can_add_students) {
      return res.status(403).json({
        message: "You do not have permission to create student",
      });
    }

    const {
      first_name,
      last_name,
      phone,
      email,
      roll_no,
      department_id,
      date_of_registration,
      current_status,
      date_of_irb,
      phd_title,
      fathers_name,
      address,
      overall_progress,
      cgpa,
    } = req.body;

    // Validation
    if (!first_name || !phone || !email || !roll_no || !department_id || !date_of_registration || !current_status) {
      return res.status(422).json({
        message: "Required fields are missing",
      });
    }

    if (!["part-time", "full-time", "executive"].includes(current_status)) {
      return res.status(422).json({
        message: "Invalid current_status",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(422).json({
        message: "Email already exists",
      });
    }

    // Get student role
    const role = await Role.findOne({ where: { role: "student" } });
    if (!role) {
      return res.status(500).json({
        message: "Student role not found",
      });
    }

    // Generate random password
    const password = generatePassword(8);

    // Create user and student in a transaction
    const result = await sequelize.transaction(async (t) => {
      const user = await User.create(
        {
          first_name,
          last_name: last_name || " ",
          phone,
          email,
          password: await bcrypt.hash(password, 10),
          address,
          role_id: role.id,
          current_role_id: role.id,
        },
        { transaction: t }
      );

      const student = await Student.create(
        {
          user_id: user.id,
          roll_no,
          department_id: parseInt(department_id),
          date_of_registration,
          date_of_irb,
          phd_title,
          fathers_name,
          current_status,
          address,
          cgpa: cgpa ? parseFloat(cgpa) : null,
          overall_progress: overall_progress ? parseFloat(overall_progress) : 0,
        },
        { transaction: t }
      );

      // TODO: Create supervisor allocation form
      // This requires AdminFormController.getFormCreationData() implementation

      return { user, student, password };
    });

    return res.json(result.password);
  } catch (error) {
    console.error("Error adding student:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Bulk upload students
 */
export const bulkUpload = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    if (!loggedInUser?.current_role?.can_add_students) {
      return res.status(403).json({
        message: "You do not have permission to create students",
      });
    }

    const { students } = req.body;

    if (!students || !Array.isArray(students)) {
      return res.status(422).json({
        message: "Students array is required",
      });
    }

    const role = await Role.findOne({ where: { role: "student" } });
    if (!role) {
      return res.status(500).json({
        message: "Student role not found",
      });
    }

    let successful = 0;
    let failed = 0;
    const errors = [];

    await sequelize.transaction(async (t) => {
      for (let index = 0; index < students.length; index++) {
        try {
          const studentData = students[index];

          // Find department by code
          const department = await Department.findOne({
            where: { code: studentData.department_code },
          });

          if (!department) {
            errors.push(`Row ${index + 1}: Department code '${studentData.department_code}' not found`);
            failed++;
            continue;
          }

          // Check if email already exists
          const existingUser = await User.findOne({
            where: { email: studentData.email },
          });
          if (existingUser) {
            errors.push(`Row ${index + 1}: Email '${studentData.email}' already exists`);
            failed++;
            continue;
          }

          // Check if roll number already exists
          const existingStudent = await Student.findOne({
            where: { roll_no: studentData.roll_no },
          });
          if (existingStudent) {
            errors.push(`Row ${index + 1}: Roll number '${studentData.roll_no}' already exists`);
            failed++;
            continue;
          }

          // Generate random password
          const password = generatePassword(8);

          // Create user
          const user = await User.create(
            {
              first_name: studentData.first_name,
              last_name: studentData.last_name || " ",
              phone: studentData.phone,
              email: studentData.email,
              password: await bcrypt.hash(password, 10),
              address: studentData.address || null,
              role_id: role.id,
              current_role_id: role.id,
            },
            { transaction: t }
          );

          // Create student
          await Student.create(
            {
              user_id: user.id,
              roll_no: studentData.roll_no,
              department_id: department.id,
              date_of_registration: studentData.date_of_registration,
              date_of_irb: studentData.date_of_irb || null,
              phd_title: studentData.phd_title || null,
              fathers_name: studentData.fathers_name || null,
              current_status: studentData.current_status,
              address: studentData.address || null,
              cgpa: studentData.cgpa ? parseFloat(studentData.cgpa) : null,
              overall_progress: studentData.overall_progress ? parseFloat(studentData.overall_progress) : 0.0,
            },
            { transaction: t }
          );

          successful++;
        } catch (error) {
          errors.push(`Row ${index + 1}: ${error.message}`);
          failed++;
        }
      }
    });

    return res.json({
      successful,
      failed,
      errors,
    });
  } catch (error) {
    console.error("Error in bulkUpload:", error);
    return res.status(500).json({
      message: "Bulk upload failed",
      error: error.message,
    });
  }
};

/**
 * List students with pagination and filters
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
    const all = req.query.all === "true" || req.query.all === true;
    const offset = (page - 1) * perPage;

    // Build where clause based on role
    const whereClause = {};
    const includeOptions = [
      "user",
      "department",
      { association: "supervisors", include: ["user"] },
      { association: "doctoralCommittee", include: ["user"] },
    ];

    switch (role) {
      case "hod":
      case "phd_coordinator":
        if (loggedInUser.faculty?.department_id) {
          whereClause.department_id = loggedInUser.faculty.department_id;
        }
        break;
      case "faculty":
        // TODO: Implement supervisedStudents relationship
        break;
      case "doctoral":
      case "external":
        // TODO: Implement doctoredStudents relationship
        break;
      case "student":
        whereClause.user_id = loggedInUser.id;
        break;
      case "adordc":
        // TODO: Implement adordcDepartments relationship
        break;
      case "admin":
      case "director":
      case "dra":
      case "dordc":
        // No restrictions
        break;
      default:
        return res.status(403).json({
          message: "You do not have permission to view students",
        });
    }

    // Apply dynamic filters
    // TODO: Implement applyDynamicFilters logic

    const queryOptions = {
      where: whereClause,
      include: includeOptions,
      order: [["created_at", "DESC"]],
    };

    if (all) {
      const students = await Student.findAll(queryOptions);
      const result = students.map(ListStudentProfile);

      return res.json({
        data: result,
        total: students.length,
        per_page: students.length,
        current_page: 1,
        totalPages: 1,
        role: role,
        fields: ["name", "roll_no", "overall_progress", "department", "email", "phone"],
        fieldsTitles: ["Name", "Roll No", "Overall Progress", "Department", "Email", "Phone"],
      });
    }

    const { count, rows: students } = await Student.findAndCountAll({
      ...queryOptions,
      limit: perPage,
      offset: offset,
    });

    const result = students.map(ListStudentProfile);

    return res.json({
      data: result,
      total: count,
      per_page: perPage,
      current_page: page,
      totalPages: Math.ceil(count / perPage),
      role: role,
      fields: ["name", "roll_no", "overall_progress", "department", "email", "phone"],
      fieldsTitles: ["Name", "Roll No", "Overall Progress", "Department", "Email", "Phone"],
    });
  } catch (error) {
    console.error("Error listing students:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Get a specific student by roll number
 */
export const get = async (req, res) => {
  try {
    const { roll_no } = req.params;
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role", "faculty"],
    });

    const role = loggedInUser.current_role.role;
    let student = null;

    switch (role) {
      case "admin":
      case "director":
      case "dra":
      case "dordc":
        student = await Student.findByPk(roll_no, {
          include: [
            "user",
            "department",
            { association: "supervisors", include: ["user"] },
            { association: "doctoralCommittee", include: ["user"] },
          ],
        });
        break;
      case "adordc":
        // TODO: Implement adordcDepartments check
        student = await Student.findOne({
          where: { roll_no },
          include: ["user", "department", { association: "supervisors", include: ["user"] }, { association: "doctoralCommittee", include: ["user"] }],
        });
        break;
      case "hod":
      case "phd_coordinator":
        student = await Student.findOne({
          where: {
            department_id: loggedInUser.faculty?.department_id,
            roll_no,
          },
          include: ["user", "department", { association: "supervisors", include: ["user"] }, { association: "doctoralCommittee", include: ["user"] }],
        });
        break;
      case "faculty":
        student = await Student.findByPk(roll_no, {
          include: ["user", "department", { association: "supervisors", include: ["user"] }, { association: "doctoralCommittee", include: ["user"] }],
        });
        // TODO: Check if faculty supervises this student
        break;
      case "student":
        student = await Student.findOne({
          where: {
            user_id: loggedInUser.id,
            roll_no,
          },
          include: ["user", "department", { association: "supervisors", include: ["user"] }, { association: "doctoralCommittee", include: ["user"] }],
        });
        break;
      default:
        return res.status(403).json({
          message: "You do not have permission to view student",
        });
    }

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    const stu = ListStudentProfile(student);
    return res.json({
      data: [stu],
    });
  } catch (error) {
    console.error("Error getting student:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

import { Course } from "../../../models/Course.js";
import { Department } from "../../../models/Department.js";
import { User } from "../../../models/User.js";
import { Faculty } from "../../../models/Faculty.js";
import { PhdCoordinator } from "../../../models/PhdCoordinator.js";
import { StudentCourse } from "../../../models/StudentCourse.js";
import { Op } from "sequelize";

/**
 * Course Controller
 * Handles CRUD operations for courses
 */

/**
 * Get available filters for courses
 */
export const listFilters = async (req, res) => {
  try {
    // TODO: Implement getAvailableFilters logic from FilterLogicTrait
    const filters = {
      department_id: [],
      credits: [],
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
 * List all courses with pagination and filters
 */
export const list = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role", "faculty"],
    });

    if (!loggedInUser || !loggedInUser.current_role) {
      return res.status(404).json({ message: "User or role not found" });
    }

    const role = loggedInUser.current_role.role;

    // Parse filters and pagination
    const filtersParam = req.query.filters;
    let filters = {};
    if (filtersParam) {
      try {
        filters =
          typeof filtersParam === "string"
            ? JSON.parse(decodeURIComponent(filtersParam))
            : filtersParam;
      } catch (e) {
        console.error("Error parsing filters:", e);
      }
    }

    const perPage = parseInt(req.query.rows) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    // Build query
    const whereClause = {};

    // Apply role-based filtering
    if (role === "hod" && loggedInUser.faculty) {
      const hodDepartment = await Department.findOne({
        where: { hod_id: loggedInUser.faculty.faculty_code },
      });
      if (hodDepartment) {
        whereClause.department_id = hodDepartment.id;
      }
    } else if (role === "phd_coordinator" && loggedInUser.faculty) {
      const coordinator = await PhdCoordinator.findOne({
        where: { faculty_id: loggedInUser.faculty.faculty_code },
      });
      if (coordinator) {
        whereClause.department_id = coordinator.department_id;
      }
    }

    // Apply dynamic filters
    if (filters.department_id) {
      whereClause.department_id = filters.department_id;
    }
    if (filters.credits) {
      whereClause.credits = filters.credits;
    }

    // Get courses with pagination
    const { count, rows: courses } = await Course.findAndCountAll({
      where: whereClause,
      include: ["department"],
      limit: perPage,
      offset: offset,
      order: [["created_at", "DESC"]],
    });

    // Format result
    const result = await Promise.all(
      courses.map(async (course) => {
        const enrolledCount = await StudentCourse.count({
          where: {
            course_id: course.id,
            status: "enrolled",
          },
        });

        return {
          id: course.id,
          course_code: course.course_code,
          course_name: course.course_name,
          credits: course.credits,
          department_id: course.department_id,
          department_name: course.department?.name || "N/A",
          enrolled_count: enrolledCount,
          created_at: course.created_at,
        };
      })
    );

    return res.json({
      success: true,
      data: result,
      total: count,
      per_page: perPage,
      current_page: page,
      totalPages: Math.ceil(count / perPage),
      role: role,
      fields: [
        "course_code",
        "course_name",
        "credits",
        "department_name",
        "enrolled_count",
      ],
      fieldsTitles: [
        "Course Code",
        "Course Name",
        "Credits",
        "Department",
        "Enrolled Students",
      ],
    });
  } catch (error) {
    console.error("Error listing courses:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Add new course
 */
export const add = async (req, res) => {
  try {
    const { course_code, course_name, credits, department_id } = req.body;

    // Validation
    if (!course_code || !course_name || !credits || !department_id) {
      return res.status(422).json({
        message: "All fields are required",
      });
    }

    // Check if course code already exists
    const existingCourse = await Course.findOne({
      where: { course_code },
    });

    if (existingCourse) {
      return res.status(422).json({
        message: "Course code already exists",
      });
    }

    // Check if department exists
    const department = await Department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    const course = await Course.create({
      course_code,
      course_name,
      credits: parseFloat(credits),
      department_id: parseInt(department_id),
    });

    return res.json({
      success: true,
      message: "Course added successfully",
      data: course,
    });
  } catch (error) {
    console.error("Error adding course:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Update course
 */
export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { course_code, course_name, credits, department_id } = req.body;

    // Validation
    if (!course_code || !course_name || !credits || !department_id) {
      return res.status(422).json({
        message: "All fields are required",
      });
    }

    const course = await Course.findByPk(id);
    if (!course) {
      return res.status(404).json({
        message: "Course not found",
      });
    }

    // Check if course code is unique (excluding current course)
    const existingCourse = await Course.findOne({
      where: {
        course_code,
        id: { [Op.ne]: id },
      },
    });

    if (existingCourse) {
      return res.status(422).json({
        message: "Course code already exists",
      });
    }

    // Check if department exists
    const department = await Department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    await course.update({
      course_code,
      course_name,
      credits: parseFloat(credits),
      department_id: parseInt(department_id),
    });

    return res.json({
      success: true,
      message: "Course updated successfully",
      data: course,
    });
  } catch (error) {
    console.error("Error updating course:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Delete course
 */
export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id);
    if (!course) {
      return res.status(404).json({
        message: "Course not found",
      });
    }

    // Check if any students are enrolled
    const enrolledCount = await StudentCourse.count({
      where: { course_id: id },
    });

    if (enrolledCount > 0) {
      return res.status(400).json({
        message: "Cannot delete course with enrolled students",
      });
    }

    await course.destroy();

    return res.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Get all courses for dropdown (no pagination)
 */
export const getAllCourses = async (req, res) => {
  try {
    const { department_id } = req.query;

    const whereClause = {};
    if (department_id) {
      whereClause.department_id = department_id;
    }

    const courses = await Course.findAll({
      where: whereClause,
      include: ["department"],
      order: [["course_name", "ASC"]],
    });

    return res.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    console.error("Error getting all courses:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Import courses from CSV
 */
export const importCoursesFromCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(422).json({
        message: "CSV file is required",
      });
    }

    const csvData = req.file.buffer.toString("utf-8");
    const rows = csvData.split("\n");
    const header = rows.shift(); // Remove header row

    const errors = [];
    let imported = 0;

    for (let index = 0; index < rows.length; index++) {
      try {
        const row = rows[index].split(",");

        if (row.length < 4) {
          errors.push(`Row ${index + 2}: Insufficient columns`);
          continue;
        }

        const course_code = row[0]?.trim();
        const course_name = row[1]?.trim();
        const credits = parseFloat(row[2]?.trim());
        const department_id = parseInt(row[3]?.trim());

        if (!course_code || !course_name || isNaN(credits) || isNaN(department_id)) {
          errors.push(`Row ${index + 2}: Invalid data`);
          continue;
        }

        await Course.create({
          course_code,
          course_name,
          credits,
          department_id,
        });

        imported++;
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error.message}`);
      }
    }

    return res.json({
      success: true,
      message: `${imported} courses imported successfully`,
      imported_count: imported,
      errors: errors,
    });
  } catch (error) {
    console.error("Error importing courses:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

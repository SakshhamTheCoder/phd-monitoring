import User  from "../../Models/User.js";
import Student  from "../../Models/Student.js";
import { Faculty } from "../../Models/Faculty.js";
import { getAvailableFilters } from "./Traits/FilterLogicTrait.js";
import { Forms } from "../../Models/Forms.js";

/**
 * User Controller
 * Handles user-related operations and form listings
 */

/**
 * Get current authenticated user details
 */
export const list = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ["current_role"],
      attributes: {
        exclude: ["password"],
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Error in list:", error);
    return res.status(500).json({
      message: "An error occurred",
      error: error.message,
    });
  }
};

/**
 * Get available filters for forms
 */
export const listFilters = async (req, res) => {
  try {
    const filters = await getAvailableFilters('forms');
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
 * List forms based on user role
 */
export const listForms = async (req, res) => {
  try {
    const { roll_no } = req.params;
    const user = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    if (!user || !user.current_role) {
      return res.status(404).json({ message: "User or role not found" });
    }

    const role = user.current_role.role;
    let data = null;

    switch (role) {
      case "student": {
        const student = await Student.findOne({
          where: { user_id: user.id },
        });

        if (!student) {
          return res.status(404).json({ message: "Student record not found" });
        }

        // Get all forms associated with the student
        const forms = await Forms.findAll({
          where: { student_id: student.roll_no || student.id },
          order: [['created_at', 'DESC']],
        });
        data = forms;
        break;
      }

      case "hod":
      case "phd_coordinator":
      case "dra":
      case "dordc":
      case "director":
      case "faculty":
      case "external":
      case "doctoral": {
        const faculty = await Faculty.findOne({
          where: { user_id: user.id },
        });

        if (!faculty) {
          return res.status(404).json({ message: "Faculty record not found" });
        }

        // Get forms accessible by faculty, optionally filtered by roll_no
        const formsWhereClause = {};
        if (roll_no) {
          formsWhereClause.student_id = roll_no;
        }
        const forms = await Forms.findAll({
          where: formsWhereClause,
          order: [['created_at', 'DESC']],
        });
        data = forms;
        break;
      }

      default:
        return res.status(403).json({
          message: "You are not authorized to access this resource",
        });
    }

    return res.json(data);
  } catch (error) {
    console.error("Error in listForms:", error);
    return res.status(500).json({
      message: "An error occurred",
      error: error.message,
    });
  }
};

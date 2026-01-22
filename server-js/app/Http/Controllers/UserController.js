import { User } from "../../../models/User.js";
import { Student } from "../../../models/Student.js";
import { Faculty } from "../../../models/Faculty.js";

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
    // TODO: Implement getAvailableFilters logic from FilterLogicTrait
    // This should return available filters for the "forms" entity
    const filters = {
      // Placeholder - implement based on your filter requirements
      status: ["pending", "approved", "rejected"],
      type: ["irb", "synopsis", "thesis", "presentation"],
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

        // TODO: Implement student.forms() method
        // This should return all forms associated with the student
        data = {
          message: "Student forms - implementation needed",
          student_id: student.id,
        };
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

        // TODO: Implement faculty.forms(roll_no) method
        // This should return forms accessible by faculty, optionally filtered by roll_no
        data = {
          message: "Faculty forms - implementation needed",
          faculty_id: faculty.id,
          roll_no: roll_no || null,
        };
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

import { Role } from "../../../models/Role.js";

/**
 * Roles Controller
 * Handles role management operations
 */

/**
 * Add a new role with permissions
 */
export const add = async (req, res) => {
  try {
    const {
      role,
      can_read_all_students,
      can_read_all_faculties,
      can_read_supervised_students,
      can_read_department_students,
      can_read_department_faculties,
      can_edit_all_students,
      can_edit_all_faculties,
      can_edit_department_students,
      can_edit_department_faculties,
      can_edit_own_profile,
      can_edit_phd_title,
      can_add_department_students,
      can_add_department_faculties,
      can_add_faculties,
      can_add_students,
      can_read_supervisors,
      can_read_doctoral_committee,
      can_edit_supervisors,
      can_edit_doctoral_committee,
      can_delete_department_students,
      can_delete_department_faculties,
      can_delete_faculties,
      can_delete_students,
      can_manage_roles,
      can_edit_department,
      can_add_department,
    } = req.body;

    // Validation
    if (!role) {
      return res.status(422).json({
        message: "Role name is required",
      });
    }

    const newRole = await Role.create({
      role,
      can_read_all_students: can_read_all_students || false,
      can_read_all_faculties: can_read_all_faculties || false,
      can_read_supervised_students: can_read_supervised_students || false,
      can_read_department_students: can_read_department_students || false,
      can_read_department_faculties: can_read_department_faculties || false,
      can_edit_all_students: can_edit_all_students || false,
      can_edit_all_faculties: can_edit_all_faculties || false,
      can_edit_department_students: can_edit_department_students || false,
      can_edit_department_faculties: can_edit_department_faculties || false,
      can_edit_own_profile: can_edit_own_profile || false,
      can_edit_phd_title: can_edit_phd_title || false,
      can_add_department_students: can_add_department_students || false,
      can_add_department_faculties: can_add_department_faculties || false,
      can_add_faculties: can_add_faculties || false,
      can_add_students: can_add_students || false,
      can_read_supervisors: can_read_supervisors || false,
      can_read_doctoral_committee: can_read_doctoral_committee || false,
      can_edit_supervisors: can_edit_supervisors || false,
      can_edit_doctoral_committee: can_edit_doctoral_committee || false,
      can_delete_department_students: can_delete_department_students || false,
      can_delete_department_faculties: can_delete_department_faculties || false,
      can_delete_faculties: can_delete_faculties || false,
      can_delete_students: can_delete_students || false,
      can_manage_roles: can_manage_roles || false,
      can_edit_department: can_edit_department || false,
      can_add_department: can_add_department || false,
    });

    return res.json({
      message: "Role added successfully",
      data: newRole,
    });
  } catch (error) {
    console.error("Error adding role:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

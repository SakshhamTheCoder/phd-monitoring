import { Department } from "../../../models/Department.js";
import { Faculty } from "../../../models/Faculty.js";
import { PhdCoordinator } from "../../../models/PhdCoordinator.js";
import { Role } from "../../../models/Role.js";
import { User } from "../../../models/User.js";
import { AreaOfSpecialization } from "../../../models/AreaOfSpecialization.js";
import { BroadAreaSpecialization } from "../../../models/BroadAreaSpecialization.js";
import { Op } from "sequelize";

/**
 * Department Controller
 * Handles department management, HOD/ADORDC assignment, and area of specialization
 */

/**
 * Get available filters for departments
 */
export const listFilters = async (req, res) => {
  try {
    // TODO: Implement getAvailableFilters logic
    const filters = {};
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
 * Get available filters for areas of specialization
 */
export const listAreaFilters = async (req, res) => {
  try {
    // TODO: Implement getAvailableFilters logic
    const filters = {};
    return res.json(filters);
  } catch (error) {
    console.error("Error in listAreaFilters:", error);
    return res.status(500).json({
      message: "An error occurred",
      error: error.message,
    });
  }
};

/**
 * List all departments with pagination
 */
export const list = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    const role = loggedInUser.current_role.role;

    if (!["admin", "director", "dra", "dordc"].includes(role)) {
      return res.status(403).json({
        message: "You are not authorized to access this resource",
      });
    }

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

    // TODO: Apply dynamic filters

    const { count, rows: departments } = await Department.findAndCountAll({
      include: [
        {
          association: "hod",
          include: ["user"],
        },
        {
          association: "adordc",
          include: ["user"],
        },
        {
          association: "phdCoordinators",
          include: [{ association: "faculty", include: ["user"] }],
        },
      ],
      limit: perPage,
      offset: offset,
    });

    const result = await Promise.all(
      departments.map(async (department) => {
        const studentsCount = await department.countStudents();

        return {
          id: department.id,
          name: department.name,
          code: department.code,
          hod: department.hod
            ? {
                faculty_code: department.hod.faculty_code,
                designation: department.hod.designation,
                user: {
                  name: `${department.hod.user?.first_name} ${department.hod.user?.last_name}`,
                  email: department.hod.user?.email,
                  phone: department.hod.user?.phone,
                },
                department: {
                  name: department.name,
                },
              }
            : null,
          adordc: department.adordc
            ? {
                faculty_code: department.adordc.faculty_code,
                designation: department.adordc.designation,
                user: {
                  name: `${department.adordc.user?.first_name} ${department.adordc.user?.last_name}`,
                  email: department.adordc.user?.email,
                  phone: department.adordc.user?.phone,
                },
                department: {
                  name: department.name,
                },
              }
            : null,
          phd_coordinators: department.phdCoordinators?.map((coordinator) => ({
            id: coordinator.id,
            faculty: coordinator.faculty
              ? {
                  faculty_code: coordinator.faculty.faculty_code,
                  designation: coordinator.faculty.designation,
                  user: {
                    name: `${coordinator.faculty.user?.first_name} ${coordinator.faculty.user?.last_name}`,
                    email: coordinator.faculty.user?.email,
                    phone: coordinator.faculty.user?.phone,
                  },
                  department: {
                    name: department.name,
                  },
                }
              : null,
          })),
          students_count: studentsCount,
        };
      })
    );

    return res.json({
      data: result,
      total: count,
      per_page: perPage,
      current_page: page,
      totalPages: Math.ceil(count / perPage),
      role: role,
      fields: ["name", "hod.user.name", "hod.user.email", "hod.user.phone", "department"],
      fieldsTitles: ["Name", "HOD Name", "Email", "Phone", "Department"],
    });
  } catch (error) {
    console.error("Error listing departments:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Add a new department
 */
export const add = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    if (!loggedInUser?.current_role?.can_add_department) {
      return res.status(403).json({
        message: "You do not have permission to create department",
      });
    }

    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(422).json({
        message: "Name and code are required",
      });
    }

    const department = await Department.create({ name, code });

    return res.json({
      message: "Department added successfully",
      data: department,
    });
  } catch (error) {
    console.error("Error adding department:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Add broad area of specialization
 */
export const addBroadAreaSpecialization = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    if (!loggedInUser?.current_role?.can_add_department) {
      return res.status(403).json({
        message: "You do not have permission to create department",
      });
    }

    const { broad_area, department_id } = req.body;

    if (!broad_area || !department_id) {
      return res.status(422).json({
        message: "Broad area and department ID are required",
      });
    }

    const department = await Department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    const broadAreaSpecialization = await BroadAreaSpecialization.create({
      broad_area,
      department_id,
    });

    return res.json({
      message: "Broad area specialization added successfully",
      data: broadAreaSpecialization,
    });
  } catch (error) {
    console.error("Error adding broad area specialization:", error);
    return res.status(500).json({
      message: "An error occurred",
    });
  }
};

/**
 * Add area of specialization
 */
export const addAreaOfSpecialization = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    if (!loggedInUser?.current_role?.can_add_department) {
      return res.status(403).json({
        message: "You do not have permission to add area of specialization",
      });
    }

    const { name, department_id, expert_name, expert_email, expert_phone, expert_college, expert_designation, expert_website } = req.body;

    if (!name || !department_id) {
      return res.status(422).json({
        message: "Name and department ID are required",
      });
    }

    const department = await Department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    const areaOfSpecialization = await AreaOfSpecialization.create({
      name,
      department_id,
      expert_name,
      expert_email,
      expert_phone,
      expert_college,
      expert_designation,
      expert_website,
    });

    return res.json({
      success: true,
      message: "Area of specialization added successfully",
      data: areaOfSpecialization,
    });
  } catch (error) {
    console.error("Error adding area of specialization:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Get areas of specialization by department
 */
export const getAreasOfSpecialization = async (req, res) => {
  try {
    const { department_id } = req.query;

    if (!department_id) {
      return res.status(400).json({
        message: "Department ID is required",
      });
    }

    const areas = await AreaOfSpecialization.findAll({
      where: { department_id },
      order: [["name", "ASC"]],
    });

    return res.json({
      success: true,
      data: areas,
    });
  } catch (error) {
    console.error("Error getting areas of specialization:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * List areas of specialization with pagination
 */
export const listAreasOfSpecialization = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role", "faculty"],
    });

    const role = loggedInUser.current_role.role;
    const perPage = parseInt(req.query.rows) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

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

    const { count, rows: areas } = await AreaOfSpecialization.findAndCountAll({
      where: whereClause,
      include: ["department"],
      limit: perPage,
      offset: offset,
    });

    const result = areas.map((area) => ({
      id: area.id,
      name: area.name,
      department_id: area.department_id,
      department_name: area.department?.name || "N/A",
      expert_name: area.expert_name,
      expert_email: area.expert_email,
      expert_phone: area.expert_phone,
      expert_college: area.expert_college,
      created_at: area.created_at,
    }));

    return res.json({
      success: true,
      data: result,
      total: count,
      per_page: perPage,
      current_page: page,
      totalPages: Math.ceil(count / perPage),
      role: role,
      fields: ["name", "department_name", "expert_name", "expert_email", "expert_phone"],
      fieldsTitles: ["Area Name", "Department", "Expert Name", "Expert Email", "Expert Phone"],
    });
  } catch (error) {
    console.error("Error listing areas of specialization:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Update area of specialization
 */
export const updateAreaOfSpecialization = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role", "faculty"],
    });

    const { name, department_id, expert_name, expert_email, expert_phone, expert_college } = req.body;

    if (!name || !department_id) {
      return res.status(422).json({
        message: "Name and department ID are required",
      });
    }

    const area = await AreaOfSpecialization.findByPk(id);
    if (!area) {
      return res.status(404).json({
        message: "Area of specialization not found",
      });
    }

    // Check authorization
    const role = loggedInUser.current_role.role;
    if (role === "hod" || role === "phd_coordinator") {
      let allowedDepartmentId = null;

      if (role === "hod" && loggedInUser.faculty) {
        const hodDepartment = await Department.findOne({
          where: { hod_id: loggedInUser.faculty.faculty_code },
        });
        allowedDepartmentId = hodDepartment?.id;
      } else if (loggedInUser.faculty) {
        const coordinator = await PhdCoordinator.findOne({
          where: { faculty_id: loggedInUser.faculty.faculty_code },
        });
        allowedDepartmentId = coordinator?.department_id;
      }

      if (area.department_id !== allowedDepartmentId) {
        return res.status(403).json({
          message: "You do not have permission to update this area",
        });
      }
    }

    await area.update({
      name,
      department_id,
      expert_name,
      expert_email,
      expert_phone,
      expert_college,
    });

    return res.json({
      success: true,
      message: "Area of specialization updated successfully",
      data: area,
    });
  } catch (error) {
    console.error("Error updating area of specialization:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Delete area of specialization
 */
export const deleteAreaOfSpecialization = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role", "faculty"],
    });

    const area = await AreaOfSpecialization.findByPk(id);
    if (!area) {
      return res.status(404).json({
        message: "Area of specialization not found",
      });
    }

    // Check authorization (same as update)
    const role = loggedInUser.current_role.role;
    if (role === "hod" || role === "phd_coordinator") {
      let allowedDepartmentId = null;

      if (role === "hod" && loggedInUser.faculty) {
        const hodDepartment = await Department.findOne({
          where: { hod_id: loggedInUser.faculty.faculty_code },
        });
        allowedDepartmentId = hodDepartment?.id;
      } else if (loggedInUser.faculty) {
        const coordinator = await PhdCoordinator.findOne({
          where: { faculty_id: loggedInUser.faculty.faculty_code },
        });
        allowedDepartmentId = coordinator?.department_id;
      }

      if (area.department_id !== allowedDepartmentId) {
        return res.status(403).json({
          message: "You do not have permission to delete this area",
        });
      }
    }

    await area.destroy();

    return res.json({
      success: true,
      message: "Area of specialization deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting area of specialization:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Import areas from CSV
 */
export const importAreasFromCSV = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role", "faculty"],
    });

    if (!req.file) {
      return res.status(422).json({
        message: "CSV file is required",
      });
    }

    const csvData = req.file.buffer.toString("utf-8");
    const rows = csvData.split("\n");
    const header = rows.shift().split(",");

    let importedCount = 0;
    const errors = [];

    for (let index = 0; index < rows.length; index++) {
      try {
        const rowData = rows[index].split(",");
        if (rowData.length < 2) continue;

        const departmentId = rowData[header.indexOf("department_id")]?.trim();
        const role = loggedInUser.current_role.role;

        // Check authorization
        if (role === "hod" || role === "phd_coordinator") {
          let allowedDepartmentId = null;

          if (role === "hod" && loggedInUser.faculty) {
            const hodDepartment = await Department.findOne({
              where: { hod_id: loggedInUser.faculty.faculty_code },
            });
            allowedDepartmentId = hodDepartment?.id;
          } else if (loggedInUser.faculty) {
            const coordinator = await PhdCoordinator.findOne({
              where: { faculty_id: loggedInUser.faculty.faculty_code },
            });
            allowedDepartmentId = coordinator?.department_id;
          }

          if (parseInt(departmentId) !== allowedDepartmentId) {
            errors.push(`Row ${index + 2}: Not authorized for this department`);
            continue;
          }
        }

        await AreaOfSpecialization.create({
          name: rowData[header.indexOf("name")]?.trim(),
          department_id: departmentId,
          expert_name: rowData[header.indexOf("expert_name")]?.trim() || null,
          expert_email: rowData[header.indexOf("expert_email")]?.trim() || null,
          expert_phone: rowData[header.indexOf("expert_phone")]?.trim() || null,
          expert_college: rowData[header.indexOf("expert_college")]?.trim() || null,
        });

        importedCount++;
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error.message}`);
      }
    }

    return res.json({
      success: true,
      message: `Imported ${importedCount} areas successfully`,
      imported_count: importedCount,
      errors: errors,
    });
  } catch (error) {
    console.error("Error importing areas from CSV:", error);
    return res.status(500).json({
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Add HOD to a department
 */
export const addHOD = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    if (!loggedInUser?.current_role?.can_add_department) {
      return res.status(403).json({
        message: "You do not have permission to add HOD",
      });
    }

    const { department_id, faculty_code } = req.body;

    if (!department_id || !faculty_code) {
      return res.status(422).json({
        message: "Department ID and faculty code are required",
      });
    }

    const department = await Department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    const faculty = await Faculty.findOne({
      where: { faculty_code },
      include: ["user"],
    });

    if (!faculty) {
      return res.status(404).json({
        message: "Faculty not found",
      });
    }

    if (faculty.department_id != department_id) {
      return res.status(400).json({
        message: "Faculty does not belong to this department",
      });
    }

    // If there's an existing HOD, revert their role to faculty
    if (department.hod_id) {
      const oldHod = await Faculty.findOne({
        where: { faculty_code: department.hod_id },
        include: ["user"],
      });

      if (oldHod && oldHod.user) {
        const facultyRole = await Role.findOne({ where: { role: "faculty" } });
        await oldHod.user.update({
          role_id: facultyRole.id,
          current_role_id: facultyRole.id,
        });
      }
    }

    // Update new HOD's role
    const hodRole = await Role.findOne({ where: { role: "hod" } });
    await faculty.user.update({
      role_id: hodRole.id,
      current_role_id: hodRole.id,
    });

    // Update department's HOD
    await department.update({ hod_id: faculty_code });

    return res.json({
      message: "HOD assigned successfully",
    });
  } catch (error) {
    console.error("Error adding HOD:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

/**
 * Add ADORDC to a department
 */
export const addAdordc = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    if (!loggedInUser?.current_role?.can_add_department) {
      return res.status(403).json({
        message: "You do not have permission to assign ADORDC",
      });
    }

    const { department_id, faculty_code } = req.body;

    if (!department_id || !faculty_code) {
      return res.status(422).json({
        message: "Department ID and faculty code are required",
      });
    }

    const department = await Department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    const faculty = await Faculty.findOne({
      where: { faculty_code },
      include: ["user"],
    });

    if (!faculty) {
      return res.status(404).json({
        message: "Faculty not found",
      });
    }

    // If there's an existing ADORDC, revert their role to faculty
    if (department.adordc_id) {
      const oldAdordc = await Faculty.findOne({
        where: { faculty_code: department.adordc_id },
        include: ["user"],
      });

      if (oldAdordc && oldAdordc.user) {
        const facultyRole = await Role.findOne({ where: { role: "faculty" } });
        await oldAdordc.user.update({
          role_id: facultyRole.id,
          current_role_id: facultyRole.id,
        });
      }
    }

    // Update new ADORDC's role
    const adordcRole = await Role.findOne({ where: { role: "adordc" } });
    if (!adordcRole) {
      return res.status(404).json({
        message: "ADORDC role not found in system",
      });
    }

    await faculty.user.update({
      role_id: adordcRole.id,
      current_role_id: adordcRole.id,
    });

    // Update department's ADORDC
    await department.update({ adordc_id: faculty_code });

    return res.json({
      success: true,
      message: "ADORDC assigned successfully",
    });
  } catch (error) {
    console.error("Error adding ADORDC:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred: " + error.message,
    });
  }
};

/**
 * Add PhD coordinator to a department
 */
export const addCoordinator = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    if (!loggedInUser?.current_role?.can_add_department) {
      return res.status(403).json({
        message: "You do not have permission to add coordinator",
      });
    }

    const { department_id, faculty_code } = req.body;

    if (!department_id || !faculty_code) {
      return res.status(422).json({
        message: "Department ID and faculty code are required",
      });
    }

    const department = await Department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    const faculty = await Faculty.findOne({
      where: { faculty_code },
      include: ["user"],
    });

    if (!faculty) {
      return res.status(404).json({
        message: "Faculty not found",
      });
    }

    if (faculty.department_id != department_id) {
      return res.status(400).json({
        message: "Faculty does not belong to this department",
      });
    }

    // Check if already a coordinator
    const existing = await PhdCoordinator.findOne({
      where: {
        department_id,
        faculty_id: faculty_code,
      },
    });

    if (existing) {
      return res.status(400).json({
        message: "Faculty is already a PhD Coordinator for this department",
      });
    }

    // Update role
    const coordinatorRole = await Role.findOne({ where: { role: "phd_coordinator" } });
    await faculty.user.update({
      role_id: coordinatorRole.id,
      current_role_id: coordinatorRole.id,
    });

    await PhdCoordinator.create({
      department_id,
      faculty_id: faculty_code,
    });

    return res.json({
      message: "PhD Coordinator added successfully",
    });
  } catch (error) {
    console.error("Error adding coordinator:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

/**
 * Remove PhD coordinator from a department
 */
export const removeCoordinator = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    if (!loggedInUser?.current_role?.can_add_department) {
      return res.status(403).json({
        message: "You do not have permission to remove coordinator",
      });
    }

    const { id } = req.params;

    const coordinator = await PhdCoordinator.findByPk(id);
    if (!coordinator) {
      return res.status(404).json({
        message: "PhD Coordinator not found",
      });
    }

    const faculty = await Faculty.findOne({
      where: { faculty_code: coordinator.faculty_id },
      include: ["user"],
    });

    if (faculty && faculty.user) {
      // Revert role to faculty
      const facultyRole = await Role.findOne({ where: { role: "faculty" } });
      await faculty.user.update({
        role_id: facultyRole.id,
        current_role_id: facultyRole.id,
      });
    }

    await coordinator.destroy();

    return res.json({
      message: "PhD Coordinator removed successfully",
    });
  } catch (error) {
    console.error("Error removing coordinator:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

import { Semester, User, Student, Department, Faculty, Supervisor, DoctoralCommittee } from '../../../models/index.js';
import { Op } from 'sequelize';

// Helper function to list semester data based on role
const ListSemester = async (semester, user) => {
  const students = await Student.findAll({
    where: { semester_id: semester.id },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'roll_no']
      },
      {
        model: Department,
        as: 'department',
        attributes: ['id', 'department_name']
      },
      {
        model: Supervisor,
        as: 'supervisors',
        include: [
          {
            model: Faculty,
            as: 'faculty',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email']
              }
            ]
          }
        ]
      },
      {
        model: DoctoralCommittee,
        as: 'doctoralCommittees',
        include: [
          {
            model: Faculty,
            as: 'faculty',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email']
              }
            ]
          }
        ]
      }
    ]
  });

  return {
    semester,
    students
  };
};

// Helper function to list semester data for HOD/Coordinator (department-specific)
const ListSemesterDepartment = async (semester, user) => {
  const students = await Student.findAll({
    where: {
      semester_id: semester.id,
      department_id: user.department_id
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'roll_no']
      },
      {
        model: Department,
        as: 'department',
        attributes: ['id', 'department_name']
      },
      {
        model: Supervisor,
        as: 'supervisors',
        include: [
          {
            model: Faculty,
            as: 'faculty',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email']
              }
            ]
          }
        ]
      },
      {
        model: DoctoralCommittee,
        as: 'doctoralCommittees',
        include: [
          {
            model: Faculty,
            as: 'faculty',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email']
              }
            ]
          }
        ]
      }
    ]
  });

  return {
    semester,
    students
  };
};

// Helper function to list not scheduled students
const ListNotScheduled = async (semester, user, rowsPerPage = 10, page = 1) => {
  const offset = (page - 1) * rowsPerPage;

  // TODO: Implement unscheduledStudents relationship on Student model
  // This should filter students who don't have a presentation scheduled
  const { rows: students, count: total } = await Student.findAndCountAll({
    where: {
      semester_id: semester.id,
      // TODO: Add condition to filter unscheduled students
      // '$presentations.id$': null or similar
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'roll_no']
      },
      {
        model: Department,
        as: 'department',
        attributes: ['id', 'department_name']
      }
    ],
    limit: parseInt(rowsPerPage),
    offset: offset,
    distinct: true
  });

  return {
    semester,
    students,
    pagination: {
      total,
      current_page: parseInt(page),
      per_page: parseInt(rowsPerPage),
      last_page: Math.ceil(total / rowsPerPage)
    }
  };
};

// Helper function to list supervised or doctored students
const ListSupervisedOrDoctored = async (semester, user, rowsPerPage = 10, page = 1) => {
  const offset = (page - 1) * rowsPerPage;

  const { rows: students, count: total } = await Student.findAndCountAll({
    where: {
      semester_id: semester.id,
      [Op.or]: [
        { '$supervisors.faculty_id$': user.faculty?.id },
        { '$doctoralCommittees.faculty_id$': user.faculty?.id }
      ]
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'roll_no']
      },
      {
        model: Department,
        as: 'department',
        attributes: ['id', 'department_name']
      },
      {
        model: Supervisor,
        as: 'supervisors',
        include: [
          {
            model: Faculty,
            as: 'faculty',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email']
              }
            ]
          }
        ]
      },
      {
        model: DoctoralCommittee,
        as: 'doctoralCommittees',
        include: [
          {
            model: Faculty,
            as: 'faculty',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email']
              }
            ]
          }
        ]
      }
    ],
    limit: parseInt(rowsPerPage),
    offset: offset,
    distinct: true
  });

  return {
    semester,
    students,
    pagination: {
      total,
      current_page: parseInt(page),
      per_page: parseInt(rowsPerPage),
      last_page: Math.ceil(total / rowsPerPage)
    }
  };
};

export const getRecent = async (req, res) => {
  try {
    const { semester_id } = req.params;
    const user = await User.findByPk(req.user.id, {
      include: ['role', 'faculty', 'student']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has required role
    const allowedRoles = ['dordc', 'hod', 'admin', 'phd_coordinator'];
    if (!allowedRoles.includes(user.role?.name)) {
      return res.status(403).json({
        message: 'You do not have permission to view semester details'
      });
    }

    let semester;
    if (semester_id) {
      semester = await Semester.findByPk(semester_id);
    } else {
      // Get most recent semester
      semester = await Semester.findOne({
        order: [['created_at', 'DESC']]
      });
    }

    if (!semester) {
      return res.status(404).json({ message: 'Semester not found' });
    }

    let data;
    if (user.role.name === 'dordc' || user.role.name === 'admin') {
      data = await ListSemester(semester, user);
    } else if (user.role.name === 'hod' || user.role.name === 'phd_coordinator') {
      data = await ListSemesterDepartment(semester, user);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching semester:', error);
    return res.status(500).json({
      message: 'Failed to fetch semester',
      error: error.message
    });
  }
};

export const create = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['role']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only dordc and admin can create semesters
    if (user.role?.name !== 'dordc' && user.role?.name !== 'admin') {
      return res.status(403).json({
        message: 'You do not have permission to create semesters'
      });
    }

    const { semester_name, start_date, end_date } = req.body;

    if (!semester_name || !start_date || !end_date) {
      return res.status(400).json({
        message: 'semester_name, start_date, and end_date are required'
      });
    }

    // TODO: Handle ppt_file upload if provided in req.file
    const semesterData = {
      semester_name,
      start_date,
      end_date
    };

    if (req.file) {
      // TODO: Implement file upload handling for ppt_file
      semesterData.ppt_file = req.file.path;
    }

    const semester = await Semester.create(semesterData);

    return res.status(201).json({
      message: 'Semester created successfully',
      semester
    });
  } catch (error) {
    console.error('Error creating semester:', error);
    return res.status(500).json({
      message: 'Failed to create semester',
      error: error.message
    });
  }
};

export const notScheduled = async (req, res) => {
  try {
    const { semester_id } = req.params;
    const { rows_per_page = 10, page = 1 } = req.query;

    const user = await User.findByPk(req.user.id, {
      include: ['role', 'faculty', 'student']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let semester;
    if (semester_id) {
      semester = await Semester.findByPk(semester_id);
    } else {
      // Get most recent semester
      semester = await Semester.findOne({
        order: [['created_at', 'DESC']]
      });
    }

    if (!semester) {
      return res.status(404).json({ message: 'Semester not found' });
    }

    let data;
    const roleName = user.role?.name;

    if (roleName === 'hod' || roleName === 'phd_coordinator') {
      // Department-specific not scheduled students
      const offset = (page - 1) * rows_per_page;

      const { rows: students, count: total } = await Student.findAndCountAll({
        where: {
          semester_id: semester.id,
          department_id: user.department_id
          // TODO: Add condition to filter unscheduled students
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'roll_no']
          },
          {
            model: Department,
            as: 'department',
            attributes: ['id', 'department_name']
          }
        ],
        limit: parseInt(rows_per_page),
        offset: offset,
        distinct: true
      });

      data = {
        semester,
        students,
        pagination: {
          total,
          current_page: parseInt(page),
          per_page: parseInt(rows_per_page),
          last_page: Math.ceil(total / rows_per_page)
        }
      };
    } else if (roleName === 'faculty') {
      // Faculty sees their supervised/doctored students who are not scheduled
      data = await ListSupervisedOrDoctored(semester, user, rows_per_page, page);
    } else if (roleName === 'dordc' || roleName === 'admin') {
      // DORDC/Admin sees all not scheduled students
      data = await ListNotScheduled(semester, user, rows_per_page, page);
    } else {
      return res.status(403).json({
        message: 'You do not have permission to view not scheduled students'
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching not scheduled students:', error);
    return res.status(500).json({
      message: 'Failed to fetch not scheduled students',
      error: error.message
    });
  }
};

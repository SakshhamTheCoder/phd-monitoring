import { User } from "../../../models/User.js";
import { Student } from "../../../models/Student.js";
import { Faculty } from "../../../models/Faculty.js";

/**
 * Home Controller
 * Handles home/dashboard data based on user role
 */
export const getHomeData = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ["current_role"],
    });

    if (!user || !user.current_role) {
      return res.status(404).json({ message: "User or role not found" });
    }

    const role = user.current_role.role;

    // Student dashboard
    if (role === "student") {
      const student = await Student.findOne({
        where: { user_id: user.id },
        include: [
          "user",
          "department",
          {
            association: "supervisors",
            include: ["user"],
          },
          {
            association: "doctoralCommittee",
            include: ["user"],
          },
        ],
      });

      if (!student) {
        return res.status(404).json({ message: "Student record not found" });
      }

      return res.json({
        type: "student",
        data: {
          name: `${student.user.first_name} ${student.user.last_name}`,
          phd_title: student.phd_title,
          overall_progress: student.overall_progress,
          roll_no: student.roll_no,
          department: student.department?.name,
          supervisors: student.supervisors?.map(
            (s) => `${s.user.first_name} ${s.user.last_name}`
          ),
          cgpa: student.cgpa,
          email: student.user.email,
          phone: student.user.phone,
          current_status: student.current_status,
          fathers_name: student.fathers_name,
          address: student.address,
          date_of_registration: student.date_of_registration,
          date_of_irb: student.date_of_irb,
          date_of_synopsis: student.date_of_synopsis,
          doctoral: student.doctoralCommittee?.map((faculty) => ({
            faculty_code: faculty.faculty_code,
            designation: faculty.designation,
            name: `${faculty.user.first_name} ${faculty.user.last_name}`,
            email: faculty.user.email,
            phone: faculty.user.phone,
          })),
        },
      });
    }

    // Faculty/Admin dashboard
    const faculty = await Faculty.findOne({
      where: { user_id: user.id },
      include: [
        "department",
        {
          association: "supervisedStudents",
          include: ["user"],
        },
        {
          association: "doctoredStudents",
          include: ["user"],
        },
      ],
    });

    if (!faculty) {
      return res.status(404).json({ message: "Faculty record not found" });
    }

    const supervised = faculty.supervisedStudents?.map((student) => ({
      name: `${student.user.first_name} ${student.user.last_name}`,
      roll_no: student.roll_no,
      email: student.user.email,
      phone: student.user.phone,
      overall_progress: student.overall_progress,
    }));

    const doctoral = faculty.doctoredStudents?.map((student) => ({
      name: `${student.user.first_name} ${student.user.last_name}`,
      roll_no: student.roll_no,
      email: student.user.email,
      phone: student.user.phone,
      overall_progress: student.overall_progress,
    }));

    return res.json({
      type: "faculty",
      data: {
        faculty_name: user.first_name,
        faculty_code: faculty.faculty_code,
        designation: faculty.designation,
        email: user.email,
        phone: user.phone,
        supervised_students: supervised,
        doctoral_committee_students: doctoral,
        department: faculty.department?.name,
        supervised_outside: faculty.supervised_outside,
        supervised_campus: faculty.supervised_campus,
      },
    });
  } catch (error) {
    console.error("Error in getHomeData:", error);
    return res.status(500).json({
      message: "An error occurred while fetching home data",
      error: error.message,
    });
  }
};

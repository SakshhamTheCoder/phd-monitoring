import { StudentCourse, Student, Course, User, Department, Semester } from '../../Models/index.js';
import { Op } from 'sequelize';
import fs from 'fs';
import csvParser from 'csv-parser';

export const getStudentCourses = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['student']
    });

    if (!user || !user.student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const { status } = req.query;

    const whereClause = {
      student_id: user.student.id
    };

    if (status) {
      whereClause.status = status;
    }

    const studentCourses = await StudentCourse.findAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: 'course',
          include: [
            {
              model: Department,
              as: 'department',
              attributes: ['id', 'department_name']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      student_courses: studentCourses
    });
  } catch (error) {
    console.error('Error fetching student courses:', error);
    return res.status(500).json({
      message: 'Failed to fetch student courses',
      error: error.message
    });
  }
};

export const tagStudentWithCourse = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['role']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has permission (admin, hod, or phd_coordinator)
    const allowedRoles = ['admin', 'hod', 'phd_coordinator'];
    if (!allowedRoles.includes(user.role?.name)) {
      return res.status(403).json({
        message: 'You do not have permission to tag students with courses'
      });
    }

    const { student_id, course_id, semester, status = 'ongoing', grade = null } = req.body;

    if (!student_id || !course_id || !semester) {
      return res.status(400).json({
        message: 'student_id, course_id, and semester are required'
      });
    }

    // Verify student exists
    const student = await Student.findByPk(student_id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Verify course exists
    const course = await Course.findByPk(course_id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if enrollment already exists
    const existingEnrollment = await StudentCourse.findOne({
      where: {
        student_id,
        course_id,
        semester
      }
    });

    if (existingEnrollment) {
      // Update existing enrollment
      existingEnrollment.status = status;
      existingEnrollment.grade = grade;
      await existingEnrollment.save();

      return res.status(200).json({
        message: 'Student course enrollment updated successfully',
        student_course: existingEnrollment
      });
    } else {
      // Create new enrollment
      const studentCourse = await StudentCourse.create({
        student_id,
        course_id,
        semester,
        status,
        grade
      });

      return res.status(201).json({
        message: 'Student tagged with course successfully',
        student_course: studentCourse
      });
    }
  } catch (error) {
    console.error('Error tagging student with course:', error);
    return res.status(500).json({
      message: 'Failed to tag student with course',
      error: error.message
    });
  }
};

export const updateGrade = async (req, res) => {
  try {
    const { id } = req.params;
    const { grade, status } = req.body;

    const user = await User.findByPk(req.user.id, {
      include: ['role']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has permission (admin, hod, phd_coordinator, or faculty)
    const allowedRoles = ['admin', 'hod', 'phd_coordinator', 'faculty'];
    if (!allowedRoles.includes(user.role?.name)) {
      return res.status(403).json({
        message: 'You do not have permission to update grades'
      });
    }

    const studentCourse = await StudentCourse.findByPk(id);

    if (!studentCourse) {
      return res.status(404).json({ message: 'Student course enrollment not found' });
    }

    if (grade !== undefined) {
      studentCourse.grade = grade;
    }

    if (status !== undefined) {
      studentCourse.status = status;
    }

    await studentCourse.save();

    return res.status(200).json({
      message: 'Grade updated successfully',
      student_course: studentCourse
    });
  } catch (error) {
    console.error('Error updating grade:', error);
    return res.status(500).json({
      message: 'Failed to update grade',
      error: error.message
    });
  }
};

export const bulkImportFromCSV = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['role']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has permission (admin, hod, or phd_coordinator)
    const allowedRoles = ['admin', 'hod', 'phd_coordinator'];
    if (!allowedRoles.includes(user.role?.name)) {
      return res.status(403).json({
        message: 'You do not have permission to import student courses'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'CSV file is required'
      });
    }

    const filePath = req.file.path;
    const results = [];
    const errors = [];
    let successCount = 0;
    let errorCount = 0;
    let rowNumber = 0;

    // Read and parse CSV
    const parseCSV = () => {
      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csvParser())
          .on('data', (row) => {
            results.push(row);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });
    };

    try {
      await parseCSV();

      // Process each row
      for (const row of results) {
        rowNumber++;

        try {
          // Expected CSV format: roll_number,course_code,semester,status,grade
          const { roll_number, course_code, semester, status = 'ongoing', grade = null } = row;

          if (!roll_number || !course_code || !semester) {
            errors.push({
              row: rowNumber,
              data: row,
              error: 'Missing required fields: roll_number, course_code, or semester'
            });
            errorCount++;
            continue;
          }

          // Find student by roll number
          const studentUser = await User.findOne({
            where: { roll_no: roll_number },
            include: ['student']
          });

          if (!studentUser || !studentUser.student) {
            errors.push({
              row: rowNumber,
              data: row,
              error: `Student with roll number ${roll_number} not found`
            });
            errorCount++;
            continue;
          }

          // Find course by course code
          const course = await Course.findOne({
            where: { course_code: course_code }
          });

          if (!course) {
            errors.push({
              row: rowNumber,
              data: row,
              error: `Course with code ${course_code} not found`
            });
            errorCount++;
            continue;
          }

          // Check if enrollment already exists
          const existingEnrollment = await StudentCourse.findOne({
            where: {
              student_id: studentUser.student.id,
              course_id: course.id,
              semester: semester
            }
          });

          if (existingEnrollment) {
            // Update existing enrollment
            existingEnrollment.status = status;
            existingEnrollment.grade = grade;
            await existingEnrollment.save();
          } else {
            // Create new enrollment
            await StudentCourse.create({
              student_id: studentUser.student.id,
              course_id: course.id,
              semester: semester,
              status: status,
              grade: grade
            });
          }

          successCount++;
        } catch (rowError) {
          errors.push({
            row: rowNumber,
            data: row,
            error: rowError.message
          });
          errorCount++;
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      return res.status(200).json({
        message: 'Bulk import completed',
        success_count: successCount,
        error_count: errorCount,
        errors: errors
      });
    } catch (parseError) {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      throw parseError;
    }
  } catch (error) {
    console.error('Error importing student courses:', error);
    return res.status(500).json({
      message: 'Failed to import student courses',
      error: error.message
    });
  }
};

/**
 * Get courses for a specific student
 * Matches PHP: StudentCourseController@getCoursesForStudent
 */
export const getCoursesForStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const courses = await StudentCourse.findAll({
      where: { student_id: studentId },
      include: [
        {
          model: Course,
          as: 'course',
          include: [
            {
              model: Department,
              as: 'department',
            }
          ]
        }
      ],
      order: [['semester', 'DESC']],
    });

    const result = courses.map((studentCourse) => ({
      id: studentCourse.id,
      course_code: studentCourse.course?.course_code,
      course_name: studentCourse.course?.course_name,
      credits: studentCourse.course?.credits,
      department_name: studentCourse.course?.department?.name ?? 'N/A',
      semester: studentCourse.semester,
      status: studentCourse.status,
      grade: studentCourse.grade,
    }));

    return res.status(200).json({
      success: true,
      data: result,
      student_name: student.name,
      student_code: student.student_code,
    });
  } catch (error) {
    console.error('Error fetching courses for student:', error);
    return res.status(500).json({
      message: 'An error occurred: ' + error.message,
    });
  }
};

/**
 * Remove student from course
 * Matches PHP: StudentCourseController@removeStudentFromCourse
 */
export const removeStudentFromCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const studentCourse = await StudentCourse.findByPk(id);
    if (!studentCourse) {
      return res.status(404).json({ message: 'Student course record not found' });
    }

    await studentCourse.destroy();

    return res.status(200).json({
      success: true,
      message: 'Student removed from course successfully',
    });
  } catch (error) {
    console.error('Error removing student from course:', error);
    return res.status(500).json({
      message: 'An error occurred: ' + error.message,
    });
  }
};

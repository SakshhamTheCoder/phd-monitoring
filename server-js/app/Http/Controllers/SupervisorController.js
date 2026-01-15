import { Supervisor, DoctoralCommittee, Student, Faculty, User } from '../../../models/index.js';

export const assign = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['role']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is admin
    if (user.role?.name !== 'admin') {
      return res.status(403).json({
        message: 'You do not have permission to assign supervisors'
      });
    }

    const { student_id, faculty_id } = req.body;

    if (!student_id || !faculty_id) {
      return res.status(400).json({
        message: 'student_id and faculty_id are required'
      });
    }

    // Verify student exists
    const student = await Student.findByPk(student_id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Verify faculty exists
    const faculty = await Faculty.findByPk(faculty_id);
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    // Check if supervisor assignment already exists
    const existingSupervisor = await Supervisor.findOne({
      where: {
        student_id,
        faculty_id
      }
    });

    if (existingSupervisor) {
      return res.status(400).json({
        message: 'This supervisor is already assigned to this student'
      });
    }

    const supervisor = await Supervisor.create({
      student_id,
      faculty_id
    });

    return res.status(201).json({
      message: 'Supervisor assigned successfully',
      supervisor
    });
  } catch (error) {
    console.error('Error assigning supervisor:', error);
    return res.status(500).json({
      message: 'Failed to assign supervisor',
      error: error.message
    });
  }
};

export const assignDoctoral = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['role']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is admin
    if (user.role?.name !== 'admin') {
      return res.status(403).json({
        message: 'You do not have permission to assign doctoral committee members'
      });
    }

    const { student_id, faculty_id } = req.body;

    if (!student_id || !faculty_id) {
      return res.status(400).json({
        message: 'student_id and faculty_id are required'
      });
    }

    // Verify student exists
    const student = await Student.findByPk(student_id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Verify faculty exists
    const faculty = await Faculty.findByPk(faculty_id);
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    // Check if doctoral committee assignment already exists
    const existingCommittee = await DoctoralCommittee.findOne({
      where: {
        student_id,
        faculty_id
      }
    });

    if (existingCommittee) {
      return res.status(400).json({
        message: 'This faculty is already assigned to this student\'s doctoral committee'
      });
    }

    const doctoralCommittee = await DoctoralCommittee.create({
      student_id,
      faculty_id
    });

    return res.status(201).json({
      message: 'Doctoral committee member assigned successfully',
      doctoral_committee: doctoralCommittee
    });
  } catch (error) {
    console.error('Error assigning doctoral committee member:', error);
    return res.status(500).json({
      message: 'Failed to assign doctoral committee member',
      error: error.message
    });
  }
};

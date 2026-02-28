import { Notifications, Faculty, Role, Student, User } from '../../../Models/index.js';

/**
 * NotificationManager utility functions for sending notifications
 * Equivalent to Laravel's NotificationManager trait
 */

/**
 * Send a notification to a user
 * @param {Object} user - User object
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {string} link - Notification link
 * @param {number} role_id - Optional role ID
 * @param {boolean} email_req - Whether email is required
 */
export const sendNotification = async (user, title, body, link, role_id = null, email_req = false) => {
  if (!role_id) {
    role_id = user.role_id;
  }

  await Notifications.create({
    user_id: user.id,
    title,
    body,
    link,
    role_id,
    email_req
  });
};

/**
 * Send form-related notifications based on role
 * @param {Object} student - Student object
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {string} link - Notification link
 * @param {string} role - Target role
 * @param {boolean} email_req - Whether email is required
 */
export const formNotification = async (student, title, body, link, role, email_req = false) => {
  switch (role) {
    case 'faculty':
      await sendSupervisorNotification(student, title, body, link, email_req);
      break;
    case 'doctoral':
    case 'external':
      await sendDoctoralNotification(student, title, body, link, email_req);
      break;
    case 'phd_coordinator':
      await phdCoordinatorNotification(student, title, body, link, email_req);
      break;
    case 'hod':
      await sendHodNotification(student, title, body, link, email_req);
      break;
    case 'dordc':
      await sendDordcNotification(student, title, body, link, email_req);
      break;
    case 'dra':
      await sendDraNotification(student, title, body, link, email_req);
      break;
    case 'director': {
      // Send to all users with director role
      const directorRole = await Role.findOne({ where: { role: 'director' } });
      if (directorRole) {
        const directors = await User.findAll({ where: { role_id: directorRole.id } });
        for (const director of directors) {
          await sendNotification(director, title, body, link, directorRole.id, email_req);
        }
      }
      break;
    }
    default:
      break;
  }

  // Send notification to student
  await sendStudentNotification(student, title, `Your Form has moved to ${role}, ${body}`, link, email_req);
};

/**
 * Send notification to student
 */
const sendStudentNotification = async (student, title, body, link, email_req = false) => {
  const user = await student.getUser();
  await sendNotification(user, title, body, link, null, email_req);
};

/**
 * Send notification to supervisors
 */
const sendSupervisorNotification = async (student, title, body, link, email_req = false) => {
  const supervisors = await student.getSupervisors({
    include: [{
      model: Faculty,
      as: 'faculty',
      include: [{ model: User, as: 'user' }]
    }]
  });

  const role = await Role.findOne({ where: { role: 'faculty' } });
  const role_id = role ? role.id : null;

  for (const supervisor of supervisors) {
    const faculty = await Faculty.findOne({
      where: { faculty_code: supervisor.faculty_code },
      include: [{ model: User, as: 'user' }]
    });

    if (faculty && faculty.user) {
      await sendNotification(faculty.user, title, body, link, role_id, email_req);
    }
  }
};

/**
 * Send notification to doctoral committee members
 */
const sendDoctoralNotification = async (student, title, body, link, email_req = false) => {
  const doctoralCommittee = await student.getDoctoralCommittee({
    include: [{
      model: Faculty,
      as: 'faculty',
      include: [{ model: User, as: 'user' }]
    }]
  });

  const role = await Role.findOne({ where: { role: 'doctoral' } });
  const role_id = role ? role.id : null;

  for (const member of doctoralCommittee) {
    const faculty = await Faculty.findOne({
      where: { faculty_code: member.faculty_code },
      include: [{ model: User, as: 'user' }]
    });

    if (faculty && faculty.user) {
      await sendNotification(faculty.user, title, body, link, role_id, email_req);
    }
  }
};

/**
 * Send notification to HOD
 */
const sendHodNotification = async (student, title, body, link, email_req = false) => {
  const department = await student.getDepartment({
    include: [{
      model: Faculty,
      as: 'hod',
      include: [{ model: User, as: 'user' }]
    }]
  });

  if (department && department.hod && department.hod.user) {
    await sendNotification(department.hod.user, title, body, link, null, email_req);
  }
};

/**
 * Send notification to PhD Coordinators
 */
const phdCoordinatorNotification = async (student, title, body, link, email_req = false) => {
  const department = await student.getDepartment({
    include: [{
      model: Faculty,
      as: 'phdCoordinators'
    }]
  });

  if (department && department.phdCoordinators) {
    for (const coordinator of department.phdCoordinators) {
      const faculty = await Faculty.findOne({
        where: { faculty_code: coordinator.faculty_id },
        include: [{ model: User, as: 'user' }]
      });

      if (faculty && faculty.user) {
        await sendNotification(faculty.user, title, body, link, null, email_req);
      }
    }
  }
};

const sendDordcNotification = async (student, title, body, link, email_req = false) => {
  // Send to all users with dordc role
  const dordcRole = await Role.findOne({ where: { role: 'dordc' } });
  if (dordcRole) {
    const dordcUsers = await User.findAll({ where: { role_id: dordcRole.id } });
    for (const dordcUser of dordcUsers) {
      await sendNotification(dordcUser, title, body, link, dordcRole.id, email_req);
    }
  }
};

/**
 * Send notification to DRA
 */
const sendDraNotification = async (student, title, body, link, email_req = false) => {
  // Send to all users with dra role
  const draRole = await Role.findOne({ where: { role: 'dra' } });
  if (draRole) {
    const draUsers = await User.findAll({ where: { role_id: draRole.id } });
    for (const draUser of draUsers) {
      await sendNotification(draUser, title, body, link, draRole.id, email_req);
    }
  }
};

export default {
  sendNotification,
  formNotification,
  sendStudentNotification,
  sendSupervisorNotification,
  sendDoctoralNotification,
  sendHodNotification,
  phdCoordinatorNotification,
  sendDordcNotification,
  sendDraNotification
};

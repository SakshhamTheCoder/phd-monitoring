import { Semester } from '../../../../models/index.js';
import { Op } from 'sequelize';

/**
 * HasSemesterCodeValidation utility functions for validating semester codes
 * Equivalent to Laravel's HasSemesterCodeValidation trait
 * Format: YYYYODD or YYYYEVEN (e.g., 2324ODD, 2324EVEN)
 */

/**
 * Validate semester code and return detailed information
 * @param {string} code - Semester code (e.g., "2324ODD")
 * @returns {Object} - Validation result with semester details
 */
export const validateSemesterCode = async (code) => {
  // Validate format: YYODD or YYEVEN
  const regex = /^(\d{2})(\d{2})(ODD|EVEN)$/;
  const matches = code.match(regex);

  if (!matches) {
    return invalidResult();
  }

  const [_, from, to, semText] = matches;
  const fullFrom = 2000 + parseInt(from);
  const fullTo = 2000 + parseInt(to);

  // Validate that years are consecutive
  if (fullTo !== fullFrom + 1) {
    return invalidResult();
  }

  const semesterNumber = semText === 'ODD' ? 1 : 2;

  const result = {
    valid: true,
    year: fullFrom,
    semester: semesterNumber,
    from: fullFrom,
    to: fullTo,
    current: false,
    upcoming: false,
    past: false,
    semesters_old: null,
    in_db: false,
    ppt_file: null
  };

  // Check if semester exists in database
  const semester = await Semester.findOne({
    where: {
      [Op.or]: [
        { semester_name: code },
        {
          year: fullFrom,
          semester: semesterNumber
        }
      ]
    }
  });

  if (!semester) {
    return result;
  }

  result.in_db = true;
  result.semester_id = semester.id;
  result.ppt_file = semester.ppt_file;

  // Determine if current, upcoming, or past
  const now = new Date();
  const start = semester.start_date ? new Date(semester.start_date) : null;
  const end = semester.end_date ? new Date(semester.end_date) : null;

  if (start && end) {
    if (now >= start && now <= end) {
      result.current = true;
    } else if (now < start) {
      result.upcoming = true;
    } else if (now > end) {
      result.past = true;
    }
  } else if (start && now < start) {
    result.upcoming = true;
  } else if (end && now > end) {
    result.past = true;
  }

  // Calculate how many semesters old if past
  if (result.past) {
    const latest = await Semester.findOne({
      order: [
        ['year', 'DESC'],
        ['semester', 'DESC']
      ]
    });

    if (latest && latest.id !== semester.id) {
      result.semesters_old = calculateSemesterGap(latest, semester);
    }
  }

  return result;
};

/**
 * Calculate gap between two semesters
 * @param {Object} latest - Latest semester
 * @param {Object} given - Given semester
 * @returns {number} - Number of semesters between them
 */
const calculateSemesterGap = (latest, given) => {
  const yearDiff = latest.year - given.year;
  const semDiff = latest.semester - given.semester;
  return yearDiff * 2 + semDiff;
};

/**
 * Return invalid result structure
 * @returns {Object} - Invalid result object
 */
const invalidResult = () => {
  return {
    valid: false,
    year: null,
    semester: null,
    from: null,
    to: null,
    current: false,
    upcoming: false,
    past: false,
    semesters_old: null
  };
};

export default {
  validateSemesterCode,
  calculateSemesterGap,
  invalidResult
};

// Ported from Laravel's routes/base/courses.php
import { Router } from 'express';
import * as CourseController from '../../app/Http/Controllers/CourseController.js';
import * as StudentCourseController from '../../app/Http/Controllers/StudentCourseController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

// All routes protected by auth middleware
router.use(authMiddleware);

// Course management (Admin/HOD/Coordinator)
router.get('/list', CourseController.list);
router.get('/filters', CourseController.listFilters);
router.post('/add', CourseController.add);
router.put('/update/:id', CourseController.update);
router.delete('/delete/:id', CourseController.deleteCourse);
router.get('/all', CourseController.getAllCourses);
router.post('/import', CourseController.importCoursesFromCSV);

// Student-Course management
router.get('/student/my-courses', StudentCourseController.getStudentCourses);
router.post('/student/tag', StudentCourseController.tagStudentWithCourse);
router.post('/student/bulk-import', StudentCourseController.bulkImportFromCSV);
router.put('/student/grade/:id', StudentCourseController.updateGrade);
router.get('/student/courses/:studentId', StudentCourseController.getCoursesForStudent);
router.delete('/student/remove/:id', StudentCourseController.removeStudentFromCourse);

export default router;

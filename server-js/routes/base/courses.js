// Ported from Laravel's routes/base/courses.php
import { Router } from 'express';
// TODO: Import auth:sanctum middleware equivalent
// TODO: Import CourseController, StudentCourseController
const router = Router();

// All routes below should be protected by auth:sanctum middleware
// TODO: Add auth middleware when implemented

// Course management (Admin/HOD/Coordinator)
router.get('/list', (req, res) => {
    // TODO: CourseController.list
    res.status(501).json({ todo: 'CourseController.list' });
});
router.get('/filters', (req, res) => {
    // TODO: CourseController.listFilters
    res.status(501).json({ todo: 'CourseController.listFilters' });
});
router.post('/add', (req, res) => {
    // TODO: CourseController.add
    res.status(501).json({ todo: 'CourseController.add' });
});
router.put('/update/:id', (req, res) => {
    // TODO: CourseController.update
    res.status(501).json({ todo: 'CourseController.update' });
});
router.delete('/delete/:id', (req, res) => {
    // TODO: CourseController.delete
    res.status(501).json({ todo: 'CourseController.delete' });
});
router.get('/all', (req, res) => {
    // TODO: CourseController.getAllCourses
    res.status(501).json({ todo: 'CourseController.getAllCourses' });
});
router.post('/import', (req, res) => {
    // TODO: CourseController.importCoursesFromCSV
    res.status(501).json({ todo: 'CourseController.importCoursesFromCSV' });
});

// Student-Course management
router.get('/student/my-courses', (req, res) => {
    // TODO: StudentCourseController.getStudentCourses
    res.status(501).json({ todo: 'StudentCourseController.getStudentCourses' });
});
router.post('/student/tag', (req, res) => {
    // TODO: StudentCourseController.tagStudentWithCourse
    res.status(501).json({ todo: 'StudentCourseController.tagStudentWithCourse' });
});
router.post('/student/bulk-import', (req, res) => {
    // TODO: StudentCourseController.bulkImportFromCSV
    res.status(501).json({ todo: 'StudentCourseController.bulkImportFromCSV' });
});
router.put('/student/grade/:id', (req, res) => {
    // TODO: StudentCourseController.updateGrade
    res.status(501).json({ todo: 'StudentCourseController.updateGrade' });
});
router.get('/student/courses/:studentId', (req, res) => {
    // TODO: StudentCourseController.getCoursesForStudent
    res.status(501).json({ todo: 'StudentCourseController.getCoursesForStudent' });
});
router.delete('/student/remove/:id', (req, res) => {
    // TODO: StudentCourseController.removeStudentFromCourse
    res.status(501).json({ todo: 'StudentCourseController.removeStudentFromCourse' });
});

export default router;


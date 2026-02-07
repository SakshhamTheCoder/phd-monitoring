/**
 * PresentationController
 * Ported from PHP: app/Http/Controllers/PresentationController.php
 * 
 * Handles PhD presentation scheduling, submissions, and reviews
 */

import {
    handleStudentForm,
    handleHodForm,
    handleAdminForm,
    handleAdordcForm,
    handleFacultyForm,
    handleDoctoralForm
} from './Traits/GeneralFormHandler.js';
import { submitForm } from './Traits/GeneralFormSubmitter.js';
import { listForms, getAvailableFilters } from './Traits/GeneralFormList.js';
import { saveUploadedFile } from './Traits/SaveFile.js';
import { validateSemesterCode } from './Traits/HasSemesterCodeValidation.js';
import {
    Presentation,
    PresentationReview,
    Student,
    Semester,
    Publication,
    Patent
} from '../../Models/index.js';
import PresentationService from '../../Services/PresentationService.js';

/**
 * Get available filters for presentations
 */
export const listFilters = async (req, res) => {
    try {
        const filters = await getAvailableFilters('presentation');
        return res.status(200).json(filters);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Helper to check if array is associative
 */
const isAssoc = (arr) => {
    if (!Array.isArray(arr)) return true;
    return arr.length > 0 && Object.keys(arr).some(k => isNaN(k));
};

/**
 * List presentations with filtering
 */
export const listForm = async (req, res) => {
    try {
        const user = req.user;
        const { semester_id } = req.params;
        let filters = req.query.filters;

        if (filters && typeof filters === 'string') {
            try {
                filters = JSON.parse(decodeURIComponent(filters));
            } catch (e) {
                filters = null;
            }
        }

        // Validate semester
        if (semester_id) {
            const validator = validateSemesterCode(semester_id);
            if (!validator.valid) {
                return res.status(422).json({ message: 'Invalid Semester Code' });
            }
        }

        const mandatoryFilter = filters?.mandatory_filter || null;
        let parsedFilters = [];
        if (Array.isArray(mandatoryFilter)) {
            parsedFilters = isAssoc(mandatoryFilter) ? [mandatoryFilter] : mandatoryFilter;
        }

        const isMissing = parsedFilters.some(f => f?.key === 'missed' && String(f?.value) === '1');
        const isUpcoming = parsedFilters.some(f => f?.key === 'upcoming' && String(f?.value) === '1');
        const isAction = parsedFilters.some(f => f?.key === 'action' && String(f?.value) === '1');

        let titles = ['Name', 'Roll No', 'Date', 'Time', 'Progress %', 'Supervisors'];
        let fields = ['name', 'roll_no', 'date', 'time', 'progress', 'supervisors'];
        const mandatoryFilters = [];

        if (isMissing) {
            mandatoryFilters.push({
                key: 'date',
                op: '<',
                value: new Date().toISOString().split('T')[0]
            });
            mandatoryFilters.push({ key: 'leave', op: '=', value: 0 });
            titles = ['Name', 'Roll No', 'Date', 'Time', 'Supervisors'];
            fields = ['name', 'roll_no', 'date', 'time', 'supervisors'];
        }

        if (isUpcoming) {
            parsedFilters = parsedFilters.filter(f => !(f?.key === 'upcoming' && ['1', 1].includes(f?.value)));
            mandatoryFilters.push({
                key: 'date',
                op: '>=',
                value: new Date().toISOString().split('T')[0]
            });
            mandatoryFilters.push({ key: 'leave', op: '=', value: 0 });
            mandatoryFilters.push({ key: 'missed', op: '=', value: 1 });
            titles = ['Name', 'Roll No', 'Date', 'Time', 'Meet Link', 'Supervisors'];
            fields = ['name', 'roll_no', 'date', 'time', 'venue', 'supervisors'];
        }

        if (isAction) {
            parsedFilters = parsedFilters.filter(f => !(f?.key === 'action' && ['1', 1].includes(f?.value)));
            let role = user.current_role?.role;
            if (role === 'faculty') role = 'supervisor';
            mandatoryFilters.push({ key: `${role}_lock`, op: '=', value: 0 });
        }

        if (semester_id) {
            mandatoryFilters.push({ key: 'period_of_report', op: '=', value: semester_id });
        }

        if (mandatoryFilter && filters) {
            filters.mandatory_filter = [...parsedFilters, ...mandatoryFilters];
        }

        if (!semester_id) {
            titles.push('Semester');
            fields.push('period');
        }

        const result = await listForms(user, Presentation, req, filters, true, {
            fields,
            titles,
            extra_fields: {
                overall_progress: (form) => form.student?.overall_progress,
                progress: (form) => form.progress,
                supervisors: (form) => {
                    if (!form.student?.supervisors) return '';
                    return form.student.supervisors.map(s => s.user?.name).join(', ');
                },
                phone: (form) => form.student?.user?.phone,
                date: (form) => form.date,
                time: (form) => form.time,
                period: (form) => form.period_of_report,
                venue: (form) => form.venue
            }
        });

        return res.status(result.status || 200).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Create presentation - Faculty/Coordinator only
 */
export const createForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role?.role;

        if (role !== 'faculty' && role !== 'phd_coordinator') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { student_id, date, time, period_of_report, guest_emails, venue } = req.body;

        if (!student_id || !date || !time || !period_of_report) {
            return res.status(422).json({ message: 'student_id, date, time, and period_of_report are required' });
        }

        const validator = validateSemesterCode(period_of_report);
        if (!validator.valid) {
            return res.status(422).json({ message: 'Invalid Semester Code' });
        }
        if (!validator.current && !validator.upcoming && !validator.in_db) {
            return res.status(422).json({ message: 'Presentation cannot be scheduled for Past Semester' });
        }

        const student = await Student.findOne({ where: { roll_no: student_id } });
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check authorization
        const isSupersvisor = await student.checkSupervises?.(user.faculty?.faculty_code);
        const isCoordinator = await student.department?.checkCoordinates?.(user.faculty?.faculty_code);
        if (!isSupersvisor && !isCoordinator) {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        // Check for existing presentation
        const existing = await Presentation.findOne({
            where: { student_id: student_id, semester_id: validator.semester_id }
        });
        if (existing) {
            return res.status(403).json({ message: 'Presentation already scheduled for this period' });
        }

        const emails = await emailList(student, req);

        const form = await Presentation.create({
            student_id: student_id,
            date: date,
            time: time,
            period_of_report: period_of_report,
            status: 'pending',
            ppt_file: validator.ppt_file,
            completion: 'incomplete',
            semester_id: validator.semester_id,
            total_progress: student.overall_progress,
            steps: JSON.stringify(['student', 'faculty', 'doctoral', 'hod', 'adordc', 'dordc', 'dra', 'complete'])
        });

        if (!venue) {
            try {
                const calendarResult = await PresentationService.scheduleCalendarEvent(
                    `PhD Presentation - ${student.user?.first_name} ${student.user?.last_name}`,
                    `PhD Presentation scheduled for term ${period_of_report}`,
                    date,
                    time,
                    emails
                );
                form.venue = calendarResult.meet_link;
            } catch (e) {
                form.venue = 'TBD';
            }
        } else {
            form.venue = venue;
        }

        await form.save();
        if (form.addHistoryEntry) {
            await form.addHistoryEntry('Presentation Scheduled by Supervisor', user.first_name);
        }

        return res.status(201).json(form);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * List semester presentations
 */
export const listSemesterPresentation = async (req, res) => {
    try {
        const user = req.user;
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.per_page) || 10;

        const currentDate = new Date();
        const { count, rows } = await Semester.findAndCountAll({
            where: { end_date: { [require('sequelize').Op.lt]: currentDate } },
            order: [['year', 'DESC'], ['semester', 'DESC']],
            limit: perPage,
            offset: (page - 1) * perPage
        });

        const data = rows.map(semester => ({
            semester_name: semester.semester_name,
            start_date: new Date(semester.start_date).toLocaleDateString('en-GB'),
            end_date: new Date(semester.end_date).toLocaleDateString('en-GB'),
            semester: semester.semester,
            year: semester.year
        }));

        return res.status(200).json({
            data,
            page,
            total: count,
            totalPages: Math.ceil(count / perPage),
            fields: ['semester_name', 'start_date', 'end_date', 'semester', 'year'],
            fieldsTitles: ['Semester Name', 'Start Date', 'End Date', 'Semester', 'Year'],
            role: user.current_role?.role
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Mark leave for a semester
 */
export const markLeave = async (req, res) => {
    try {
        const user = req.user;
        if (user.current_role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { period_of_report, leave, student_id, date, time } = req.body;
        const validator = validateSemesterCode(period_of_report);
        if (!validator.valid) {
            return res.status(422).json({ message: 'Invalid Semester Code' });
        }

        const existing = await Presentation.findOne({
            where: { student_id, semester_id: validator.semester_id }
        });

        if (existing) {
            existing.leave = leave;
            await existing.save();
            return res.status(200).json({ message: 'Leave marked successfully' });
        } else {
            await Presentation.create({
                student_id,
                date,
                time,
                period_of_report,
                status: 'pending',
                completion: 'incomplete',
                semester_id: validator.semester_id,
                leave,
                steps: JSON.stringify(['student', 'faculty', 'doctoral', 'hod', 'adordc', 'dordc', 'dra', 'complete'])
            });
            return res.status(201).json({ message: 'Leave marked successfully' });
        }
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Create multiple presentations at once
 */
export const createMultipleForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role?.role;

        if (role !== 'faculty' && role !== 'phd_coordinator') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { semester, students } = req.body;
        const validator = validateSemesterCode(semester);
        if (!validator.valid) {
            return res.status(422).json({ message: 'Invalid Semester Code' });
        }

        const createdForms = [];
        const errors = [];

        for (const studentData of students) {
            const student = await Student.findOne({ where: { roll_no: studentData.student_id } });

            if (!student) {
                errors.push({ student_id: studentData.student_id, message: 'Student not found' });
                continue;
            }

            const isSupersvisor = await student.checkSupervises?.(user.faculty?.faculty_code);
            const isCoordinator = await student.department?.checkCoordinates?.(user.faculty?.faculty_code);
            if (!isSupersvisor && !isCoordinator) {
                errors.push({ student_id: studentData.student_id, message: 'Not authorized to schedule for student' });
                continue;
            }

            const exists = await Presentation.findOne({
                where: { student_id: studentData.student_id, semester_id: validator.semester_id }
            });
            if (exists) {
                errors.push({ student_id: studentData.student_id, message: 'Presentation already scheduled' });
                continue;
            }

            const form = await Presentation.create({
                student_id: studentData.student_id,
                semester_id: validator.semester_id,
                period_of_report: studentData.period_of_report,
                date: studentData.date,
                time: studentData.time,
                leave: studentData.leave || false,
                status: 'pending',
                ppt_file: validator.ppt_file,
                completion: 'incomplete',
                steps: JSON.stringify(['student', 'faculty', 'doctoral', 'hod', 'adordc', 'dordc', 'dra', 'complete'])
            });

            const emails = await emailList(student, req);
            try {
                const calendarResult = await PresentationService.scheduleCalendarEvent(
                    `PhD Presentation - ${student.user?.first_name}`,
                    `PhD Presentation scheduled`,
                    studentData.date,
                    studentData.time,
                    emails
                );
                form.venue = calendarResult.event_link;
                await form.save();
            } catch (e) {
                // Calendar event failed, continue
            }

            createdForms.push(form);
        }

        if (errors.length > 0) {
            return res.status(422).json({ created_forms: createdForms, errors });
        }
        return res.status(200).json({ created_forms: createdForms, errors });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Load presentation form
 */
export const loadForm = async (req, res) => {
    try {
        const user = req.user;
        const { form_id } = req.params;
        const steps = ['student', 'faculty', 'doctoral', 'hod', 'dra', 'adordc', 'dordc', 'dra', 'complete'];
        const Model = Presentation;

        const form = await Presentation.findByPk(form_id, {
            include: [{ association: 'student' }]
        });

        let role = user.current_role?.role;

        // Check if user is on doctoral committee
        if (form && user.faculty?.faculty_code) {
            const isDoctoral = await form.student?.checkDoctoralCommittee?.(user.faculty.faculty_code);
            if (isDoctoral) role = 'doctoral';
        }

        let result;
        switch (role) {
            case 'student':
                result = await handleStudentForm(user, form_id, Model, steps);
                break;
            case 'hod':
                result = await handleHodForm(user, form_id, Model);
                break;
            case 'doctoral':
            case 'external':
                result = await handleDoctoralForm(user, form_id, Model);
                break;
            case 'dra':
            case 'dordc':
                result = await handleAdminForm(user, form_id, Model);
                break;
            case 'adordc':
                result = await handleAdordcForm(user, form_id, Model);
                break;
            case 'faculty':
                result = await handleFacultyForm(user, form_id, Model);
                break;
            case 'admin':
                result = await handleAdminForm(user, form_id, Model, true);
                break;
            default:
                return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        return res.status(result.status).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Submit presentation - role-based dispatch
 */
export const submit = async (req, res) => {
    try {
        const user = req.user;
        const { form_id } = req.params;

        const form = await Presentation.findByPk(form_id, {
            include: [{ association: 'student' }]
        });

        let role = user.current_role?.role;
        if (form && user.faculty?.faculty_code) {
            const isDoctoral = await form.student?.checkDoctoralCommittee?.(user.faculty.faculty_code);
            if (isDoctoral) role = 'doctoral';
        }

        let result;
        switch (role) {
            case 'student':
                result = await studentSubmit(user, req, form_id);
                break;
            case 'faculty':
                result = await supervisorSubmit(user, req, form_id);
                break;
            case 'hod':
                result = await hodSubmit(user, req, form_id);
                break;
            case 'dra':
                result = await draSubmit(user, req, form_id);
                break;
            case 'dordc':
                result = await dordcSubmit(user, req, form_id);
                break;
            case 'adordc':
                result = await adordcSubmit(user, req, form_id);
                break;
            case 'doctoral':
                result = await doctoralSubmit(user, req, form_id);
                break;
            default:
                return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        return res.status(result.status || 200).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Bulk submit presentations
 */
export const bulkSubmit = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role?.role;
        const allowedRoles = ['hod', 'dra', 'dordc', 'doctoral', 'adordc'];

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { form_ids } = req.body;
        if (!form_ids || !Array.isArray(form_ids)) {
            return res.status(422).json({ message: 'form_ids array is required' });
        }

        for (const formId of form_ids) {
            req.params.form_id = formId;
            await submit(req, { status: () => ({ json: () => {} }) });
        }

        return res.status(200).json({ message: 'Forms submitted successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Link publications to presentation
 */
export const linkPublication = async (req, res) => {
    try {
        const user = req.user;
        if (user.current_role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { form_id } = req.params;
        const { publications = [], patents = [] } = req.body;

        const formInstance = await Presentation.findByPk(form_id);
        if (!formInstance) {
            return res.status(404).json({ message: 'Form not found' });
        }

        // Link publications
        for (const pubId of publications) {
            const publication = await Publication.findByPk(pubId);
            if (!publication) {
                return res.status(400).json({ message: 'Invalid publication selected' });
            }
            if (publication.student_id !== user.student?.roll_no) {
                return res.status(400).json({ message: 'Invalid publication selected' });
            }

            const existing = await Publication.findOne({
                where: {
                    title: publication.title,
                    form_id: formInstance.id,
                    form_type: 'progress'
                }
            });
            if (existing) {
                return res.status(400).json({ message: 'Publication already linked' });
            }

            await Publication.create({
                ...publication.toJSON(),
                id: undefined,
                form_id: formInstance.id,
                form_type: 'progress'
            });
        }

        // Link patents
        for (const patId of patents) {
            const patent = await Patent.findByPk(patId);
            if (!patent) {
                return res.status(400).json({ message: 'Invalid patent selected' });
            }
            if (patent.student_id !== user.student?.roll_no) {
                return res.status(400).json({ message: 'Invalid patent selected' });
            }

            await Patent.create({
                ...patent.toJSON(),
                id: undefined,
                form_id: formInstance.id,
                form_type: 'progress'
            });
        }

        return res.status(200).json({ message: 'Publications linked to Presentation' });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

/**
 * Unlink publications from presentation
 */
export const unlinkPublication = async (req, res) => {
    try {
        const user = req.user;
        if (user.current_role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { form_id } = req.params;
        const { publications = [], patents = [] } = req.body;

        for (const pubId of publications) {
            await Publication.destroy({
                where: { id: pubId, form_id: form_id, form_type: 'progress' }
            });
        }

        for (const patId of patents) {
            await Patent.destroy({
                where: { id: patId, form_id: form_id, form_type: 'progress' }
            });
        }

        return res.status(200).json({ message: 'Publications unlinked from Presentation' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// --- Private submission handlers ---

const studentSubmit = async (user, req, form_id) => {
    const { teaching_work } = req.body;

    return await submitForm(user, req, form_id, Presentation, 'student', 'student', 'faculty', async (formInstance) => {
        if (!teaching_work) {
            throw new Error('teaching_work is required');
        }

        formInstance.teaching_work = teaching_work;

        // Save presentation PDF
        if (req.file) {
            const link = await saveUploadedFile(req.file, 'presentation_pdf', user.student.roll_no);
            formInstance.presentation_pdf = link;
        }

        formInstance.missed = 0;
        await formInstance.save();

        // Create supervisor reviews
        const supervisors = await user.student?.getSupervisors?.() || [];
        for (const sup of supervisors) {
            await PresentationReview.create({
                presentation_id: formInstance.id,
                faculty_id: sup.faculty_code,
                comments: '',
                review_status: 'pending',
                is_supervisor: 1
            });
        }
    });
};

const supervisorSubmit = async (user, req, form_id) => {
    const { progress, attendance, contact_hours, approval, comments } = req.body;

    return await submitForm(user, req, form_id, Presentation, 'faculty', 'student', 'doctoral', async (formInstance) => {
        // Set progress if not already set
        if (!formInstance.progress || !formInstance.attendance || !formInstance.contact_hours) {
            if (!progress || !attendance || contact_hours === undefined) {
                throw new Error('progress, attendance, and contact_hours are required');
            }
            formInstance.progress = parseInt(progress);
            formInstance.attendance = parseFloat(attendance);
            formInstance.contact_hours = parseInt(contact_hours);
            formInstance.current_progress = formInstance.student.overall_progress;
            formInstance.total_progress = formInstance.student.overall_progress + parseInt(progress);
            await formInstance.save();
        }

        const existingReview = await PresentationReview.findOne({
            where: { presentation_id: formInstance.id, faculty_id: user.faculty.faculty_code }
        });

        if (existingReview?.review_status === 'completed') {
            throw new Error('You have already reviewed this form');
        }

        if (approval) {
            await PresentationReview.update(
                { progress: 'satisfactory', review_status: 'completed', comments },
                { where: { presentation_id: formInstance.id, is_supervisor: 1, faculty_id: user.faculty.faculty_code } }
            );

            const pendingApprovals = await PresentationReview.count({
                where: { presentation_id: formInstance.id, is_supervisor: 1, review_status: 'pending' }
            });

            if (pendingApprovals > 0) {
                const error = new Error('Your preferences saved. Please wait for other supervisors');
                error.code = 201;
                throw error;
            }

            // Create doctoral committee reviews
            const doctoral = await formInstance.student?.getDoctoralCommittee?.() || [];
            for (const doc of doctoral) {
                await PresentationReview.create({
                    presentation_id: formInstance.id,
                    faculty_id: doc.faculty_code,
                    comments: '',
                    review_status: 'pending',
                    is_supervisor: 0
                });
            }
        }
    });
};

const doctoralSubmit = async (user, req, form_id) => {
    const { approval, comments } = req.body;

    return await submitForm(user, req, form_id, Presentation, 'doctoral', 'faculty', 'hod', async (formInstance) => {
        const existingReview = await PresentationReview.findOne({
            where: { presentation_id: formInstance.id, is_supervisor: 0, faculty_id: user.faculty.faculty_code }
        });

        if (existingReview?.review_status === 'completed') {
            throw new Error('You have already reviewed this form');
        }

        const updateData = approval
            ? { progress: 'satisfactory', review_status: 'completed', comments }
            : { progress: 'not satisfactory', review_status: 'completed', comments };

        await PresentationReview.update(updateData, {
            where: { presentation_id: formInstance.id, faculty_id: user.faculty.faculty_code }
        });

        const pendingApprovals = await PresentationReview.count({
            where: { presentation_id: formInstance.id, is_supervisor: 0, review_status: 'pending' }
        });

        if (pendingApprovals > 0) {
            const error = new Error('Your preferences saved. Please wait for other committee members');
            error.code = 201;
            throw error;
        }
    });
};

const hodSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, Presentation, 'hod', 'faculty', 'adordc');
};

const adordcSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, Presentation, 'adordc', 'hod', 'dordc');
};

const dordcSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, Presentation, 'dordc', 'adordc', 'dra');
};

const draSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, Presentation, 'dra', 'dordc', 'complete', async (formInstance) => {
        formInstance.completion = 'complete';
        formInstance.status = 'approved';
        formInstance.student.overall_progress = formInstance.total_progress;
        await formInstance.student.save();
    });
};

/**
 * Build email list for calendar invites
 */
const emailList = async (student, req) => {
    const emails = [];

    // Supervisor emails
    const supervisors = await student.getSupervisors?.() || [];
    for (const sup of supervisors) {
        if (sup.user?.email) emails.push(sup.user.email);
    }

    // Guest emails
    if (Array.isArray(req.body?.guest_emails)) {
        emails.push(...req.body.guest_emails.filter(e => e));
    }

    // Doctoral committee emails
    const committee = await student.getDoctoralCommittee?.() || [];
    for (const doc of committee) {
        if (doc.user?.email) emails.push(doc.user.email);
    }

    // PhD coordinator emails
    const department = await student.getDepartment?.();
    const coordinators = await department?.getPhdCoordinators?.() || [];
    for (const coord of coordinators) {
        if (coord.email) emails.push(coord.email);
    }

    // HOD email
    const hod = await department?.getHod?.();
    if (hod?.user?.email) emails.push(hod.user.email);

    // Student email
    if (student.user?.email) emails.push(student.user.email);

    return [...new Set(emails.filter(e => e))];
};

export default {
    listFilters,
    listForm,
    createForm,
    listSemesterPresentation,
    markLeave,
    createMultipleForm,
    loadForm,
    submit,
    bulkSubmit,
    linkPublication,
    unlinkPublication
};

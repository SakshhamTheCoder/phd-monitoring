import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

class Presentation extends Model {

    // --- Trait Logic: ModelCommonFormFields ---
    getCommonFields() {
        return {
            student_id: this.student_id,
            status: this.status,
            stage: this.stage,
            completion: this.completion,
            steps: this.steps,
            current_step: this.current_step,
            maximum_step: this.maximum_step,
            student_lock: this.student_lock,
            hod_lock: this.hod_lock,
            supervisor_lock: this.supervisor_lock,
            dordc_lock: this.dordc_lock,
            adordc_lock: this.adordc_lock,
            dra_lock: this.dra_lock,
            external_lock: this.external_lock,
            director_lock: this.director_lock,
            phd_coordinator_lock: this.phd_coordinator_lock,
            doctoral_lock: this.doctoral_lock,
            student_comments: this.student_comments,
            hod_comments: this.hod_comments,
            supervisor_comments: this.supervisor_comments,
            dordc_comments: this.dordc_comments,
            adordc_comments: this.adordc_comments,
            external_comments: this.external_comments,
            dra_comments: this.dra_comments,
            director_comments: this.director_comments,
            doctoral_comments: this.doctoral_comments,
            phd_coordinator_comments: this.phd_coordinator_comments,
            supervisor_approval: this.supervisor_approval,
            phd_coordinator_approval: this.phd_coordinator_approval,
            hod_approval: this.hod_approval,
            dordc_approval: this.dordc_approval,
            adordc_approval: this.adordc_approval,
            external_approval: this.external_approval,
            doctoral_approval: this.doctoral_approval,
            dra_approval: this.dra_approval,
            director_approval: this.director_approval,
            history: this.history,
        };
    }

    async addHistoryEntry(action, user, comments = null, status = null) {
        const entry = { action, user, status, comment: comments, timestamp: new Date() };
        let history = this.history || [];
        if (!Array.isArray(history)) history = [];
        history.push(entry);
        this.history = history;
        return await this.save();
    }

    async fullCommonForm(user, extraData = []) {
        const student = await this.getStudent();
        if (!student) throw new Error("Student not found");
        const studentUser = await student.getUser();
        const department = await student.getDepartment();
        const supervisors = await student.getSupervisors();
        const currentUserRole = user.current_role ? user.current_role.role : null;

        const commonJSON = {
            form_id: this.id,
            name: studentUser ? studentUser.name : null,
            roll_no: student.roll_no,
            email: studentUser ? studentUser.email : null,
            phone: studentUser ? studentUser.phone : null,
            department: department ? department.name : null,
            date_of_registration: student.date_of_registration,
            phd_title: student.phd_title,
            gender: studentUser ? studentUser.gender : null,
            cgpa: student.cgpa,
            role: currentUserRole,
            semester: this.semester,
            supervisors: supervisors ? await Promise.all(supervisors.map(async (sup) => {
                const supUser = await sup.getUser();
                const supDept = await sup.getDepartment();
                return {
                    name: supUser ? supUser.name : null,
                    designation: sup.designation,
                    department: supDept ? supDept.name : null
                };
            })) : [],
            status: this.status,
            stage: this.stage,
            comments: {
                student: this.student_comments,
                hod: this.hod_comments,
                supervisor: this.supervisor_comments,
                phd_coordinator: this.phd_coordinator_comments,
                dordc: this.dordc_comments,
                adordc: this.adordc_comments,
                dra: this.dra_comments,
                doctoral: this.doctoral_comments,
                external: this.external_comments,
                director: this.director_comments,
            },
            locks: {
                student: this.student_lock,
                hod: this.hod_lock,
                supervisor: this.supervisor_lock,
                phd_coordinator: this.phd_coordinator_lock,
                dordc: this.dordc_lock,
                adordc: this.adordc_lock,
                dra: this.dra_lock,
                doctoral: this.doctoral_lock,
                external: this.external_lock,
                director: this.director_lock,
            },
            approvals: {
                supervisor: this.supervisor_approval,
                phd_coordinator: this.phd_coordinator_approval,
                hod: this.hod_approval,
                dordc: this.dordc_approval,
                adordc: this.adordc_approval,
                dra: this.dra_approval,
                doctoral: this.doctoral_approval,
                external: this.external_approval,
                director: this.director_approval,
            },
            steps: this.steps,
            current_step: this.current_step,
            maximum_step: this.maximum_step,
            history: this.history,
            role: currentUserRole,
            created_at: this.created_at,
            updated_at: this.updated_at,
            department_id: department ? department.id : null,
            ...extraData
        };
        if (currentUserRole !== 'student') commonJSON.department_id = department ? department.id : null;
        return commonJSON;
    }
    // --- End Trait Logic ---

    async fullForm(user) {
        const commonJSON = await this.fullCommonForm(user);

        const { Publication, Patent, ResearchExtentions, Faculty, User } = sequelize.models; // Avoiding overrides
        // Assuming ResearchExtentions exists or will exist. If not, this might error. PHP implies it.
        // It's not in S or P lists. Might be in batch 4 (others). 
        // I will assume it's created or available via models. If strict porting, I rely on it existing.
        // If not, I should define it or handle it. For now, strict port assumes existing ecosystem.

        const studentId = this.student_id;
        const formId = this.id;
        const baseCriteria = { student_id: studentId, form_type: 'progress', form_id: formId };

        const publicationsQuery = async (filters) => {
            return await Publication.findAll({ where: { ...baseCriteria, ...filters } });
        };
        const publicationsCount = await Publication.count({ where: baseCriteria });

        const patents = await Patent.findAll({ where: { student_id: studentId, form_id: formId } });

        // Doctoral Committee
        const student = await this.getStudent();
        // PHP: $this->student->doctoralCommittee
        const doctoralCommittee = await student.getDoctoralCommittee(); // Relation
        const doctoralCommitteeMapped = await Promise.all(doctoralCommittee.map(async (committee) => {
            // committee is DoctoralCommittee model?
            // PHP: Faculty::where('faculty_code', $committee->faculty_code)->first()
            // committee seems to be the pivot or member record.
            const faculty = await Faculty.findOne({ where: { faculty_code: committee.faculty_code }, include: ['department'] });
            if (!faculty) return null;
            const facUser = await User.findByPk(faculty.user_id);
            return {
                name: facUser ? facUser.name : null,
                department: faculty.department ? faculty.department.name : null,
                designation: faculty.designation
            };
        }));

        // Extension Availed
        let extensionAvailed = false;
        if (sequelize.models.ResearchExtentions) {
            const extCount = await sequelize.models.ResearchExtentions.count({ where: { student_id: studentId } });
            extensionAvailed = extCount > 0;
        }

        // Reviews
        const supervisorReviews = await this.getSupervisorReviews({ include: [{ model: Faculty, as: 'faculty', include: ['user'] }] });
        const supervisorReviewsMapped = supervisorReviews.map(review => ({
            faculty: review.faculty && review.faculty.user ? review.faculty.user.name : null,
            progress: review.progress,
            comments: review.comments,
            review_status: review.review_status
        }));

        const doctoralCommitteeReviews = await this.getDoctoralCommitteeReviews({ include: [{ model: Faculty, as: 'faculty', include: ['user'] }] });
        const doctoralCommitteeReviewsMapped = doctoralCommitteeReviews.map(review => ({
            faculty: review.faculty && review.faculty.user ? review.faculty.user.name : null,
            progress: review.progress,
            comments: review.comments,
            review_status: review.review_status
        }));


        let formData = Object.assign(commonJSON, {
            doctoral_committee: doctoralCommitteeMapped.filter(x => x),
            date: this.date,
            time: this.time,
            venue: this.venue,
            current_progress: student.overall_progress,
            period_of_report: this.period_of_report,
            extention_availed: extensionAvailed,
            teaching_work: this.teaching_work,
            ppt_file: this.ppt_file,
            progress: this.progress,
            total_progress: this.total_progress,
            contact_hours: this.contact_hours,
            attendance: this.attendance,
            overall_progress: this.overall_progress,
            presentation_pdf: this.presentation_pdf,
            supervisorReviews: supervisorReviewsMapped,
            doctoralCommitteeReviews: doctoralCommitteeReviewsMapped,
            publication_count: publicationsCount,
            sci: await publicationsQuery({ publication_type: 'journal', type: 'sci' }),
            non_sci: await publicationsQuery({ publication_type: 'journal', type: 'non-sci' }),
            national: await publicationsQuery({ publication_type: 'conference', type: 'national' }),
            international: await publicationsQuery({ publication_type: 'conference', type: 'international' }),
            book: await publicationsQuery({ publication_type: 'book' }),
            patents: patents,
        });

        // Extras
        const countPubs = async (filters, nullForm = false) => {
            const where = { student_id: studentId, ...filters };
            if (nullForm) where.form_id = null;
            return await Publication.count({ where });
        };

        const extraData = {
            no_paper_sci_journal: formData.sci.length,
            no_paper_scopus_journal: formData.non_sci.length,
            no_paper_conference: formData.national.length + formData.international.length,
            no_paper_book: formData.book.length,
            no_patents: formData.patents.length,
            total_paper_sci_journal: await countPubs({ publication_type: 'journal', type: 'sci' }, true)
        };

        if (user.current_role && user.current_role.role === 'student') {
            // Fetch null form items
            const nullForm = { student_id: studentId, form_id: null };
            const extraPubs = async (filters) => await Publication.findAll({ where: { ...nullForm, ...filters } });

            extraData.student_publications = {
                sci: await extraPubs({ publication_type: 'journal', type: 'sci' }),
                non_sci: await extraPubs({ publication_type: 'journal', type: 'non-sci' }),
                national: await extraPubs({ publication_type: 'conference', type: 'national' }),
                international: await extraPubs({ publication_type: 'conference', type: 'international' }),
                book: await extraPubs({ publication_type: 'book' }),
                patents: await Patent.findAll({ where: nullForm })
            };
        }

        formData = Object.assign(formData, extraData);

        // Current Review logic
        // Need to check if user.faculty exists
        // Sequelize user.getFaculty() or if eagerly loaded
        // Logic assumes user.faculty is loaded or available
        // PHP: $user->faculty?->faculty_code
        // We might need to fetch it if not present
        let facId = null;
        if (user.faculty) {
            facId = user.faculty.faculty_code;
        } else {
            // Try fetching
            const fac = await user.getFaculty();
            if (fac) facId = fac.faculty_code;
        }

        if (facId) {
            // checkDoctoralCommittee and checkSupervises are methods on Student model
            if (await student.checkDoctoralCommittee(facId)) {
                // Find review in loaded collection
                formData.current_review = doctoralCommitteeReviews.find(r => r.faculty_id == facId);
            }
            if (await student.checkSupervises(facId)) {
                formData.current_review = supervisorReviews.find(r => r.faculty_id == facId);
            }
        }

        return formData;
    }

    // Scopes / Relations
    async supervisorReviews() {
        return await this.getSupervisorReviews();
    }
    async doctoralCommitteeReviews() {
        return await this.getDoctoralCommitteeReviews();
    }

    static associate(models) {
        Presentation.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
        Presentation.belongsTo(models.Semester, { foreignKey: 'semester_id', as: 'semester' });

        Presentation.hasMany(models.PresentationReview, { foreignKey: 'presentation_id', as: 'reviews' });
        // Scoped associations are tricky in static associate, often better strictly defined
        // We can define separate hasMany with scopes if needed or filter in retrieval
        // PHP defines relations with where calls.
        // We can define aliases:
        Presentation.hasMany(models.PresentationReview, {
            foreignKey: 'presentation_id',
            as: 'supervisorReviews',
            scope: { is_supervisor: true }
        });
        Presentation.hasMany(models.PresentationReview, {
            foreignKey: 'presentation_id',
            as: 'doctoralCommitteeReviews',
            scope: { is_supervisor: false }
        });
    }
}

Presentation.init({
    // Common fields
    student_id: DataTypes.STRING,
    status: DataTypes.STRING,
    stage: DataTypes.STRING,
    completion: DataTypes.STRING,
    steps: DataTypes.JSON,
    current_step: DataTypes.INTEGER,
    maximum_step: DataTypes.INTEGER,

    // Locks
    student_lock: DataTypes.BOOLEAN,
    hod_lock: DataTypes.BOOLEAN,
    supervisor_lock: DataTypes.BOOLEAN,
    dordc_lock: DataTypes.BOOLEAN,
    adordc_lock: DataTypes.BOOLEAN,
    dra_lock: DataTypes.BOOLEAN,
    external_lock: DataTypes.BOOLEAN,
    director_lock: DataTypes.BOOLEAN,
    phd_coordinator_lock: DataTypes.BOOLEAN,
    doctoral_lock: DataTypes.BOOLEAN,

    // Comments
    student_comments: DataTypes.TEXT,
    hod_comments: DataTypes.TEXT,
    supervisor_comments: DataTypes.TEXT,
    dordc_comments: DataTypes.TEXT,
    adordc_comments: DataTypes.TEXT,
    external_comments: DataTypes.TEXT,
    dra_comments: DataTypes.TEXT,
    director_comments: DataTypes.TEXT,
    doctoral_comments: DataTypes.TEXT,
    phd_coordinator_comments: DataTypes.TEXT,

    // Approvals
    supervisor_approval: DataTypes.STRING,
    phd_coordinator_approval: DataTypes.STRING,
    hod_approval: DataTypes.STRING,
    dordc_approval: DataTypes.STRING,
    adordc_approval: DataTypes.STRING,
    external_approval: DataTypes.STRING,
    doctoral_approval: DataTypes.STRING,
    dra_approval: DataTypes.STRING,
    director_approval: DataTypes.STRING,

    history: DataTypes.JSON,

    // Specific fields
    date: DataTypes.DATEONLY,
    time: DataTypes.TIME,
    venue: DataTypes.STRING,
    period_of_report: DataTypes.STRING,
    teaching_work: DataTypes.STRING,
    presentation_pdf: DataTypes.STRING,
    progress: DataTypes.INTEGER,
    total_progress: DataTypes.INTEGER,
    current_progress: DataTypes.INTEGER,
    contact_hours: DataTypes.INTEGER,
    attendance: DataTypes.FLOAT,
    overall_progress: DataTypes.STRING, // schema says string cast in PHP? 'overall_progress' => 'string'
    semester_id: DataTypes.INTEGER,
    leave: DataTypes.BOOLEAN,
    missed: DataTypes.BOOLEAN,
    ppt_file: DataTypes.STRING,

}, {
    sequelize,
    modelName: 'Presentation',
    tableName: 'presentations',
    underscored: true,
});

export default Presentation;

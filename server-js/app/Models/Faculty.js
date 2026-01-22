import { DataTypes, Op } from "sequelize";
import sequelize from "../../database/connection.js";
import { User } from "../../models/User.js";
import { Department } from "../../models/Department.js";
import { Student } from "../../models/Student.js";

const Faculty = sequelize.define(
    "Faculty",
    {
        faculty_code: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
        },
        designation: {
            type: DataTypes.STRING,
        },
        department_id: {
            type: DataTypes.INTEGER,
        },
        supervised_campus: {
            type: DataTypes.INTEGER,
        },
        supervied_outside: {
            type: DataTypes.INTEGER,
        },
        type: {
            type: DataTypes.STRING,
        },
        institution: {
            type: DataTypes.STRING,
        },
        website_link: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "faculty",
        timestamps: true,
        underscored: true,
    }
);

Faculty.belongsTo(User, { foreignKey: "user_id" });

Faculty.belongsTo(Department, { foreignKey: "department_id" });

Faculty.belongsToMany(Student, {
    through: "supervisors",
    foreignKey: "faculty_id",
    otherKey: "student_id",
    sourceKey: "faculty_code",
    targetKey: "roll_no",
    as: "supervisedStudents",
});

Faculty.belongsToMany(Student, {
    through: "doctoral_commitee",
    foreignKey: "faculty_id",
    otherKey: "student_id",
    sourceKey: "faculty_code",
    as: "doctoredStudents",
});

Faculty.hasMany(Department, {
    foreignKey: "adordc_id",
    sourceKey: "faculty_code",
    as: "adordcDepartments",
});

Faculty.prototype.students = async function () {
    const supervised = await this.getSupervisedStudents({ include: [User, Department] });
    const doctored = await this.getDoctoredStudents({ include: [User, Department] });

    let out = [];

    for (const d of doctored) {
        out.push({
            name: d.User ? d.User.name : null,
            roll_no: d.roll_no,
            type: "Doctoral Committee",
            department: d.Department ? d.Department.name : null,
            current_status: d.current_status,
            phd_title: d.phd_title,
        });
    }

    for (const s of supervised) {
        out.push({
            name: s.User ? s.User.name : null,
            roll_no: s.roll_no,
            type: "Supervisor",
            department: s.Department ? s.Department.name : null,
            current_status: s.current_status,
            phd_title: s.phd_title,
        });
    }

    return out;
};

Faculty.findByUserId = function (userId) {
    return Faculty.findOne({ where: { user_id: userId } });
};

Faculty.prototype.forms = async function () {
    return [];
};

export { Faculty };

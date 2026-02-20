import { DataTypes, Op } from "sequelize";
import sequelize from "../../database/connection.js";
import User from "./User.js";
import { Department } from "./Department.js";
import Student from "./Student.js";

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
        supervised_outside: {
            type: DataTypes.INTEGER,
        },
        // type: {
        //     type: DataTypes.STRING,
        // },
        // institution: {
        //     type: DataTypes.STRING,
        // },
        // website_link: {
        //     type: DataTypes.STRING,
        // },
    },
    {
        tableName: "faculty",
        timestamps: true,
        underscored: true,
    }
);

// Relations are defined in server-js/models/relations.js

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

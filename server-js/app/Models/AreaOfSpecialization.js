import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import bcrypt from "bcrypt";
import { User } from "../../models/User.js";
import { Faculty } from "../../models/Faculty.js";
import { Department } from "../../models/Department.js";
import { Student } from "../../models/Student.js";

const AreaOfSpecialization = sequelize.define(
    "area_of_specialization",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        department_id: {
            type: DataTypes.INTEGER,
        },
        name: {
            type: DataTypes.STRING,
        },
        expert_name: {
            type: DataTypes.STRING,
        },
        expert_email: {
            type: DataTypes.STRING,
        },
        expert_phone: {
            type: DataTypes.STRING,
        },
        expert_college: {
            type: DataTypes.STRING,
        },
        expert_website: {
            type: DataTypes.STRING,
        },
        expert_designation: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "area_of_specializations",
        timestamps: true,
        underscored: true,
    }
);

AreaOfSpecialization.belongsTo(Department, { foreignKey: "department_id" });
AreaOfSpecialization.hasMany(Student, { foreignKey: "area_of_specialization_id" });

AreaOfSpecialization.prototype.getExpertFaculty = async function () {
    let user = await User.findOne({ where: { email: this.expert_email } });

    let existingFaculty = null;
    if (user) {
        existingFaculty = await Faculty.findOne({ where: { user_id: user.id } });
        if (existingFaculty) {
            return existingFaculty;
        }
    }

    if (!user) {
        const hashedPassword = await bcrypt.hash("Password@123", 10);
        user = await User.create({
            first_name: this.expert_name,
            last_name: "",
            email: this.expert_email,
            phone: this.expert_phone,
            password: hashedPassword,
            role_id: 4,
            current_role_id: 4,
            default_role_id: 4,
            status: "active",
        });
    }

    const facultyCode = "777" + user.id.toString().padStart(6, "0");

    const faculty = await Faculty.create({
        user_id: user.id,
        faculty_code: facultyCode,
        designation: this.expert_designation,
        department_id: this.department_id,
        institution: this.expert_college,
        type: "external",
        website_link: this.expert_website,
    });

    return faculty;
};

export { AreaOfSpecialization };

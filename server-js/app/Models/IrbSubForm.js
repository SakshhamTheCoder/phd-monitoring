import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { IrbDoctoralApproval } from "./IrbDoctoralApproval.js";
import { Student } from "../../models/Student.js";
import { User } from "../../models/User.js";

const IrbSubForm = sequelize.define(
    "IrbSubForm",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        form_type: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.STRING,
        },
        stage: {
            type: DataTypes.STRING,
        },
        steps: {
            type: DataTypes.JSON,
        },
        history: {
            type: DataTypes.JSON,
        },
        revised_phd_title: {
            type: DataTypes.STRING,
        },
        revised_irb_pdf: {
            type: DataTypes.STRING,
        },
        student_id: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "irb_sub_forms",
        timestamps: true,
        underscored: true,
    }
);

IrbSubForm.belongsTo(Student, {
    foreignKey: "student_id",
    targetKey: "roll_no",
    as: "student",
});

IrbSubForm.hasMany(IrbDoctoralApproval, {
    foreignKey: "irb_sub_form_id",
    as: "doctoralApprovals",
});

IrbSubForm.prototype.fullForm = async function (user) {
    let formData = this.toJSON();

    let student = this.student;
    if (!student) {
        student = await this.getStudent({
            include: ["supervisors"],
        });
    }

    if (student) {
        formData.date_of_irb = student.date_of_irb;
    }

    return formData;
};

IrbSubForm.prototype.handleApproval = async function (email, id, val) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw new Error("User not found");
    }
    return true;
};

export { IrbSubForm };

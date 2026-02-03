import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { ExaminersRecommendation } from "./ExaminersRecommendation.js";
import { Student } from "../../models/Student.js";

const ListOfExaminersForm = sequelize.define(
    "ListOfExaminersForm",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        status: {
            type: DataTypes.STRING,
        },
        student_id: {
            type: DataTypes.STRING,
        },
        steps: {
            type: DataTypes.JSON,
        },
        history: {
            type: DataTypes.JSON,
        },
    },
    {
        tableName: "list_of_examiners_forms",
        timestamps: true,
        underscored: true,
    }
);

ListOfExaminersForm.belongsTo(Student, {
    foreignKey: "student_id",
    targetKey: "roll_no",
    as: "student",
});

ListOfExaminersForm.hasMany(ExaminersRecommendation, {
    foreignKey: "form_id",
    as: "examinersRecommendations",
});

ListOfExaminersForm.prototype.getNationalExaminersRecommendations = async function () {
    return this.getExaminersRecommendations({ where: { type: "national" } });
};

ListOfExaminersForm.prototype.getInternationalExaminersRecommendations = async function () {
    return this.getExaminersRecommendations({ where: { type: "international" } });
};

ListOfExaminersForm.prototype.fullForm = async function (user) {
    let formData = this.toJSON();

    let student = this.student;
    if (!student) {
        student = await this.getStudent();
    }

    const national = await this.getNationalExaminersRecommendations();
    const international = await this.getInternationalExaminersRecommendations();

    formData.national = national;
    formData.international = international;

    return formData;
};

export { ListOfExaminersForm };

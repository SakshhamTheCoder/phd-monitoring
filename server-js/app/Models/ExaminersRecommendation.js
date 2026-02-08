import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "./Faculty.js";
// import { ListOfExaminersForm } from "./ListOfExaminersForm.js"; // To be created

const ExaminersRecommendation = sequelize.define(
    "ExaminersRecommendation",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        form_id: {
            type: DataTypes.INTEGER,
        },
        name: {
            type: DataTypes.STRING,
        },
        email: {
            type: DataTypes.STRING,
        },
        institution: {
            type: DataTypes.STRING,
        },
        designation: {
            type: DataTypes.STRING,
        },
        department: {
            type: DataTypes.STRING,
        },
        phone: {
            type: DataTypes.STRING,
        },
        type: {
            type: DataTypes.STRING,
        },
        comment: {
            type: DataTypes.STRING,
        },
        faculty_id: {
            type: DataTypes.STRING, // Maps to faculty_code
        },
        recommendation: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "examiners_recommendation", // Singular as in PHP model
        timestamps: true,
        underscored: true,
    }
);

// Faculty relation
// belongsTo(Faculty::class, 'faculty_id', 'faculty_code')
ExaminersRecommendation.belongsTo(Faculty, {
    foreignKey: "faculty_id",
    targetKey: "faculty_code",
    as: "faculty",
});

// ListOfExaminersForm relation
// belongsTo(ListOfExaminersForm::class, 'form_id', 'id')
// ExaminersRecommendation.belongsTo(ListOfExaminersForm, { foreignKey: 'form_id', as: 'listOfExaminers' });

export { ExaminersRecommendation };

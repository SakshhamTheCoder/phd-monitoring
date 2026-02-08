import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "./Faculty.js";
// import { ListOfExaminersRecommendation } from "./ListOfExaminersRecommendation.js"; // To be created

const ExaminersDetail = sequelize.define(
    "ExaminersDetail",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING,
        },
        designation: {
            type: DataTypes.STRING,
        },
        department: {
            type: DataTypes.STRING,
        },
        email: {
            type: DataTypes.STRING,
        },
        phone: {
            type: DataTypes.STRING,
        },
        university: {
            type: DataTypes.STRING,
        },
        country: {
            type: DataTypes.STRING,
        },
        city: {
            type: DataTypes.STRING,
        },
        added_by: {
            type: DataTypes.STRING, // Maps to faculty_code
        },
    },
    {
        tableName: "examiners_details",
        timestamps: true,
        underscored: true,
    }
);

// AddedBy relation (Faculty)
// belongsTo(Faculty::class, 'added_by', 'faculty_code')
ExaminersDetail.belongsTo(Faculty, {
    foreignKey: "added_by",
    targetKey: "faculty_code",
    as: "addedBy",
});

// Recommendations relation
// hasMany(ListOfExaminersRecommendation::class, 'examiner_id')
// ExaminersDetail.hasMany(ListOfExaminersRecommendation, { foreignKey: 'examiner_id', as: 'recommendations' });

export { ExaminersDetail };

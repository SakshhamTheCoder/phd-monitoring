import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "../../models/Faculty.js";

const IrbExpertDepartment = sequelize.define(
    "IrbExpertDepartment",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        irb_form_id: {
            type: DataTypes.INTEGER,
        },
        expert_id: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "irb_expert_departments",
        timestamps: true,
        underscored: true,
    }
);

IrbExpertDepartment.belongsTo(Faculty, {
    foreignKey: "expert_id",
    targetKey: "faculty_code",
    as: "expert",
});

export { IrbExpertDepartment };

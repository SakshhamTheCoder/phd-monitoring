import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "../../models/Faculty.js";

const IrbDoctoralApproval = sequelize.define(
    "IrbDoctoralApproval",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        irb_sub_form_id: {
            type: DataTypes.INTEGER,
        },
        doctoral_id: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "irb_doctoral_approvals",
        timestamps: true,
        underscored: true,
    }
);

// Relation to Faculty (Doctoral)
IrbDoctoralApproval.belongsTo(Faculty, {
    foreignKey: "doctoral_id",
    targetKey: "faculty_code",
    as: "doctoral",
});

export { IrbDoctoralApproval };

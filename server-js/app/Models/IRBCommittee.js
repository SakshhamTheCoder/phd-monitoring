import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import Student from "./Student.js";
import { Faculty } from "./Faculty.js";

const IRBCommittee = sequelize.define(
    "IRBCommittee",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        student_id: {
            type: DataTypes.STRING,
        },
        type: {
            type: DataTypes.STRING,
        },
        member_id: {
            type: DataTypes.STRING,
        },
        member_type: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "irb_committees",
        timestamps: true,
        underscored: true,
    }
);

// Student relation
IRBCommittee.belongsTo(Student, {
    foreignKey: "student_id",
    targetKey: "roll_no",
    as: "student",
});

// Polymorphic member (Faculty / OutsideExpert)
IRBCommittee.belongsTo(Faculty, {
    foreignKey: "member_id",
    targetKey: "faculty_code",
    constraints: false,
    as: "facultyMember",
});

IRBCommittee.prototype.member = async function () {
    if (this.member_type === "App\\Models\\Faculty") {
        return Faculty.findOne({ where: { faculty_code: this.member_id } });
    }
    return null;
};

IRBCommittee.prototype.isInside = function () {
    return this.type === "inside" && this.member_type === "App\\Models\\Faculty";
};

IRBCommittee.prototype.isOutside = function () {
    return this.type === "outside" && this.member_type === "App\\Models\\OutsideExpert";
};

export { IRBCommittee };

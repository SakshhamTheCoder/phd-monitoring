import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Student } from "../../models/Student.js";
import { Faculty } from "../../models/Faculty.js";
import { ConstituteIrbSupervisorApproval } from "./ConstituteIrbSupervisorApproval.js";
import { AreaOfSpecialization } from "./AreaOfSpecialization.js";
import { BroadAreaSpecialization } from "./BroadAreaSpecialization.js";
import { OutsideExpert } from "./OutsideExpert.js";
import { IrbNomineeCognate } from "./IrbNomineeCognate.js";
import { IrbOutsideExpert } from "./IrbOutsideExpert.js";
import { IrbExpertDepartment } from "./IrbExpertDepartment.js";
import { IrbExpertChairman } from "./IrbExpertChairman.js";

const ConstituteOfIRB = sequelize.define(
    "ConstituteOfIRB",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        student_id: {
            type: DataTypes.INTEGER,
        },
        cognate_expert: {
            type: DataTypes.STRING,
        },
        outside_expert: {
            type: DataTypes.INTEGER,
        },
        phd_title: {
            type: DataTypes.STRING,
        },
        irb_pdf: {
            type: DataTypes.STRING,
        },
        broad_area_of_research: {
            type: DataTypes.INTEGER,
        },
        steps: {
            type: DataTypes.JSON,
        },
        history: {
            type: DataTypes.JSON,
        },
        status: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "constitute_of_irb",
        timestamps: true,
        underscored: true,
    }
);

ConstituteOfIRB.belongsTo(Student, { foreignKey: "student_id" });

ConstituteOfIRB.belongsTo(Faculty, {
    foreignKey: "cognate_expert",
    targetKey: "faculty_code",
    as: "expertCognate",
});

ConstituteOfIRB.belongsTo(OutsideExpert, {
    foreignKey: "outside_expert",
    as: "expertOutside",
});

ConstituteOfIRB.hasMany(ConstituteIrbSupervisorApproval, {
    foreignKey: "irb_cons_form_id",
    as: "supervisorApprovals",
});

ConstituteOfIRB.hasMany(IrbNomineeCognate, {
    foreignKey: "irb_form_id",
    as: "nomineeCognates",
});

ConstituteOfIRB.hasMany(IrbOutsideExpert, {
    foreignKey: "irb_form_id",
    as: "outsideExperts",
});

ConstituteOfIRB.hasMany(IrbExpertDepartment, {
    foreignKey: "irb_form_id",
    as: "expertDepartments",
});

ConstituteOfIRB.hasMany(IrbExpertChairman, {
    foreignKey: "irb_form_id",
    as: "chairmanExperts",
});

ConstituteOfIRB.prototype.fullForm = async function (user) {
    let student = this.student;
    if (!student) {
        student = await this.getStudent();
    }

    let commonJSON = {};

    let broadAreaName = null;
    if (this.broad_area_of_research) {
        const area = await AreaOfSpecialization.findByPk(this.broad_area_of_research);
        if (area) broadAreaName = area.name;
    }

    const result = {
        ...commonJSON,
        phd_title: this.phd_title,
        address: student ? student.address : null,
        irb_pdf: this.irb_pdf,
        broad_area_of_research: broadAreaName,
    };

    return result;
};

export { ConstituteOfIRB };

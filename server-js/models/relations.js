import { User } from "./User.js";
import { Student } from "./Student.js";
import { Faculty } from "./Faculty.js";
import { Department } from "./Department.js";

// User ↔ Student / Faculty
User.hasOne(Student, { foreignKey: "user_id" });
Student.belongsTo(User, { foreignKey: "user_id" });

User.hasOne(Faculty, { foreignKey: "user_id" });
Faculty.belongsTo(User, { foreignKey: "user_id" });

// Department
Student.belongsTo(Department, { foreignKey: "department_id" });
Faculty.belongsTo(Department, { foreignKey: "department_id" });

// NOTE: For now we skip supervisors & doctoral committees.
// We’ll add them in next step once basic /home works.

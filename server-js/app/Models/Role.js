import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

class Role extends Model {

    setAllTrue() {
        const attributes = Object.keys(Role.rawAttributes);
        const exclude = ['id', 'role', 'created_at', 'updated_at'];

        attributes.forEach(attr => {
            if (!exclude.includes(attr)) {
                this[attr] = true;
            }
        });
    }

    // Hooks handled in init or standard sequelize hooks
}

Role.init({
    role: {
        type: DataTypes.STRING,
        set(value) {
            this.setDataValue('role', value.toLowerCase());
        }
    },
    can_read_all_students: DataTypes.BOOLEAN,
    can_read_all_faculties: DataTypes.BOOLEAN,
    can_read_supervised_students: DataTypes.BOOLEAN,
    can_read_department_students: DataTypes.BOOLEAN,
    can_read_department_faculties: DataTypes.BOOLEAN,
    can_edit_all_students: DataTypes.BOOLEAN,
    can_edit_all_faculties: DataTypes.BOOLEAN,
    can_edit_department_students: DataTypes.BOOLEAN,
    can_edit_department_faculties: DataTypes.BOOLEAN,
    can_edit_own_profile: DataTypes.BOOLEAN,
    can_edit_phd_title: DataTypes.BOOLEAN,
    can_add_department_students: DataTypes.BOOLEAN,
    can_add_department_faculties: DataTypes.BOOLEAN,
    can_add_faculties: DataTypes.BOOLEAN,
    can_add_students: DataTypes.BOOLEAN,
    can_read_supervisors: DataTypes.BOOLEAN,
    can_read_doctoral_committee: DataTypes.BOOLEAN,
    can_edit_supervisors: DataTypes.BOOLEAN,
    can_edit_doctoral_committee: DataTypes.BOOLEAN,
    can_delete_department_students: DataTypes.BOOLEAN,
    can_delete_department_faculties: DataTypes.BOOLEAN,
    can_delete_faculties: DataTypes.BOOLEAN,
    can_delete_students: DataTypes.BOOLEAN,
    can_manage_roles: DataTypes.BOOLEAN,
    can_edit_department: DataTypes.BOOLEAN,
    can_add_department: DataTypes.BOOLEAN,
    can_read_external: DataTypes.BOOLEAN,
    can_edit_external: DataTypes.BOOLEAN,
}, {
    sequelize,
    modelName: 'Role',
    tableName: 'roles',
    underscored: true,
    hooks: {
        beforeSave: (role, options) => {
            if (role.role) {
                role.role = role.role.toLowerCase();
            }
        }
    }
});

export default Role;

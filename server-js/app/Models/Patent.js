import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class Patent extends Model {
    /**
     * The attributes that should be hidden for arrays.
     */
    toJSON() {
        const values = Object.assign({}, this.get());
        delete values['created_at'];
        delete values['updated_at'];
        return values;
    }

    static associate(models) {
        Patent.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
    }
}

Patent.init({
    student_id: DataTypes.STRING,
    form_id: DataTypes.INTEGER,
    form_type: DataTypes.STRING,
    title: DataTypes.STRING,
    patent_number: DataTypes.STRING,
    first_page: DataTypes.STRING, // PHP didn't cast, assumig string or int. Keeping string for safety.
    year: DataTypes.STRING,
    doi_link: DataTypes.STRING,
    status: DataTypes.STRING,
    country: DataTypes.STRING,
}, {
    sequelize,
    modelName: 'Patent',
    tableName: 'patents',
    underscored: true,
});

export default Patent;

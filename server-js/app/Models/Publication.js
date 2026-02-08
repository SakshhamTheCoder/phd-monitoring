import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class Publication extends Model {
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
        Publication.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
    }
}

Publication.init({
    student_id: DataTypes.STRING,
    form_id: DataTypes.INTEGER,
    form_type: DataTypes.STRING,
    title: DataTypes.STRING,
    authors: DataTypes.STRING,
    doi_link: DataTypes.STRING,
    first_page: DataTypes.STRING,
    year: DataTypes.STRING,
    name: DataTypes.STRING,
    status: DataTypes.STRING,
    country: DataTypes.STRING,
    state: DataTypes.STRING,
    city: DataTypes.STRING,
    publisher: DataTypes.STRING,
    volume: DataTypes.STRING,
    page_no: DataTypes.STRING,
    issn: DataTypes.STRING,
    publication_type: DataTypes.STRING,
    type: DataTypes.STRING,
    impact_factor: DataTypes.FLOAT,
}, {
    sequelize,
    modelName: 'Publication',
    tableName: 'publications',
    underscored: true,
});

export default Publication;

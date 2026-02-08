import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class PresentationReview extends Model {
    static associate(models) {
        PresentationReview.belongsTo(models.Presentation, { foreignKey: 'presentation_id', as: 'presentation' });
        PresentationReview.belongsTo(models.Faculty, { foreignKey: 'faculty_id', targetKey: 'faculty_code', as: 'faculty' });
    }
}

PresentationReview.init({
    presentation_id: DataTypes.INTEGER,
    faculty_id: DataTypes.STRING,
    progress: DataTypes.STRING,
    is_supervisor: DataTypes.BOOLEAN, // 0/1 in PHP
    comments: DataTypes.TEXT,
    review_status: DataTypes.STRING,
}, {
    sequelize,
    modelName: 'PresentationReview',
    tableName: 'presentation_reviews',
    underscored: true,
});

export default PresentationReview;

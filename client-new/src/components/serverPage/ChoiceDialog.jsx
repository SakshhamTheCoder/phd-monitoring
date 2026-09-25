import React from 'react';
import CustomButton from '../forms/fields/CustomButton';
import './ChoiceDialog.css';

/**
 * A dialog that asks which kind of thing to make before any record is written
 * (a page view's dialog of kind 'choice'), one option per kind. Picking one
 * hands the dialog over, in place, to the dialog that option opens.
 */
const ChoiceDialog = ({ dialog, onChoose, onCancel }) => (
  <div className="kind-picker">
    <h3 className="kind-picker-title">{dialog.heading}</h3>
    <p className="kind-picker-intro">{dialog.intro}</p>

    <div className="kind-picker-options">
      {dialog.options.map((option) => (
        <button
          key={option.opens}
          type="button"
          onClick={() => onChoose(option.opens)}
          className="kind-picker-option"
        >
          <i className={`fa ${option.icon} kind-picker-icon`} aria-hidden="true" />
          <span>
            <span className="kind-picker-option-title">{option.title}</span>
            <span className="kind-picker-option-text">{option.description}</span>
          </span>
        </button>
      ))}
    </div>

    <div className="modal-actions">
      <CustomButton text="Cancel" variant="quiet" onClick={onCancel} />
    </div>
  </div>
);

export default ChoiceDialog;

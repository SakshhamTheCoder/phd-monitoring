import "./Fields.css";
const CustomButton = ({ text, onClick, disabled = false, label, variant, style, type }) => {
    return (
        <>
         {label && (<label className="input-label">{label}</label>)}
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            style={style}
            className={`custom-button${variant ? ` custom-button--${variant}` : ""}`}
        >
            {text}
        </button>
        </>
    );
};
export default CustomButton;

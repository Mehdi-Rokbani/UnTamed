import { useNavigate } from "react-router-dom";
import styles from "../style/backButton.module.css";

export function BackButton() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/landing"); // Go back to previous page
  };

  return (
    <button className={styles.backButton} onClick={handleBack}>
      <svg 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5"
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      <span>Back</span>
    </button>
  );
}
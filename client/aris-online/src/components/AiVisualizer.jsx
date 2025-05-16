import React, { useRef, useEffect } from 'react';
import styles from './Visualizer.module.css';

// Define the possible statuses
export const STATUS = {
  IDLE: 'idle',
  LISTENING: 'listening',
  SPEAKING: 'speaking',
};

const AiVisualizer = ({ status = STATUS.IDLE }) => {
  // Determine the CSS class based on the status prop
  const getStatusClass = () => {
    switch (status) {
      case STATUS.LISTENING:
        return styles.listening;
      case STATUS.SPEAKING:
        return styles.speaking;
      case STATUS.IDLE:
      default:
        return styles.idle;
    }
  };

  return (
    <div className={styles.orbContainer}>
      <div className={`${styles.orb} ${getStatusClass()}`}>
        <div className={styles.orbCore}></div>
      </div>
    </div>
  );
};

export default AiVisualizer;
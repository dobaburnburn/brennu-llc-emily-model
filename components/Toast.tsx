/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        // The fade-out animation handles the visual disappearance
        // Then, after the animation, we call onClose to reset the state
        const closeTimer = setTimeout(onClose, 500); // Corresponds to animation duration
        return () => clearTimeout(closeTimer);
      }, 3000); // Message visible for 3 seconds

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [message, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <div className="toast-container">
      <div className="toast">
        <span className="icon">workspace_premium</span>
        {message}
      </div>
    </div>
  );
};

export default Toast;

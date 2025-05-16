// src/components/Message.jsx
import React from 'react';
import PropTypes from 'prop-types';
// We assume the necessary CSS (.message, .user-message, .ARIS-message)
// is loaded globally or by the parent component (ChatBox.css) for now.

/**
 * Renders a single chat message bubble.
 * @param {object} props - Component props.
 * @param {object} props.message - The message object { sender: 'user' | 'ARIS', text: '...' }
 */
function Message({ message }) {
    const { sender, text } = message;

    // Determine the CSS class based on the sender
    const messageClass = sender === 'user' ? 'user-message' : 'ARIS-message';

    return (
        <div className={`message ${messageClass}`}>
            {/* Render text preserving whitespace and line breaks */}
            <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
        </div>
    );
}

// Define prop types for the component
Message.propTypes = {
    message: PropTypes.shape({
        sender: PropTypes.oneOf(['user', 'ARIS']).isRequired,
        text: PropTypes.string.isRequired,
    }).isRequired,
};

export default Message;
import React, { useRef, useEffect, useState } from 'react';
import './WebcamFeed.css';

const WebcamFeed = ({ isVisible, onClose, socket }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;
    let intervalId = null;

    const startWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setError(null);

          // Capture frame every 2 seconds
          intervalId = setInterval(captureFrame, 2000);
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
        setError('Could not access webcam. Please check permissions.');
      }
    };

    const captureFrame = () => {
      if (!canvasRef.current || !videoRef.current || !socket.current?.connected) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const frameData = canvas.toDataURL('image/jpeg', 0.7);
        socket.current.emit('send_video_frame', { frame_data: frameData });
      } catch (e) {
        console.error('Error capturing frame:', e);
      }
    };

    if (isVisible) {
      startWebcam();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isVisible, socket]);

  if (!isVisible) return null;

  return (
    <div className="webcam-feed">
      <div className="webcam-header">
        <h3>Webcam Feed</h3>
        <button onClick={onClose} className="close-button">
          &times;
        </button>
      </div>
      {error ? (
        <div className="webcam-error">{error}</div>
      ) : (
        <>
          <video ref={videoRef} className="webcam-video" autoPlay playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </>
      )}
    </div>
  );
};

export default WebcamFeed;
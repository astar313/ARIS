import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import ChatBox from "./components/ChatBox";
import InputArea from "./components/InputArea";
import StatusDisplay from "./components/StatusDisplay";
import AiVisualizer, { STATUS as VISUALIZER_STATUS } from "./components/AiVisualizer";
import WebcamFeed from "./components/WebcamFeed";
import WeatherWidget from "./components/WeatherWidget";
import MapWidget from "./components/MapWidget";
import CodeExecutionWidget from "./components/CodeExecutionWidget";
import SearchResultsWidget from "./components/SearchResultsWidget";
import "./App.css";
import "./components/ChatBox.css";
import "./components/InputArea.css";
import "./components/StatusDisplay.css";
import "./components/WebcamFeed.css";
import "./components/MapWidget.css";
import "./components/CodeExecutionWidget.css";
import "./components/SearchResultsWidget.css";

// Get the server URL from environment variables
const SERVER_URL = import.meta.env.VITE_SERVER_URL;

function App() {
  // State variables
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [statusText, setStatusText] = useState("Initializing...");
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [mapInfo, setMapInfo] = useState(null);
  const [visualizerStatus, setVisualizerStatus] = useState(VISUALIZER_STATUS.IDLE);
  const [showWebcam, setShowWebcam] = useState(false);
  const [executableCode, setExecutableCode] = useState(null);
  const [codeLanguage, setCodeLanguage] = useState(null);
  const [searchInfo, setSearchInfo] = useState(null);

  // Refs
  const socket = useRef(null);
  const audioContext = useRef(null);
  const audioQueue = useRef([]);
  const isPlaying = useRef(false);
  const userRequestedStop = useRef(false);
  const restartTimer = useRef(null);
  const ARISMessageIndex = useRef(-1);
  const isMutedRef = useRef(isMuted);
  const isListeningRef = useRef(isListening);
  const isConnectedRef = useRef(isConnected);

  // Initialize AudioContext
  useEffect(() => {
    const initAudioContext = () => {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      }
    };

    const handleInteraction = () => {
      initAudioContext();
      if (audioContext.current?.state === 'suspended') {
        audioContext.current.resume();
      }
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  // Initialize socket connection
  useEffect(() => {
    socket.current = io(SERVER_URL, {
      reconnectionAttempts: 5,
      transports: ["websocket"],
      path: "/socket.io",
      withCredentials: true
    });

    socket.current.on("connect", () => {
      setIsConnected(true);
      isConnectedRef.current = true;
      setStatusText(isMuted ? "Connected. Mic is Muted." : "Connected. Ready.");
    });

    socket.current.on("disconnect", () => {
      setIsConnected(false);
      isConnectedRef.current = false;
      setStatusText("Disconnected.");
      setIsListening(false);
      setVisualizerStatus(VISUALIZER_STATUS.IDLE);
    });

    socket.current.on("receive_text_chunk", (data) => {
      setMessages(prev => [...prev, { sender: "ARIS", text: data.text }]);
    });

    socket.current.on("receive_audio_chunk", async (data) => {
      if (!audioContext.current) return;

      const audioData = base64ToFloat32Array(data.audio);
      const audioBuffer = audioContext.current.createBuffer(1, audioData.length, 24000);
      audioBuffer.getChannelData(0).set(audioData);

      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
      source.start();
      setVisualizerStatus(VISUALIZER_STATUS.SPEAKING);

      source.onended = () => {
        setVisualizerStatus(VISUALIZER_STATUS.IDLE);
      };
    });

    socket.current.on("weather_update", (data) => {
      setWeatherInfo(data);
    });

    socket.current.on("map_update", (data) => {
      setMapInfo(data);
    });

    socket.current.on("search_results_update", (data) => {
      setSearchInfo(data);
    });

    socket.current.on("code_execution", (data) => {
      setExecutableCode(data.code);
      setCodeLanguage(data.language);
    });

    // Check microphone support
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setMicSupported(true);
    }

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [isMuted]);

  // Current time display
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(getCurrentTime()), 1000);
    return () => clearInterval(timerId);
  }, []);

  function getCurrentTime() {
    return new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: true,
    });
  }

  function base64ToFloat32Array(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    return float32Array;
  }

  const handleSendText = (text) => {
    if (!text) return;

    setMessages(prev => [...prev, { sender: "user", text }]);
    
    if (socket.current?.connected) {
      socket.current.emit("send_text_message", { message: text });
      setVisualizerStatus(VISUALIZER_STATUS.PROCESSING);
    }
  };

  const handleToggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    isMutedRef.current = newMutedState;
    setStatusText(newMutedState ? "Connected. Mic is Muted." : "Connected. Ready.");
  };

  const handleToggleWebcam = () => {
    setShowWebcam(prev => !prev);
  };

  const handleCloseCodeWidget = () => {
    setExecutableCode(null);
    setCodeLanguage(null);
  };

  const handleCloseSearchResultsWidget = () => {
    setSearchInfo(null);
  };

  return (
    <div className="app-container">
      <h1>A.D.A</h1>
      <AiVisualizer status={visualizerStatus} />
      <StatusDisplay status={statusText} />
      <ChatBox messages={messages} />
      <InputArea
        onSendText={handleSendText}
        isMuted={isMuted}
        isListening={isListening}
        onToggleMute={handleToggleMute}
        micSupported={micSupported}
        isWebcamVisible={showWebcam}
        onToggleWebcam={handleToggleWebcam}
      />

      <WebcamFeed
        isVisible={showWebcam}
        onClose={handleToggleWebcam}
        socket={socket}
      />

      <WeatherWidget weatherData={weatherInfo} />
      <MapWidget mapData={mapInfo} />

      {executableCode && (
        <CodeExecutionWidget
          code={executableCode}
          language={codeLanguage}
          onClose={handleCloseCodeWidget}
        />
      )}

      {searchInfo && (
        <SearchResultsWidget
          searchData={searchInfo}
          onClose={handleCloseSearchResultsWidget}
        />
      )}

      <footer>
        <p>Location: Smyrna, Georgia</p>
        <p>Current Time: {currentTime}</p>
      </footer>
    </div>
  );
}

export default App;
import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { Vapi } from "@vapi-ai/web";
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

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

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
  const vapi = useRef(null);
  const audioContext = useRef(null);
  const audioQueue = useRef([]);
  const isPlaying = useRef(false);
  const userRequestedStop = useRef(false);
  const restartTimer = useRef(null);
  const ARISMessageIndex = useRef(-1);
  const isMutedRef = useRef(isMuted);
  const isListeningRef = useRef(isListening);
  const isConnectedRef = useRef(isConnected);

  // Initialize VAPI client
  useEffect(() => {
    const initializeVapi = async () => {
      try {
        vapi.current = new Vapi({
          apiKey: import.meta.env.VITE_VAPI_API_KEY,
          baseUrl: "https://api.vapi.ai",
        });

        // Set up event listeners
        vapi.current.on("call-start", () => {
          console.log("Call started");
          setVisualizerStatus(VISUALIZER_STATUS.LISTENING);
          setIsListening(true);
        });

        vapi.current.on("call-end", () => {
          console.log("Call ended");
          setVisualizerStatus(VISUALIZER_STATUS.IDLE);
          setIsListening(false);
        });

        vapi.current.on("speech-start", () => {
          console.log("Speech started");
          setVisualizerStatus(VISUALIZER_STATUS.SPEAKING);
        });

        vapi.current.on("speech-end", () => {
          console.log("Speech ended");
          setVisualizerStatus(VISUALIZER_STATUS.PROCESSING);
        });

        vapi.current.on("message", (message) => {
          console.log("Message received:", message);
          setMessages(prev => [...prev, { sender: "ARIS", text: message.content }]);
          if (socket.current?.connected) {
            socket.current.emit("send_text_message", { message: message.content });
          }
        });

        vapi.current.on("error", (error) => {
          console.error("VAPI Error:", error);
          setStatusText("Voice assistant error");
        });

        console.log("VAPI client initialized successfully");
      } catch (error) {
        console.error("Failed to initialize VAPI client:", error);
        setStatusText("Error initializing voice assistant");
      }
    };

    if (!vapi.current) {
      initializeVapi();
    }

    return () => {
      if (vapi.current) {
        vapi.current.disconnect();
      }
    };
  }, []);

  // Initialize socket connection
  useEffect(() => {
    socket.current = io(SERVER_URL, {
      reconnectionAttempts: 5,
      transports: ["websocket"],
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
    });

    socket.current.on("receive_text_chunk", (data) => {
      setMessages(prev => [...prev, { sender: "ARIS", text: data.text }]);
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

  const handleSendText = async (text) => {
    if (!text) return;

    setMessages(prev => [...prev, { sender: "user", text }]);
    
    if (socket.current?.connected) {
      socket.current.emit("send_text_message", { message: text });
    }

    try {
      if (vapi.current) {
        await vapi.current.start({
          assistantId: "asst_default",
          userMessage: text,
        });
      }
    } catch (error) {
      console.error("VAPI Error:", error);
      setStatusText("Voice assistant error");
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
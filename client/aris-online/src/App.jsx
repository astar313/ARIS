import React, { useState, useEffect, useRef, useCallback } from "react";
import io from "socket.io-client";
import { VapiClient } from "@vapi-ai/web";

// Import Components
import ChatBox from "./components/ChatBox";
import InputArea from "./components/InputArea";
import StatusDisplay from "./components/StatusDisplay";
import AiVisualizer, {
  STATUS as VISUALIZER_STATUS,
} from "./components/AiVisualizer";
import WebcamFeed from "./components/WebcamFeed";
import WeatherWidget from "./components/WeatherWidget";
import MapWidget from "./components/MapWidget";
import CodeExecutionWidget from "./components/CodeExecutionWidget";
import SearchResultsWidget from "./components/SearchResultsWidget";

// Import CSS
import "./App.css";
import "./components/ChatBox.css";
import "./components/InputArea.css";
import "./components/StatusDisplay.css";
import "./components/WebcamFeed.css";
import "./components/MapWidget.css";
import "./components/CodeExecutionWidget.css";
import "./components/SearchResultsWidget.css";

// Constants
const SERVER_URL = "http://localhost:5000";

function App() {
  console.log("--- App component rendered ---");

  // --- State Variables ---
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [statusText, setStatusText] = useState("Initializing...");
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [mapInfo, setMapInfo] = useState(null);
  const [visualizerStatus, setVisualizerStatus] = useState(
    VISUALIZER_STATUS.IDLE
  );
  const [showWebcam, setShowWebcam] = useState(false);
  const [executableCode, setExecutableCode] = useState(null);
  const [codeLanguage, setCodeLanguage] = useState(null);
  const [searchInfo, setSearchInfo] = useState(null);

  // --- Refs ---
  const socket = useRef(null);
  const vapiClient = useRef(null);
  const audioContext = useRef(null);
  const audioQueue = useRef([]);
  const isPlaying = useRef(false);
  const userRequestedStop = useRef(false);
  const restartTimer = useRef(null);
  const ARISMessageIndex = useRef(-1);
  const isMutedRef = useRef(isMuted);
  const isListeningRef = useRef(isListening);
  const startRecognitionRef = useRef();
  const isConnectedRef = useRef(isConnected);
  const playNextAudioChunkRef = useRef();

  // Initialize VAPI client
  useEffect(() => {
    if (!vapiClient.current) {
      vapiClient.current = new VapiClient({
        apiKey: import.meta.env.VITE_VAPI_API_KEY
      });
    }
  }, []);

  // --- Footer Time ---
  const getCurrentTime = () => {
    return new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: true,
    });
  };
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(getCurrentTime()), 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    socket.current = io(SERVER_URL, {
      reconnectionAttempts: 5,
      transports: ["websocket"],
    });

    socket.current.on("connect", () => {
      setIsConnected(true);
      setStatusText(isMuted ? "Connected. Mic is Muted." : "Connected. Ready.");
    });

    socket.current.on("disconnect", () => {
      setIsConnected(false);
      setStatusText("Disconnected.");
      setIsListening(false);
    });

    socket.current.on("receive_text_chunk", (data) => {
      setMessages((prev) => [...prev, { sender: "ARIS", text: data.text }]);
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

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [isMuted]);

  const handleSendText = async (text) => {
    if (!text || !socket.current?.connected) return;

    setMessages((prev) => [...prev, { sender: "user", text }]);
    socket.current.emit("send_text_message", { message: text });

    try {
      const conversation = await vapiClient.current.conversation.create({
        assistant_id: "asst_default",
      });

      await conversation.start({
        textInput: text,
        onResponse: (response) => {
          socket.current.emit("send_text_message", { message: response.text });
        },
      });
    } catch (error) {
      console.error("VAPI Error:", error);
    }
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
    isMutedRef.current = !isMutedRef.current;
  };

  const handleToggleWebcam = () => {
    setShowWebcam((prev) => !prev);
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
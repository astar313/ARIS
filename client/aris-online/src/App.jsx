import React, { useState, useEffect, useRef, useCallback } from "react";
import { VapiClient } from "@vapi-ai/web";
import io from "socket.io-client";
import { motion } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

// Import Components
import ChatBox from "./components/ChatBox";
import InputArea from "./components/InputArea";
import StatusDisplay from "./components/StatusDisplay";
import AiVisualizer from "./components/AiVisualizer";
import WebcamFeed from "./components/WebcamFeed";
import WeatherWidget from "./components/WeatherWidget";
import MapWidget from "./components/MapWidget";
import SearchResultsWidget from "./components/SearchResultsWidget";

// Import CSS
import "./App.css";

const SERVER_URL = "http://localhost:5000";

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [statusText, setStatusText] = useState("Initializing...");
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [mapInfo, setMapInfo] = useState(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const [searchInfo, setSearchInfo] = useState(null);

  // VAPI Client setup
  const vapiClient = useRef(null);
  const vapiAssistantId = "asst_default";

  useEffect(() => {
    vapiClient.current = new VapiClient({
      apiKey: "YOUR_VAPI_API_KEY",
    });
  }, []);

  // Socket.IO setup
  const socket = useRef(null);

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

    // Start VAPI conversation
    try {
      const conversation = await vapiClient.current.conversation.create({
        assistant_id: vapiAssistantId,
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
  };

  const handleToggleWebcam = () => {
    setShowWebcam((prev) => !prev);
  };

  return (
    <div className="app-container">
      <Canvas className="background-canvas">
        <OrbitControls enableZoom={false} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <AiVisualizer />
      </Canvas>

      <motion.div
        className="content-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h1>ARIS</h1>
        <StatusDisplay status={statusText} />
        <ChatBox messages={messages} />
        <InputArea
          onSendText={handleSendText}
          isMuted={isMuted}
          isListening={isListening}
          onToggleMute={handleToggleMute}
          micSupported={true}
          isWebcamVisible={showWebcam}
          onToggleWebcam={handleToggleWebcam}
        />

        {showWebcam && (
          <WebcamFeed
            isVisible={showWebcam}
            onClose={handleToggleWebcam}
            socket={socket}
          />
        )}

        <WeatherWidget weatherData={weatherInfo} />
        <MapWidget mapData={mapInfo} />
        {searchInfo && (
          <SearchResultsWidget
            searchData={searchInfo}
            onClose={() => setSearchInfo(null)}
          />
        )}
      </motion.div>
    </div>
  );
}

export default App;
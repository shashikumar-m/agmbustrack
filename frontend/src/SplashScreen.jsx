import { useEffect, useState } from "react";
import splashImg from "./assets/splash.png";
import logoImg   from "./assets/logo.png";

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState("show"); // show → fadeout → done

  useEffect(() => {
    // After 3.2s start fade, after 4s call onDone
    const fadeTimer = setTimeout(() => setPhase("fadeout"), 3200);
    const doneTimer = setTimeout(() => onDone(), 4000);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, []);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "#1565c0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      opacity: phase === "fadeout" ? 0 : 1,
      transition: "opacity 0.8s ease",
      overflow: "hidden",
    }}>

      {/* College splash image fills the screen */}
      <img
        src={splashImg}
        alt="College"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
        }}
      />

      {/* Dark overlay for readability */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to bottom, rgba(21,101,192,0.55) 0%, rgba(13,71,161,0.8) 100%)",
      }} />

      {/* Content on top */}
      <div style={{
        position: "relative",
        zIndex: 2,
        textAlign: "center",
        padding: "0 24px",
      }}>
        {/* College logo */}
        <div style={{
          width: "110px",
          height: "110px",
          borderRadius: "50%",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          overflow: "hidden",
          padding: "10px",
        }}>
          <img
            src={logoImg}
            alt="College Logo"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>

        {/* App name */}
        <h1 style={{
          color: "#fff",
          fontSize: "26px",
          fontWeight: "800",
          margin: "0 0 8px",
          letterSpacing: "-0.5px",
          fontFamily: "sans-serif",
          textShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}>
          Where Is My Bus
        </h1>

        <p style={{
          color: "rgba(255,255,255,0.85)",
          fontSize: "14px",
          margin: "0 0 40px",
          fontFamily: "sans-serif",
        }}>
          Real-time College Bus Tracking
        </p>

        {/* Loading bar */}
        <div style={{
          width: "160px",
          height: "3px",
          background: "rgba(255,255,255,0.3)",
          borderRadius: "2px",
          margin: "0 auto",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            background: "#fff",
            borderRadius: "2px",
            animation: "loadbar 3.2s linear forwards",
          }} />
        </div>
      </div>

      {/* Bottom college name */}
      <div style={{
        position: "absolute",
        bottom: "40px",
        left: 0, right: 0,
        textAlign: "center",
        zIndex: 2,
      }}>
        <p style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: "12px",
          fontFamily: "sans-serif",
          letterSpacing: "0.5px",
        }}>
          Powered by College Transport System
        </p>
      </div>

      {/* CSS animation for loading bar */}
      <style>{`
        @keyframes loadbar {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}

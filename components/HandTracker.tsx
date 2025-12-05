import React, { useEffect, useRef, useState } from 'react';
import { HandGestureData } from '../types';

interface HandTrackerProps {
  onUpdate: (data: HandGestureData) => void;
}

declare global {
  interface Window {
    FilesetResolver: any;
    HandLandmarker: any;
  }
}

export const HandTracker: React.FC<HandTrackerProps> = ({ onUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const lastVideoTime = useRef(-1);
  const landmarkerRef = useRef<any>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const setupVision = async () => {
      // Wait for CDN script
      if (!window.FilesetResolver || !window.HandLandmarker) {
        console.warn("MediaPipe Vision not loaded yet.");
        return;
      }

      try {
        const vision = await window.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        landmarkerRef.current = await window.HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        startCamera();
      } catch (e) {
        console.error("Failed to initialize vision:", e);
      }
    };

    // Small delay to ensure script execution
    const t = setTimeout(setupVision, 1000);
    return () => clearTimeout(t);
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', predict);
        setPermissionGranted(true);
      }
    } catch (err) {
      console.error("Camera denied:", err);
    }
  };

  const predict = async () => {
    if (!landmarkerRef.current || !videoRef.current) return;

    let startTimeMs = performance.now();
    
    if (videoRef.current.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = videoRef.current.currentTime;
      const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // Simple Logic: 
        // 1. Calculate bounding box width to check distance (z-depth proxy)
        // 2. Check fingers extended vs curled for Open/Closed
        // Index Tip (8) vs Index PIP (6), etc.
        
        const isFingerExtended = (tipIdx: number, pipIdx: number) => {
          return landmarks[tipIdx].y < landmarks[pipIdx].y; // Higher Y is lower on screen usually, but normalize logic:
          // Distance from wrist (0)
        };
        
        // Simple "Openness" check: Average distance of tips from wrist
        const wrist = landmarks[0];
        const tips = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky
        let avgDist = 0;
        
        tips.forEach(idx => {
           const dx = landmarks[idx].x - wrist.x;
           const dy = landmarks[idx].y - wrist.y;
           avgDist += Math.sqrt(dx*dx + dy*dy);
        });

        // Threshold for open hand vs closed fist
        const isOpen = avgDist > 1.2; // This value needs tuning, usually avg dist is roughly 0.3-0.5 normalized.
        // Let's use a simpler check: Is Index Finger tip above Index Finger PIP? (Standard vertical hand)
        // Hand coordinates: Y increases downwards.
        
        const indexOpen = landmarks[8].y < landmarks[6].y;
        const middleOpen = landmarks[12].y < landmarks[10].y;
        const ringOpen = landmarks[16].y < landmarks[14].y;
        
        const handIsOpen = indexOpen && middleOpen && ringOpen;

        onUpdate({
          isOpen: handIsOpen,
          handX: landmarks[0].x, // Normalized 0-1
          isDetected: true
        });
      } else {
        onUpdate({ isOpen: false, handX: 0.5, isDetected: false });
      }
    }

    requestRef.current = requestAnimationFrame(predict);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 opacity-80 pointer-events-none">
       {/* Hidden logic video, visible for debugging if needed, but keeping small */}
      <video 
        ref={videoRef} 
        className="w-24 h-16 object-cover rounded-lg border-2 border-yellow-500 transform scale-x-[-1]" 
        autoPlay 
        playsInline 
        muted
      />
      {!permissionGranted && <div className="text-yellow-500 text-xs mt-1 bg-black/50 p-1">Initializing Vision...</div>}
    </div>
  );
};
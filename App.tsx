import React, { useState, useEffect, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, Loader } from '@react-three/drei';
import { Effects } from './components/Effects';
import { LuxuryTree } from './components/LuxuryTree';
import { HandTracker } from './components/HandTracker';
import { TreeState, HandGestureData } from './types';
import { CAMERA_POS, COLORS } from './constants';
import { generateLuxuryGreeting } from './services/geminiService';

const App = () => {
  const [treeState, setTreeState] = useState<TreeState>(TreeState.CHAOS);
  const [handData, setHandData] = useState<HandGestureData>({ isOpen: true, handX: 0.5, isDetected: false });
  const [greeting, setGreeting] = useState<string>("");
  const [manualOverride, setManualOverride] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  // Logic to sync state with Hand/Mouse
  useEffect(() => {
    if (manualOverride) return;

    if (handData.isDetected) {
      // If hand is detected, use hand open/close logic
      if (handData.isOpen && treeState !== TreeState.CHAOS) {
        setTreeState(TreeState.CHAOS);
        setGreeting(""); 
      } else if (!handData.isOpen && treeState !== TreeState.FORMED) {
        setTreeState(TreeState.FORMED);
        fetchGreeting();
      }
    }
  }, [handData, treeState, manualOverride]);

  const fetchGreeting = async () => {
    if (greeting) return; // Already have one
    const text = await generateLuxuryGreeting();
    setGreeting(text);
  };

  const toggleState = () => {
    setManualOverride(true);
    if (treeState === TreeState.CHAOS) {
      setTreeState(TreeState.FORMED);
      fetchGreeting();
    } else {
      setTreeState(TreeState.CHAOS);
      setGreeting("");
    }
  };

  return (
    <div className="w-full h-screen relative bg-[#001a10]">
      {/* 3D Scene */}
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[...CAMERA_POS]} fov={50} />
        <ambientLight intensity={0.2} />
        <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} castShadow color={COLORS.GOLD_METALLIC} />
        <pointLight position={[-10, 5, -10]} intensity={1} color={COLORS.EMERALD_LIGHT} />
        
        <Suspense fallback={null}>
          <group position={[0, -5, 0]}>
             <LuxuryTree state={treeState} rotationY={manualOverride ? 0.5 : handData.handX} />
          </group>
          <Environment preset="lobby" />
          <Effects />
        </Suspense>
        
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={!handData.isDetected && treeState === TreeState.FORMED} autoRotateSpeed={0.5} />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-8">
        
        {/* Header */}
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="text-left">
            <h1 className="text-4xl md:text-6xl text-yellow-500 font-bold drop-shadow-lg tracking-wider" style={{ fontFamily: 'Playfair Display' }}>
              THE GRAND TREE
            </h1>
            <p className="text-gray-300 text-sm md:text-base mt-2 tracking-widest uppercase">
              Interactive Luxury Experience
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <button 
              onClick={() => setCameraEnabled(!cameraEnabled)}
              className={`px-4 py-2 border border-yellow-500 text-yellow-500 rounded hover:bg-yellow-500 hover:text-black transition uppercase text-xs tracking-widest font-bold ${cameraEnabled ? 'bg-yellow-500/20' : ''}`}
            >
              {cameraEnabled ? 'Disable Camera' : 'Enable Camera'}
            </button>
            {cameraEnabled && (
               <div className="text-white text-xs text-right opacity-70 max-w-[200px]">
                 <span className="text-yellow-400 block mb-1">GESTURE CONTROL ACTIVE</span>
                 Open Hand: Unleash Chaos<br/>
                 Closed Hand: Form Tree<br/>
                 Move Horizontally: Rotate
               </div>
            )}
          </div>
        </header>

        {/* Center Message */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center w-full px-4 pointer-events-none">
          <div className={`transition-all duration-1000 transform ${treeState === TreeState.FORMED ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-3xl md:text-5xl text-white font-serif italic text-shadow-xl" style={{ textShadow: '0 0 20px gold' }}>
              {greeting || "Forming greatness..."}
            </h2>
          </div>
        </div>

        {/* Footer / Manual Controls */}
        <footer className="w-full flex justify-center pointer-events-auto pb-4">
           {!handData.isDetected && (
             <button 
               onClick={toggleState}
               className="bg-gradient-to-r from-yellow-600 to-yellow-400 text-black font-bold py-3 px-8 rounded-full shadow-[0_0_20px_rgba(255,215,0,0.5)] hover:scale-105 transition transform uppercase tracking-widest border-2 border-white/20"
             >
               {treeState === TreeState.CHAOS ? 'Assemble Perfection' : 'Unleash Chaos'}
             </button>
           )}
           {handData.isDetected && (
             <div className="bg-black/50 backdrop-blur text-yellow-500 px-6 py-2 rounded-full border border-yellow-500/30 animate-pulse">
               AI VISION ACTIVE
             </div>
           )}
        </footer>
      </div>

      {/* Vision Logic */}
      {cameraEnabled && <HandTracker onUpdate={setHandData} />}
      
      <Loader />
    </div>
  );
};

export default App;
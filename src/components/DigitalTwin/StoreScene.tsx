"use client";

import React, { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Box, Cylinder, Text, Plane, Environment, Html, Grid } from "@react-three/drei";
import * as THREE from "three";

// Colors
const CK_RED = "#da291c";
const CK_ORANGE = "#ff8200";
const CK_YELLOW = "#fecb00";
const WHITE = "#ffffff";
const OFF_WHITE = "#f4f4f5";
const DARK_METAL = "#27272a";
const LIGHT_METAL = "#a1a1aa";
const GLASS = "#e0f2fe";

// --- Custom Detailed Components ---

function Gondola({ position, rotation = [0, 0, 0], name, onClick }: any) {
  const [hovered, setHover] = useState(false);
  const shelves = [0.4, 0.8, 1.2, 1.6];
  
  // Generate random products for shelves once
  const products = useMemo(() => {
    const items = [];
    const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
    for (let s of shelves) {
      for (let i = -1.5; i <= 1.5; i += 0.4) {
        if (Math.random() > 0.3) {
          items.push({
            pos: [i, s + 0.1, 0.3],
            color: colors[Math.floor(Math.random() * colors.length)]
          });
          items.push({
            pos: [i, s + 0.1, -0.3],
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        }
      }
    }
    return items;
  }, []);

  return (
    <group 
      position={position} 
      rotation={rotation as any}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(name); }}
    >
      {/* Base */}
      <Box args={[3.6, 0.3, 1.2]} position={[0, 0.15, 0]}>
        <meshStandardMaterial color={hovered ? CK_YELLOW : LIGHT_METAL} />
      </Box>
      {/* Center Backboard */}
      <Box args={[3.6, 2, 0.1]} position={[0, 1, 0]}>
        <meshStandardMaterial color={OFF_WHITE} />
      </Box>
      {/* Shelves */}
      {shelves.map((y, i) => (
        <React.Fragment key={i}>
          <Box args={[3.6, 0.05, 0.5]} position={[0, y, 0.3]}>
            <meshStandardMaterial color={LIGHT_METAL} />
          </Box>
          <Box args={[3.6, 0.05, 0.5]} position={[0, y, -0.3]}>
            <meshStandardMaterial color={LIGHT_METAL} />
          </Box>
        </React.Fragment>
      ))}
      {/* Products */}
      {products.map((p, i) => (
        <Box key={i} args={[0.2, 0.3, 0.2]} position={p.pos as any}>
          <meshStandardMaterial color={p.color} />
        </Box>
      ))}
      
      {/* Label */}
      <Html position={[0, 2.5, 0]} center style={{ display: hovered ? 'block' : 'none', pointerEvents: 'none' }}>
        <div className="bg-black/90 text-white px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap shadow-xl">
          {name}
        </div>
      </Html>
    </group>
  );
}

function GlassFridge({ position, rotation = [0, 0, 0], name, onClick, width = 2 }: any) {
  const [hovered, setHover] = useState(false);
  const shelves = [0.5, 1.0, 1.5, 2.0, 2.5];

  return (
    <group 
      position={position} 
      rotation={rotation as any}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(name); }}
    >
      {/* Outer Shell */}
      <Box args={[width, 3, 1]} position={[0, 1.5, 0]}>
        <meshStandardMaterial color={hovered ? CK_YELLOW : WHITE} />
      </Box>
      {/* Inner Black Cutout */}
      <Box args={[width - 0.2, 2.8, 0.8]} position={[0, 1.5, 0.11]}>
        <meshStandardMaterial color="#000000" />
      </Box>
      
      {/* Shelves Inside */}
      {shelves.map((y, i) => (
        <Box key={i} args={[width - 0.2, 0.05, 0.8]} position={[0, y, 0.1]}>
          <meshStandardMaterial color={LIGHT_METAL} />
        </Box>
      ))}

      {/* Internal Light */}
      <pointLight position={[0, 2.8, 0.4]} intensity={0.5} distance={3} color="#ffffff" />

      {/* Glass Doors */}
      <Box args={[width - 0.1, 2.8, 0.05]} position={[0, 1.5, 0.5]}>
        <meshPhysicalMaterial 
          color={GLASS} 
          transmission={0.9} 
          opacity={1} 
          transparent 
          roughness={0.1} 
          ior={1.5} 
          thickness={0.1} 
        />
      </Box>

      {/* Door Frame/Handle */}
      <Box args={[0.05, 2.8, 0.06]} position={[0, 1.5, 0.5]}>
         <meshStandardMaterial color={DARK_METAL} />
      </Box>

      {/* Label */}
      <Html position={[0, 3.5, 0]} center style={{ display: hovered ? 'block' : 'none', pointerEvents: 'none' }}>
        <div className="bg-black/90 text-white px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap shadow-xl">
          {name}
        </div>
      </Html>
    </group>
  );
}

function CheckoutCounter({ position, rotation = [0, 0, 0] }: any) {
  return (
    <group position={position} rotation={rotation as any}>
      {/* Main Counter Base */}
      <Box args={[2, 1, 6]} position={[0, 0.5, 0]}>
        <meshStandardMaterial color={DARK_METAL} />
      </Box>
      {/* Counter Top */}
      <Box args={[2.1, 0.1, 6.1]} position={[0, 1.05, 0]}>
        <meshStandardMaterial color={OFF_WHITE} />
      </Box>

      {/* POS Register 1 */}
      <group position={[0.2, 1.2, -1.5]} rotation={[0, Math.PI/2, 0]}>
        {/* Stand */}
        <Cylinder args={[0.05, 0.1, 0.3]} position={[0, 0.15, 0]}>
          <meshStandardMaterial color="#111" />
        </Cylinder>
        {/* Screen */}
        <Box args={[0.6, 0.4, 0.05]} position={[0, 0.4, 0.1]} rotation={[-0.2, 0, 0]}>
          <meshStandardMaterial color="#000" />
        </Box>
        {/* Screen Display */}
        <Box args={[0.55, 0.35, 0.01]} position={[0, 0.4, 0.13]} rotation={[-0.2, 0, 0]}>
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
        </Box>
      </group>

      {/* POS Register 2 */}
      <group position={[0.2, 1.2, 1.5]} rotation={[0, Math.PI/2, 0]}>
        <Cylinder args={[0.05, 0.1, 0.3]} position={[0, 0.15, 0]}>
          <meshStandardMaterial color="#111" />
        </Cylinder>
        <Box args={[0.6, 0.4, 0.05]} position={[0, 0.4, 0.1]} rotation={[-0.2, 0, 0]}>
          <meshStandardMaterial color="#000" />
        </Box>
        <Box args={[0.55, 0.35, 0.01]} position={[0, 0.4, 0.13]} rotation={[-0.2, 0, 0]}>
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
        </Box>
      </group>

      {/* Espresso Machine */}
      <group position={[-0.3, 1.1, -2.5]}>
        <Box args={[0.8, 0.6, 0.6]} position={[0, 0.3, 0]}>
          <meshStandardMaterial color={LIGHT_METAL} />
        </Box>
        {/* Group Head */}
        <Cylinder args={[0.1, 0.1, 0.2]} position={[0.2, 0.4, 0.3]} rotation={[Math.PI/2, 0, 0]}>
          <meshStandardMaterial color="#111" />
        </Cylinder>
      </group>
    </group>
  );
}

function BrandedWall({ position, rotation = [0, 0, 0], length }: any) {
  return (
    <group position={position} rotation={rotation as any}>
      {/* Main Wall */}
      <Box args={[length, 3, 0.2]} position={[0, 1.5, 0]}>
        <meshStandardMaterial color={WHITE} />
      </Box>
      {/* Orange Stripe */}
      <Box args={[length + 0.02, 0.4, 0.22]} position={[0, 2.2, 0]}>
        <meshStandardMaterial color={CK_ORANGE} />
      </Box>
      {/* Yellow Stripe */}
      <Box args={[length + 0.02, 0.2, 0.22]} position={[0, 1.9, 0]}>
        <meshStandardMaterial color={CK_YELLOW} />
      </Box>
    </group>
  );
}

export default function StoreScene() {
  const [activeElement, setActiveElement] = useState<string | null>(null);

  const handleElementClick = (name: string) => {
    setActiveElement(name);
  };

  return (
    <div className="w-full h-full relative bg-zinc-950">
      {/* Top overlay UI */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h1 className="text-3xl font-black text-white drop-shadow-lg">Marassi Chillout CK</h1>
        <p className="text-zinc-300 font-medium tracking-wide">Live 3D Digital Twin</p>
      </div>

      {activeElement && (
        <div className="absolute top-6 right-6 z-10 w-80 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-white">{activeElement}</h2>
            <button onClick={() => setActiveElement(null)} className="text-zinc-400 hover:text-white">✕</button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Status</span>
              <span className="text-green-400 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Online
              </span>
            </div>
            {activeElement.includes("Cooler") && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Temperature</span>
                <span className="text-white">4.2°C</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Live Inventory</span>
              <span className="text-white">{Math.floor(Math.random() * 200) + 50} Items</span>
            </div>
          </div>
          <button className="w-full mt-6 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg transition-colors">
            View Camera 02
          </button>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 8, 12], fov: 50 }}>
        {/* Bright realistic lighting */}
        <color attach="background" args={['#18181b']} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 15, 5]} intensity={1.5} castShadow />
        <pointLight position={[0, 4, 0]} intensity={1} distance={10} />
        <Environment preset="apartment" />
        
        {/* Tiled Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[14, 16]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.1} metalness={0.1} />
        </mesh>
        {/* Tile Grid lines */}
        <Grid infiniteGrid fadeDistance={20} sectionColor="#e2e8f0" cellColor="#f1f5f9" sectionSize={2} cellSize={0.5} position={[0, 0, 0]} />
        
        {/* Branded Walls */}
        <BrandedWall position={[0, 0, -6]} length={14} /> {/* Back Wall */}
        <BrandedWall position={[-7, 0, 0]} rotation={[0, Math.PI/2, 0]} length={12} /> {/* Left Wall */}
        <BrandedWall position={[7, 0, 0]} rotation={[0, -Math.PI/2, 0]} length={12} /> {/* Right Wall */}
        
        {/* Glass Front Doors */}
        <group position={[0, 0, 6]}>
          <Box args={[4, 3, 0.1]} position={[0, 1.5, 0]}>
            <meshPhysicalMaterial color={GLASS} transmission={0.9} opacity={1} transparent roughness={0} />
          </Box>
          <Box args={[0.1, 3, 0.15]} position={[0, 1.5, 0]}>
            <meshStandardMaterial color={DARK_METAL} />
          </Box>
        </group>
        <BrandedWall position={[-4.5, 0, 6]} length={5} />
        <BrandedWall position={[4.5, 0, 6]} length={5} />

        {/* --- Highly Detailed Equipment --- */}

        {/* Right Wall Coolers */}
        <GlassFridge position={[6.3, 0, -3]} rotation={[0, -Math.PI/2, 0]} width={2.5} name="Beverage Cooler 1" onClick={handleElementClick} />
        <GlassFridge position={[6.3, 0, 0]} rotation={[0, -Math.PI/2, 0]} width={2.5} name="Beverage Cooler 2" onClick={handleElementClick} />
        <GlassFridge position={[6.3, 0, 3]} rotation={[0, -Math.PI/2, 0]} width={2.5} name="Beverage Cooler 3" onClick={handleElementClick} />

        {/* Center Gondolas */}
        <Gondola position={[-2, 0, 0]} rotation={[0, 0, 0]} name="Snacks Aisle" onClick={handleElementClick} />
        <Gondola position={[2, 0, 0]} rotation={[0, 0, 0]} name="Grocery Aisle" onClick={handleElementClick} />

        {/* Left Checkout Counter */}
        <CheckoutCounter position={[-5, 0, 0]} />

        {/* Back Storage (Simple block for Walk-in Freezer behind back wall) */}
        <Box args={[3, 3, 3]} position={[-4, 1.5, -8]}>
           <meshStandardMaterial color={LIGHT_METAL} />
        </Box>

        <OrbitControls 
          enablePan={true} 
          enableZoom={true} 
          enableRotate={true}
          maxPolarAngle={Math.PI / 2 - 0.05} // Keep camera above ground
          minDistance={2}
          maxDistance={25}
          target={[0, 1, 0]}
        />
      </Canvas>
    </div>
  );
}

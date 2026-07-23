"use client";

import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Box, Cylinder, Text, Plane, Environment, Html } from "@react-three/drei";
import * as THREE from "three";

// Reusable component for a simple clickable 3D block
function StoreElement({ position, size, color, name, onClick }: any) {
  const [hovered, setHover] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh
      position={position}
      ref={meshRef}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(name); }}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial 
        color={hovered ? "#ffcf33" : color} 
        transparent={color === "glass" ? true : false}
        opacity={color === "glass" ? 0.3 : 1}
        roughness={0.2}
      />
      {/* Label */}
      <Html position={[0, size[1]/2 + 0.5, 0]} center style={{ display: hovered ? 'block' : 'none', pointerEvents: 'none' }}>
        <div className="bg-black/80 text-white px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap border border-white/20 shadow-xl">
          {name}
        </div>
      </Html>
    </mesh>
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
        <p className="text-zinc-400 font-medium tracking-wide">Live 3D Digital Twin</p>
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
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Temperature</span>
              <span className="text-white">4.2°C</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Live Inventory</span>
              <span className="text-white">124 Items</span>
            </div>
          </div>
          <button className="w-full mt-6 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg transition-colors">
            View Cameras
          </button>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 15, 15], fov: 45 }}>
        <color attach="background" args={['#09090b']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <Environment preset="city" />
        
        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[12, 14]} />
          <meshStandardMaterial color="#1f1f22" roughness={0.8} />
        </mesh>
        
        {/* Walls */}
        {/* Back Wall (Storage Separation) */}
        <StoreElement position={[0, 1.5, -4]} size={[12, 3, 0.2]} color="#27272a" name="Back Storage Wall" onClick={handleElementClick} />
        {/* Left Wall */}
        <StoreElement position={[-6, 1.5, 0]} size={[0.2, 3, 14]} color="#27272a" name="Left Wall" onClick={handleElementClick} />
        {/* Right Wall */}
        <StoreElement position={[6, 1.5, 0]} size={[0.2, 3, 14]} color="#27272a" name="Right Wall" onClick={handleElementClick} />
        {/* Front Doors (Glass) */}
        <StoreElement position={[0, 1.5, 7]} size={[4, 3, 0.1]} color="glass" name="Main Entrance" onClick={handleElementClick} />
        <StoreElement position={[-4, 1.5, 7]} size={[4, 3, 0.2]} color="#27272a" name="Front Wall Left" onClick={handleElementClick} />
        <StoreElement position={[4, 1.5, 7]} size={[4, 3, 0.2]} color="#27272a" name="Front Wall Right" onClick={handleElementClick} />

        {/* Equipment & Fixtures based on Blueprint */}
        
        {/* Left Counter (Cashier, Coffee, Food) */}
        <StoreElement position={[-5, 0.5, 1]} size={[1.8, 1, 8]} color="#3f3f46" name="Main Service Counter" onClick={handleElementClick} />
        {/* Espresso Machine on Counter */}
        <StoreElement position={[-4.5, 1.25, -2]} size={[0.8, 0.5, 0.6]} color="#71717a" name="Espresso Machine" onClick={handleElementClick} />
        {/* POS Cash Register */}
        <StoreElement position={[-4.5, 1.2, 0]} size={[0.5, 0.4, 0.5]} color="#18181b" name="POS Register 1" onClick={handleElementClick} />
        <StoreElement position={[-4.5, 1.2, 2]} size={[0.5, 0.4, 0.5]} color="#18181b" name="POS Register 2" onClick={handleElementClick} />

        {/* Right Wall Fridges */}
        <StoreElement position={[5.5, 1.5, 1]} size={[1, 3, 8]} color="#0ea5e9" name="Beverage Coolers" onClick={handleElementClick} />

        {/* Center Gondolas (Islands) */}
        <StoreElement position={[-2, 1, 2]} size={[1.2, 2, 4]} color="#52525b" name="Gondola 1 (Snacks)" onClick={handleElementClick} />
        <StoreElement position={[2, 1, 2]} size={[1.2, 2, 4]} color="#52525b" name="Gondola 2 (Grocery)" onClick={handleElementClick} />

        {/* Back Storage Area */}
        <StoreElement position={[-3, 1.5, -6]} size={[2, 3, 1]} color="#a1a1aa" name="Walk-in Freezer" onClick={handleElementClick} />
        <StoreElement position={[2, 1.5, -6]} size={[4, 3, 1]} color="#52525b" name="Dry Storage Shelves" onClick={handleElementClick} />

        <OrbitControls 
          enablePan={true} 
          enableZoom={true} 
          enableRotate={true}
          maxPolarAngle={Math.PI / 2 - 0.1} // Prevent going under the floor
          minDistance={5}
          maxDistance={30}
        />
      </Canvas>
    </div>
  );
}

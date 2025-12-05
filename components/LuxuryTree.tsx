import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html, Instance, Instances, useTexture } from '@react-three/drei';
import { CONFIG, COLORS } from '../constants';
import { TreeState } from '../types';

// Shader for the sparkling needles
const FoliageShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uProgress: { value: 0 }, // 0 = Chaos, 1 = Formed
    uColor1: { value: new THREE.Color(COLORS.EMERALD_DEEP) },
    uColor2: { value: new THREE.Color(COLORS.EMERALD_LIGHT) },
    uGold: { value: new THREE.Color(COLORS.GOLD_METALLIC) }
  },
  vertexShader: `
    uniform float uProgress;
    uniform float uTime;
    attribute vec3 aTargetPos;
    attribute vec3 aChaosPos;
    attribute float aRandom;
    varying vec3 vColor;
    varying float vAlpha;

    // Cubic easing for luxury smooth motion
    float easeOutCubic(float x) {
      return 1.0 - pow(1.0 - x, 3.0);
    }

    void main() {
      // Add some individual lag based on randomness
      float localProgress = clamp((uProgress - aRandom * 0.2) / 0.8, 0.0, 1.0);
      float eased = easeOutCubic(localProgress);

      vec3 pos = mix(aChaosPos, aTargetPos, eased);
      
      // Gentle wind sway when formed
      if(localProgress > 0.9) {
        pos.x += sin(uTime * 2.0 + pos.y) * 0.05;
        pos.z += cos(uTime * 1.5 + pos.y) * 0.05;
      }

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Size attenuation
      gl_PointSize = (4.0 + aRandom * 4.0) * (10.0 / -mvPosition.z);
      
      vAlpha = 0.6 + 0.4 * sin(uTime + aRandom * 10.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uGold;
    varying float vAlpha;
    
    void main() {
      // Circular particle
      vec2 coord = gl_PointCoord - vec2(0.5);
      if(length(coord) > 0.5) discard;
      
      // Gradient mixture
      vec3 color = mix(uColor1, uColor2, 0.5 + 0.5 * sin(vAlpha * 10.0));
      
      // Occasional gold sparkle
      if (vAlpha > 0.95) {
        color = uGold;
      }

      gl_FragColor = vec4(color, 1.0); // No transparency for depth sorting simplicity/perf
    }
  `
};

interface LuxuryTreeProps {
  state: TreeState;
  rotationY: number;
}

interface OrnamentInstanceProps {
  data: any;
  globalState: TreeState;
}

interface PolaroidProps {
  data: any;
  globalState: TreeState;
}

export const LuxuryTree: React.FC<LuxuryTreeProps> = ({ state, rotationY }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  // Generate Geometry Data
  const { pointsGeo, ornamentData, polaroidData } = useMemo(() => {
    // 1. Foliage Points
    const pGeo = new THREE.BufferGeometry();
    const count = CONFIG.foliageCount;
    const chaosPos = new Float32Array(count * 3);
    const targetPos = new Float32Array(count * 3);
    const randoms = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Chaos: Sphere distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 15 * Math.cbrt(Math.random()); 
      chaosPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      chaosPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) + 5;
      chaosPos[i * 3 + 2] = r * Math.cos(phi);

      // Target: Cone Spiral
      const y = Math.random() * CONFIG.treeHeight;
      const coneR = (CONFIG.treeRadius * (CONFIG.treeHeight - y)) / CONFIG.treeHeight;
      const angle = y * 3.0 + Math.random() * Math.PI * 2; // Spiral
      // Add volume noise
      const rNoise = Math.random() * coneR;
      targetPos[i * 3] = rNoise * Math.cos(angle);
      targetPos[i * 3 + 1] = y - CONFIG.treeHeight / 2 + 2;
      targetPos[i * 3 + 2] = rNoise * Math.sin(angle);

      randoms[i] = Math.random();
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(chaosPos, 3)); // Init with chaos for frustum culling fallback
    pGeo.setAttribute('aChaosPos', new THREE.BufferAttribute(chaosPos, 3));
    pGeo.setAttribute('aTargetPos', new THREE.BufferAttribute(targetPos, 3));
    pGeo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    // 2. Ornaments (Instanced)
    const oData = [];
    for (let i = 0; i < CONFIG.ornamentCount; i++) {
      const y = Math.random() * (CONFIG.treeHeight - 1);
      const coneR = (CONFIG.treeRadius * (CONFIG.treeHeight - y)) / CONFIG.treeHeight;
      const angle = Math.random() * Math.PI * 2;
      
      const tx = coneR * Math.cos(angle);
      const ty = y - CONFIG.treeHeight / 2 + 2;
      const tz = coneR * Math.sin(angle);

      // Chaos pos
      const cx = (Math.random() - 0.5) * 30;
      const cy = (Math.random() - 0.5) * 30 + 10;
      const cz = (Math.random() - 0.5) * 30;

      oData.push({ chaos: [cx, cy, cz], target: [tx, ty, tz], color: Math.random() > 0.7 ? COLORS.GOLD_METALLIC : COLORS.RED_VELVET, scale: 0.2 + Math.random() * 0.3 });
    }

    // 3. Polaroids
    const pData = [];
    for(let i=0; i<CONFIG.polaroidCount; i++) {
      const y = 2 + Math.random() * (CONFIG.treeHeight - 4); // Keep mostly middle
      const coneR = ((CONFIG.treeRadius + 0.5) * (CONFIG.treeHeight - y)) / CONFIG.treeHeight;
      const angle = (i / CONFIG.polaroidCount) * Math.PI * 8; // Spiral distribution
      
      const tx = coneR * Math.cos(angle);
      const ty = y - CONFIG.treeHeight / 2 + 2;
      const tz = coneR * Math.sin(angle);

       // Chaos pos
      const cx = (Math.random() - 0.5) * 40;
      const cy = (Math.random() - 0.5) * 40;
      const cz = (Math.random() - 0.5) * 40;

      pData.push({ chaos: [cx,cy,cz], target: [tx,ty,tz], id: i });
    }

    return { pointsGeo: pGeo, ornamentData: oData, polaroidData: pData };
  }, []);

  // Animation Loop
  useFrame((stateCtx, delta) => {
    if (!shaderRef.current || !groupRef.current) return;

    // Smooth rotation based on hand input
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotationY * Math.PI * 2, 0.05);

    // Transition Logic
    const targetProgress = state === TreeState.FORMED ? 1 : 0;
    shaderRef.current.uniforms.uProgress.value = THREE.MathUtils.lerp(
      shaderRef.current.uniforms.uProgress.value,
      targetProgress,
      delta * 1.5
    );
    shaderRef.current.uniforms.uTime.value = stateCtx.clock.elapsedTime;
  });

  return (
    <group ref={groupRef}>
      {/* 1. Needles */}
      <points geometry={pointsGeo}>
        <shaderMaterial ref={shaderRef} args={[FoliageShaderMaterial]} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      {/* 2. Ornaments - Using multiple Instances components for colors would be ideal, but mapping color in one loop is easier here */}
      <Instances range={CONFIG.ornamentCount}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial roughness={0.1} metalness={0.9} />
        {ornamentData.map((d, i) => (
          <OrnamentInstance key={i} data={d} globalState={state} />
        ))}
      </Instances>

      {/* 3. Star on Top */}
      <mesh position={[0, CONFIG.treeHeight/2 + 2.5, 0]} scale={state === TreeState.FORMED ? 1 : 0}>
         <octahedronGeometry args={[0.8, 0]} />
         <meshStandardMaterial color={COLORS.GOLD_ROSE} emissive={COLORS.GOLD_METALLIC} emissiveIntensity={2} toneMapped={false} />
      </mesh>

      {/* 4. Polaroids */}
      {polaroidData.map((d, i) => (
         <Polaroid key={i} data={d} globalState={state} />
      ))}
    </group>
  );
};

// Helper for animating instances
const OrnamentInstance: React.FC<OrnamentInstanceProps> = ({ data, globalState }) => {
  const ref = useRef<any>(null);
  
  useFrame((_, delta) => {
    if (!ref.current) return;
    const target = globalState === TreeState.FORMED ? data.target : data.chaos;
    
    // Simple lerp for position
    ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, target[0], delta * 2);
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, target[1], delta * 2);
    ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, target[2], delta * 2);
    ref.current.scale.setScalar(data.scale);
  });

  return <Instance ref={ref} color={data.color} />;
};

const Polaroid: React.FC<PolaroidProps> = ({ data, globalState }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [textureUrl] = useState(`https://picsum.photos/seed/${data.id + 100}/200/200`);
  // Note: Loading texture inside component might cause pop-in, but acceptable for this demo scope.
  const texture = useTexture(textureUrl); 

  useFrame((_, delta) => {
    if(!meshRef.current) return;
    const target = globalState === TreeState.FORMED ? data.target : data.chaos;
    
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, target[0], delta * 2.5); // Photos move slightly faster
    meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, target[1], delta * 2.5);
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, target[2], delta * 2.5);
    
    // Look at center if formed
    if (globalState === TreeState.FORMED) {
      meshRef.current.lookAt(0, meshRef.current.position.y, 0);
    } else {
       meshRef.current.rotation.x += delta;
       meshRef.current.rotation.z += delta;
    }
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <boxGeometry args={[1, 1.2, 0.05]} />
      <meshStandardMaterial color={COLORS.PLATINUM} metalness={0.5} roughness={0.2} />
      <mesh position={[0, 0.1, 0.03]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </mesh>
  );
};
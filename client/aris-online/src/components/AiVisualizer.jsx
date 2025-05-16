import React from 'react';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Sphere, MeshDistortMaterial } from '@react-three/drei';

function AiVisualizer() {
  const sphereRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    sphereRef.current.distort = Math.sin(t) * 0.3 + 0.5;
  });

  return (
    <Sphere ref={sphereRef} args={[2, 64, 64]}>
      <MeshDistortMaterial
        color="#00a8ff"
        attach="material"
        distort={0.5}
        speed={5}
        roughness={0}
        metalness={0.8}
      />
    </Sphere>
  );
}

export default AiVisualizer;
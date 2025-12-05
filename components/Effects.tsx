import React from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { KernelSize, Resolution } from 'postprocessing';

export const Effects: React.FC = () => {
  return (
    <EffectComposer disableNormalPass>
      <Bloom 
        intensity={1.5} 
        luminanceThreshold={0.65} 
        luminanceSmoothing={0.9} 
        height={300} 
        kernelSize={KernelSize.LARGE}
      />
      <Vignette eskil={false} offset={0.1} darkness={0.5} />
    </EffectComposer>
  );
};
import { Bloom, EffectComposer, FXAA, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type EffectComposer as EffectComposerImpl } from 'postprocessing'
import { setComposer } from './composer'

// Posproceso de calidad alta (trozo aparte, se carga diferido).
export default function PostEffects({ quality }: { quality: 'media' | 'alta' }) {
  return (
    <EffectComposer
      ref={(c) => setComposer((c as unknown as EffectComposerImpl) ?? null)}
      multisampling={0}
      enableNormalPass={false}
    >
      <Bloom mipmapBlur intensity={quality === 'alta' ? 0.6 : 0.45} luminanceThreshold={0.88} luminanceSmoothing={0.2} radius={0.7} />
      {quality === 'alta' ? <SMAA /> : <FXAA />}
      <Vignette offset={0.32} darkness={0.42} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

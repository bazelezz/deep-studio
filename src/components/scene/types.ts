export type ScenePhase = 'poster' | 'preparing' | 'opening' | 'ready' | 'entering' | 'content' | 'fallback' | 'skip' | 'reduced-motion';
export type SceneDebug = 'closed' | 'glint' | 'edge' | 'gap' | 'half' | 'ready' | 'entering' | null;
export interface ScreenBounds { left: number; top: number; width: number; height: number }
export type ScreenQuad = [number, number][];
export interface SceneControls {
  open: (done: () => void) => void;
  finish: () => void;
  replay?: (done: () => void) => void;
  enter: (progress: number) => void;
  visible: (visible: boolean) => void;
}
export interface LaptopCanvasProps {
  stillFrame?: boolean;
  cinematic?: boolean;
  debug: SceneDebug;
  onReady: (controls: SceneControls) => void;
  onError: () => void;
  onBounds: (bounds: ScreenBounds, progress: number) => void;
  onDisplay?: (corners: ScreenQuad, brightness: number, opening: number) => void;
}

export enum TreeState {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED'
}

export interface HandGestureData {
  isOpen: boolean; // True if hand is open (Unleash), False if closed (Form)
  handX: number; // Normalized X position (0-1) for rotation control
  isDetected: boolean;
}

export interface TreeConfig {
  foliageCount: number;
  ornamentCount: number;
  polaroidCount: number;
  treeHeight: number;
  treeRadius: number;
}
export interface VideoFile {
  file: File;
  url: string;
  duration: number;
  name: string;
  type: string;
}

export interface VideoMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  mood?: string;
}

export enum EditorState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  EDITING = 'EDITING',
  EXPORTING = 'EXPORTING',
}

export interface Filter {
  name: string;
  class: string; // Tailwind class or CSS filter string
}

export const FILTERS: Filter[] = [
  { name: 'Normal', class: 'none' },
  { name: 'Grayscale', class: 'grayscale(100%)' },
  { name: 'Sepia', class: 'sepia(100%)' },
  { name: 'Contrast', class: 'contrast(150%)' },
  { name: 'Brightness', class: 'brightness(120%)' },
  { name: 'Blur', class: 'blur(2px)' },
  { name: 'Invert', class: 'invert(100%)' },
  { name: 'Saturate', class: 'saturate(200%)' },
];
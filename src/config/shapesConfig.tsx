import React from 'react';
import { CanvasObjectType } from '@sabi-canvas/types/canvas-objects';

// Shape definition for the Elements panel
export interface ShapeDefinition {
  id: string;
  type: CanvasObjectType;
  label: string;
  preview: React.ReactNode;
  // For path shapes
  pathData?: string;
  pathWidth?: number;
  pathHeight?: number;
  defaultFill?: string;
}

// Shape category
export interface ShapeCategory {
  id: string;
  label: string;
  shapes: ShapeDefinition[];
}

// Basic shapes
const basicShapes: ShapeDefinition[] = [
  {
    id: 'rectangle',
    type: 'rectangle',
    label: 'Rectangle',
    preview: (
      <div className="w-10 h-8 bg-primary/30 border-2 border-primary rounded" />
    ),
  },
  {
    id: 'rounded-rect',
    type: 'rectangle',
    label: 'Rounded',
    preview: (
      <div className="w-10 h-8 bg-primary/30 border-2 border-primary rounded-lg" />
    ),
  },
  {
    id: 'circle',
    type: 'circle',
    label: 'Circle',
    preview: (
      <div className="w-8 h-8 bg-purple-500/30 border-2 border-purple-500 rounded-full" />
    ),
  },
  {
    id: 'ellipse',
    type: 'ellipse',
    label: 'Ellipse',
    preview: (
      <div className="w-10 h-6 bg-emerald-500/30 border-2 border-emerald-500 rounded-full" />
    ),
  },
  {
    id: 'triangle',
    type: 'triangle',
    label: 'Triangle',
    preview: (
      <svg viewBox="0 0 40 35" className="w-10 h-8">
        <polygon 
          points="20,2 38,33 2,33" 
          fill="hsl(45, 93%, 58%, 0.3)" 
          stroke="hsl(45, 93%, 58%)" 
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    id: 'pentagon',
    type: 'polygon',
    label: 'Pentagon',
    preview: (
      <svg viewBox="0 0 40 40" className="w-8 h-8">
        <polygon 
          points="20,2 38,15 32,36 8,36 2,15" 
          fill="hsl(330, 80%, 60%, 0.3)" 
          stroke="hsl(330, 80%, 60%)" 
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    id: 'hexagon',
    type: 'polygon',
    label: 'Hexagon',
    preview: (
      <svg viewBox="0 0 40 36" className="w-9 h-8">
        <polygon 
          points="10,2 30,2 40,18 30,34 10,34 0,18" 
          fill="hsl(200, 80%, 60%, 0.3)" 
          stroke="hsl(200, 80%, 60%)" 
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    id: 'star',
    type: 'star',
    label: 'Star',
    preview: (
      <svg viewBox="0 0 40 40" className="w-8 h-8">
        <polygon 
          points="20,2 24,14 38,14 27,22 31,36 20,28 9,36 13,22 2,14 16,14" 
          fill="hsl(50, 100%, 50%, 0.3)" 
          stroke="hsl(50, 100%, 50%)" 
          strokeWidth="2"
        />
      </svg>
    ),
  },
];

// Lines & Arrows
const linesAndArrows: ShapeDefinition[] = [
  {
    id: 'line',
    type: 'line',
    label: 'Line',
    preview: (
      <svg viewBox="0 0 40 20" className="w-10 h-5">
        <line x1="2" y1="10" x2="38" y2="10" stroke="currentColor" strokeWidth="3" />
      </svg>
    ),
  },
  {
    id: 'arrow-right',
    type: 'arrow',
    label: 'Arrow',
    preview: (
      <svg viewBox="0 0 40 20" className="w-10 h-5">
        <line x1="2" y1="10" x2="30" y2="10" stroke="currentColor" strokeWidth="3" />
        <polygon points="28,4 38,10 28,16" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'arrow-double',
    type: 'arrow',
    label: 'Double Arrow',
    preview: (
      <svg viewBox="0 0 40 20" className="w-10 h-5">
        <line x1="10" y1="10" x2="30" y2="10" stroke="currentColor" strokeWidth="3" />
        <polygon points="12,4 2,10 12,16" fill="currentColor" />
        <polygon points="28,4 38,10 28,16" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'curved-arrow',
    type: 'path',
    label: 'Curved Arrow',
    pathData: 'M 10 80 Q 50 10 90 50 L 85 40 M 90 50 L 80 55',
    pathWidth: 100,
    pathHeight: 90,
    preview: (
      <svg viewBox="0 0 40 30" className="w-10 h-6">
        <path 
          d="M 5 25 Q 20 5 35 15" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        />
        <polygon points="33,10 38,16 31,17" fill="currentColor" />
      </svg>
    ),
  },
];

// Callouts & Badges
const calloutsAndBadges: ShapeDefinition[] = [
  {
    id: 'speech-bubble',
    type: 'path',
    label: 'Speech Bubble',
    pathData: 'M 10 10 L 190 10 Q 200 10 200 20 L 200 100 Q 200 110 190 110 L 60 110 L 30 140 L 40 110 L 10 110 Q 0 110 0 100 L 0 20 Q 0 10 10 10 Z',
    pathWidth: 200,
    pathHeight: 150,
    defaultFill: 'hsl(217, 91%, 60%)',
    preview: (
      <svg viewBox="0 0 45 35" className="w-11 h-8">
        <path 
          d="M 5 3 L 40 3 Q 43 3 43 6 L 43 22 Q 43 25 40 25 L 15 25 L 8 32 L 10 25 L 5 25 Q 2 25 2 22 L 2 6 Q 2 3 5 3 Z"
          fill="hsl(217, 91%, 60%, 0.3)"
          stroke="hsl(217, 91%, 60%)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    id: 'thought-bubble',
    type: 'path',
    label: 'Thought Bubble',
    pathData: 'M 100 10 Q 180 10 180 60 Q 180 110 100 110 Q 20 110 20 60 Q 20 10 100 10 M 35 110 Q 30 120 25 115 Q 20 120 15 125',
    pathWidth: 200,
    pathHeight: 140,
    defaultFill: 'hsl(200, 80%, 60%)',
    preview: (
      <svg viewBox="0 0 45 35" className="w-11 h-8">
        <ellipse cx="22" cy="14" rx="18" ry="12" fill="hsl(200, 80%, 60%, 0.3)" stroke="hsl(200, 80%, 60%)" strokeWidth="1.5" />
        <circle cx="8" cy="28" r="3" fill="hsl(200, 80%, 60%, 0.3)" stroke="hsl(200, 80%, 60%)" strokeWidth="1" />
        <circle cx="4" cy="32" r="2" fill="hsl(200, 80%, 60%, 0.3)" stroke="hsl(200, 80%, 60%)" strokeWidth="1" />
      </svg>
    ),
  },
  {
    id: 'banner',
    type: 'path',
    label: 'Banner',
    pathData: 'M 0 20 L 20 0 L 20 15 L 180 15 L 180 0 L 200 20 L 180 40 L 180 55 L 20 55 L 20 40 Z',
    pathWidth: 200,
    pathHeight: 70,
    defaultFill: 'hsl(45, 93%, 58%)',
    preview: (
      <svg viewBox="0 0 45 20" className="w-11 h-5">
        <path 
          d="M 0 10 L 6 3 L 6 7 L 39 7 L 39 3 L 45 10 L 39 17 L 39 13 L 6 13 L 6 17 Z"
          fill="hsl(45, 93%, 58%, 0.3)"
          stroke="hsl(45, 93%, 58%)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    id: 'ribbon',
    type: 'path',
    label: 'Ribbon',
    pathData: 'M 0 30 L 15 15 L 15 25 L 185 25 L 185 15 L 200 30 L 200 50 L 185 65 L 185 55 L 15 55 L 15 65 L 0 50 Z',
    pathWidth: 200,
    pathHeight: 80,
    defaultFill: 'hsl(0, 70%, 55%)',
    preview: (
      <svg viewBox="0 0 50 20" className="w-12 h-5">
        <path 
          d="M 0 7 L 5 3 L 5 5 L 45 5 L 45 3 L 50 7 L 50 13 L 45 17 L 45 15 L 5 15 L 5 17 L 0 13 Z"
          fill="hsl(0, 70%, 55%, 0.3)"
          stroke="hsl(0, 70%, 55%)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    id: 'badge-circle',
    type: 'path',
    label: 'Badge',
    pathData: 'M 100 0 L 115 35 L 150 20 L 135 55 L 170 70 L 135 85 L 150 120 L 115 105 L 100 140 L 85 105 L 50 120 L 65 85 L 30 70 L 65 55 L 50 20 L 85 35 Z',
    pathWidth: 200,
    pathHeight: 140,
    defaultFill: 'hsl(280, 65%, 60%)',
    preview: (
      <svg viewBox="0 0 40 40" className="w-8 h-8">
        <path 
          d="M 20 2 L 24 10 L 33 7 L 29 16 L 38 20 L 29 24 L 33 33 L 24 30 L 20 38 L 16 30 L 7 33 L 11 24 L 2 20 L 11 16 L 7 7 L 16 10 Z"
          fill="hsl(280, 65%, 60%, 0.3)"
          stroke="hsl(280, 65%, 60%)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    id: 'starburst',
    type: 'path',
    label: 'Starburst',
    pathData: 'M 100 0 L 108 40 L 140 15 L 120 50 L 160 50 L 125 70 L 155 100 L 115 90 L 100 130 L 85 90 L 45 100 L 75 70 L 40 50 L 80 50 L 60 15 L 92 40 Z',
    pathWidth: 200,
    pathHeight: 130,
    defaultFill: 'hsl(150, 60%, 50%)',
    preview: (
      <svg viewBox="0 0 40 40" className="w-8 h-8">
        <polygon 
          points="20,2 23,12 30,6 26,15 36,15 27,20 34,28 24,25 20,36 16,25 6,28 13,20 4,15 14,15 10,6 17,12"
          fill="hsl(150, 60%, 50%, 0.3)"
          stroke="hsl(150, 60%, 50%)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
];

// Custom paths / icons
const customShapes: ShapeDefinition[] = [
  {
    id: 'heart',
    type: 'path',
    label: 'Heart',
    pathData: 'M 100 180 C 20 120 0 60 50 30 C 80 10 100 30 100 50 C 100 30 120 10 150 30 C 200 60 180 120 100 180 Z',
    pathWidth: 200,
    pathHeight: 190,
    defaultFill: 'hsl(350, 80%, 55%)',
    preview: (
      <svg viewBox="0 0 40 36" className="w-8 h-7">
        <path 
          d="M 20 32 C 6 24 2 14 8 8 C 12 4 18 6 20 10 C 22 6 28 4 32 8 C 38 14 34 24 20 32 Z"
          fill="hsl(350, 80%, 55%, 0.3)"
          stroke="hsl(350, 80%, 55%)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    id: 'diamond',
    type: 'path',
    label: 'Diamond',
    pathData: 'M 100 0 L 200 100 L 100 200 L 0 100 Z',
    pathWidth: 200,
    pathHeight: 200,
    defaultFill: 'hsl(180, 70%, 50%)',
    preview: (
      <svg viewBox="0 0 36 36" className="w-7 h-7">
        <polygon 
          points="18,2 34,18 18,34 2,18"
          fill="hsl(180, 70%, 50%, 0.3)"
          stroke="hsl(180, 70%, 50%)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    id: 'cross',
    type: 'path',
    label: 'Cross',
    pathData: 'M 70 0 L 130 0 L 130 70 L 200 70 L 200 130 L 130 130 L 130 200 L 70 200 L 70 130 L 0 130 L 0 70 L 70 70 Z',
    pathWidth: 200,
    pathHeight: 200,
    defaultFill: 'hsl(0, 70%, 55%)',
    preview: (
      <svg viewBox="0 0 36 36" className="w-7 h-7">
        <path 
          d="M 13 2 L 23 2 L 23 13 L 34 13 L 34 23 L 23 23 L 23 34 L 13 34 L 13 23 L 2 23 L 2 13 L 13 13 Z"
          fill="hsl(0, 70%, 55%, 0.3)"
          stroke="hsl(0, 70%, 55%)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    id: 'lightning',
    type: 'path',
    label: 'Lightning',
    pathData: 'M 120 0 L 60 90 L 100 90 L 80 180 L 140 80 L 100 80 Z',
    pathWidth: 200,
    pathHeight: 180,
    defaultFill: 'hsl(50, 100%, 50%)',
    preview: (
      <svg viewBox="0 0 30 40" className="w-6 h-8">
        <polygon 
          points="18,0 8,16 14,16 10,36 22,14 16,14"
          fill="hsl(50, 100%, 50%, 0.3)"
          stroke="hsl(50, 100%, 50%)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    id: 'cloud',
    type: 'path',
    label: 'Cloud',
    pathData: 'M 40 80 Q 0 80 10 55 Q 0 30 35 30 Q 50 0 85 15 Q 130 0 140 35 Q 180 30 180 60 Q 200 80 160 90 L 40 90 Q 0 90 40 80 Z',
    pathWidth: 200,
    pathHeight: 100,
    defaultFill: 'hsl(210, 40%, 75%)',
    preview: (
      <svg viewBox="0 0 45 25" className="w-11 h-6">
        <path 
          d="M 10 18 Q 2 18 4 13 Q 2 8 10 8 Q 14 2 22 4 Q 32 2 34 9 Q 42 8 42 14 Q 45 18 38 20 L 10 20 Q 2 20 10 18 Z"
          fill="hsl(210, 40%, 75%, 0.3)"
          stroke="hsl(210, 40%, 75%)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    id: 'moon',
    type: 'path',
    label: 'Moon',
    pathData: 'M 60 10 Q 10 30 10 100 Q 10 170 60 190 Q 0 170 0 100 Q 0 30 60 10 Z',
    pathWidth: 70,
    pathHeight: 200,
    defaultFill: 'hsl(45, 90%, 60%)',
    preview: (
      <svg viewBox="0 0 25 40" className="w-5 h-8">
        <path 
          d="M 15 2 Q 5 6 5 20 Q 5 34 15 38 Q 2 34 2 20 Q 2 6 15 2 Z"
          fill="hsl(45, 90%, 60%, 0.3)"
          stroke="hsl(45, 90%, 60%)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
];

// All shape categories
export const shapeCategories: ShapeCategory[] = [
  {
    id: 'basic',
    label: 'Basic Shapes',
    shapes: basicShapes,
  },
  {
    id: 'lines',
    label: 'Lines & Arrows',
    shapes: linesAndArrows,
  },
  {
    id: 'callouts',
    label: 'Callouts & Badges',
    shapes: calloutsAndBadges,
  },
  {
    id: 'custom',
    label: 'Custom Shapes',
    shapes: customShapes,
  },
];

// Get all shapes flat
export const getAllShapes = (): ShapeDefinition[] => {
  return shapeCategories.flatMap(category => category.shapes);
};

// Find shape by id
export const getShapeById = (id: string): ShapeDefinition | undefined => {
  return getAllShapes().find(shape => shape.id === id);
};

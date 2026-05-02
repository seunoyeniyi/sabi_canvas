import React from 'react';

export const DrawPenIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
    <path d="M12.394 1.154h-.788l-4.574 12.17L7 23h1v-8.292l1.498 1.499 2.502-2.5 2.499 2.5 1.501-1.5V23h1v-9.5zM12 2.95L13.147 6h-2.294zm0 9.344l-2.502 2.5-1.417-1.418L10.477 7h3.046l2.396 6.374-1.42 1.419z" />
  </svg>
);

export const DrawMarkerIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="1" strokeLinecap="square" strokeLinejoin="miter" {...props}>
    <path fillRule="evenodd" clipRule="evenodd" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    <path d="M6 20L8 13H16L18 20" />
    <path d="M9.5 13L11.0299 6.88057C11.2823 5.87062 12.7177 5.87062 12.9701 6.88057L14.5 13" />
  </svg>
);

export const DrawHighlighterIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
    <path d="M15 9.361v-7.6l-6 2.4v5.2l-3 5V23h1v-8h10v8h1v-8.639zm-5-4.523l4-1.6V7h-4zm0 4.8V8h4v1.639L16.617 14H7.383z" />
  </svg>
);

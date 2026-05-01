import React from 'react';
import { Line } from 'react-konva';
import { AlignmentLine } from '@sabi-canvas/types/canvas';

interface AlignmentGuidesProps {
    lines: AlignmentLine[];
}

export const AlignmentGuides: React.FC<AlignmentGuidesProps> = ({ lines }) => {
    if (!lines.length) return null;

    return (
        <>
            {lines.map((line, i) => (
                <Line
                    key={i}
                    points={line.points}
                    stroke="hsl(333, 71%, 51%)" // A distinct color (magenta-ish)
                    strokeWidth={1}
                    dash={[4, 4]}
                    listening={false}
                />
            ))}
        </>
    );
};

export default AlignmentGuides;

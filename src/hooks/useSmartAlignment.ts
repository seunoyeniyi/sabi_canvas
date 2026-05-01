import { useState, useCallback } from 'react';
import Konva from 'konva';
import { CanvasObject } from '@sabi-canvas/types/canvas-objects';
import { AlignmentLine } from '@sabi-canvas/types/canvas';

const SNAP_THRESHOLD = 5;

type SnapDirection = 'start' | 'center' | 'end';

interface SnapItem {
    guide: number;
    offset: number;
    snap: SnapDirection;
}

export const useSmartAlignment = (
    objects: CanvasObject[],
    selectedIds: string[],
    designSize: { width: number; height: number },
    scale: number = 1
) => {
    const [alignmentLines, setAlignmentLines] = useState<AlignmentLine[]>([]);

    const handleDragMove = useCallback(
        (e: Konva.KonvaEventObject<DragEvent>) => {
            const node = e.target;
            const stage = node.getStage();

            if (!stage) return;

            // Clear previous lines
            const newLines: AlignmentLine[] = [];

            // Get the bounding box of the dragging object
            // We use getClientRect to account for rotation/scale if needed, 
            // but for simple drag snapping, using x/y/width/height is often more stable 
            // to "state" rather than "visuals" if we want to align to properties.
            // However, visual alignment (getClientRect) is usually expected by users.

            // NOTE: For performance and simplicity, we'll start with node attributes (box model).
            // Assuming objects are roughly rectangular for alignment purposes.
            const box = {
                x: node.x(),
                y: node.y(),
                width: node.width() * node.scaleX(),
                height: node.height() * node.scaleY(),
                rotation: node.rotation()
            };

            // Calculate object edges
            // If rotation is 0, this is simple. If not, it's complex. 
            // We will stick to simple AABB logic based on x/y for MVP, 
            // assuming x/y is top-left.

            // Note: Konva's default for shapes like Circle/Ellipse is center, 
            // but our CanvasShape.tsx seems to try to normalize? 
            // Actually standardizing on "visual bounding box" is best.

            const absPos = node.getAbsolutePosition();
            // This gets tricky because we need to compare with "Other Objects" 
            // which we only have as state (CanvasObject[]).
            // We don't have their Konva Nodes reference easily here to call getClientRect.

            // So we MUST use the state `objects` to calculate snap targets.
            // We assumes `objects.x/y` are RELIABLE visual coordinates (Top-Left or defined anchor).

            // Current simplified logic: Assume x,y is Top-Left.

            const draggingId = node.name();

            // Vertical Snap Targets (X-axis lines)
            const verticalGuides: number[] = [
                0, // Canvas Left
                designSize.width / 2, // Canvas Center
                designSize.width // Canvas Right
            ];

            // Horizontal Snap Targets (Y-axis lines)
            const horizontalGuides: number[] = [
                0, // Canvas Top
                designSize.height / 2, // Canvas Center
                designSize.height // Canvas Bottom
            ];

            // Add other objects' edges to guides
            objects.forEach(obj => {
                // Skip self and selected objects (if dragging multiple)
                if (selectedIds.includes(obj.id)) return;

                // X guides
                verticalGuides.push(obj.x); // Left
                verticalGuides.push(obj.x + obj.width / 2); // Center
                verticalGuides.push(obj.x + obj.width); // Right

                // Y guides
                horizontalGuides.push(obj.y); // Top
                horizontalGuides.push(obj.y + obj.height / 2); // Center
                horizontalGuides.push(obj.y + obj.height); // Bottom
            });

            // Find Matches for X
            // We check: Left, Center, Right of dragged object against all verticalGuides
            const edgesX = [
                { val: box.x, type: 'start' as const },
                { val: box.x + box.width / 2, type: 'center' as const },
                { val: box.x + box.width, type: 'end' as const }
            ];

            let minDiffX = SNAP_THRESHOLD / scale;
            let snapX: number | null = null;
            let matchedGuideX: number | null = null;

            edgesX.forEach(edge => {
                verticalGuides.forEach(guide => {
                    const diff = Math.abs(edge.val - guide);
                    if (diff < minDiffX) {
                        minDiffX = diff;
                        // Value we want to snap to: `guide` is where the line is.
                        // But we need to set `node.x()` such that `edge.val` becomes `guide`.
                        // node.x = guide - offset
                        const offset = edge.val - box.x;
                        snapX = guide - offset;
                        matchedGuideX = guide;
                    }
                });
            });

            // Find Matches for Y
            const edgesY = [
                { val: box.y, type: 'start' as const },
                { val: box.y + box.height / 2, type: 'center' as const },
                { val: box.y + box.height, type: 'end' as const }
            ];

            let minDiffY = SNAP_THRESHOLD / scale;
            let snapY: number | null = null;
            let matchedGuideY: number | null = null;

            edgesY.forEach(edge => {
                horizontalGuides.forEach(guide => {
                    const diff = Math.abs(edge.val - guide);
                    if (diff < minDiffY) {
                        minDiffY = diff;
                        const offset = edge.val - box.y;
                        snapY = guide - offset;
                        matchedGuideY = guide;
                    }
                });
            });

            // Apply Snapping
            if (snapX !== null && matchedGuideX !== null) {
                node.x(snapX);
                // Create Visual Line
                // We want line to span from min(objectY, guideTargetY) to max...
                // But simplifying: just full canvas height or contextual?
                // Let's do contextual: From the "snapped object" to the "target object"?
                // Canvas guides: Full height.
                // For now, let's draw full height/width lines for MVP visibility.
                // Or better: -50 to +50 screensize?
                newLines.push({
                    orientation: 'vertical',
                    points: [matchedGuideX, -5000, matchedGuideX, 5000]
                });
            }

            if (snapY !== null && matchedGuideY !== null) {
                node.y(snapY);
                newLines.push({
                    orientation: 'horizontal',
                    points: [-5000, matchedGuideY, 5000, matchedGuideY]
                });
            }

            setAlignmentLines(newLines);
        },
        [objects, selectedIds, designSize, scale]
    );

    const handleDragEnd = useCallback(() => {
        setAlignmentLines([]);
    }, []);

    return {
        alignmentLines,
        handleDragMove,
        handleDragEnd
    };
};

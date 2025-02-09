import { ManifoldToplevel, Vec3, Manifold } from '../manifold_lib/built/manifold';
import { blue } from './colorgradient';

export const mainAssembly = (m: ManifoldToplevel) => {
    // Main shelf dimensions
    const length = 120;
    const depth = 30;
    const thickness = 4;
    const supportHeight = 50;
    const supportThickness = 6;

    // Create main shelf platform
    const platform = m.Manifold.cube([length, depth, thickness], false);

    // Create vertical supports
    const createSupport = (x: number, y: number) => {
        return m.Manifold.cube([supportThickness, supportThickness, supportHeight], false)
            .translate(x, y, -supportHeight);
    };

    // Front supports
    const frontLeft = createSupport(10, 0);
    const frontRight = createSupport(length - 10 - supportThickness, 0);

    // Back supports
    const backLeft = createSupport(10, depth - supportThickness);
    const backRight = createSupport(length - 10 - supportThickness, depth - supportThickness);

    // Create cross braces
    const crossBrace = m.Manifold.cube([length - 20, supportThickness, supportThickness], false)
        .translate(10, depth/2 - supportThickness/2, -supportHeight);

    // Combine all elements
    const shelf = platform
        .add(frontLeft)
        .add(frontRight)
        .add(backLeft)
        .add(backRight)
        .add(crossBrace);

    // Add rounded edges for safety
    return blue(shelf.warp((v: Vec3) => {
        const radius = 2;
        const corners = [
            [10, 10],
            [length - 10, 10],
            [10, depth - 10],
            [length - 10, depth - 10]
        ];
        
        for (const [x, y] of corners) {
            const dx = v[0] - x;
            const dy = v[1] - y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < radius) {
                v[2] += (radius - dist) * 0.5;
            }
        }
    }));
};

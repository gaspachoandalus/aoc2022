import * as THREE from 'three';
import { vector3DAsString } from "./vector.js";

type CoordinateAxis = "x" | "y" | "z";

type GeometryBuffers = {
    indices: number[];
    vertices: number[];
    normals: number[];
    uvs: number[];
    numberOfVertices: number;
    groupStart: number;
};

type PlaneDefinition = {
    u: CoordinateAxis;
    v: CoordinateAxis;
    w: CoordinateAxis;
    uDirection: number;
    vDirection: number;
    width: number;
    height: number;
    depth: number;
    offsetU: number;
    offsetV: number;
    offsetW: number;
    gridX: number;
    gridY: number;
    materialIndex: number;
};

export class VoxelGeometry {
    voxels: Map<string, {pos: THREE.Vector3, neighbors: number}>; // stores all points individually
    leafs: Map<string, THREE.Vector3>; // visible points (those having at least 1 missing neighbors)
    cubeSize: number;
    buffer: ArrayBuffer;
    verticiesCount: number;

    static readonly moves3D: Record<string, THREE.Vector3> = {
        "px": new THREE.Vector3(1, 0, 0),
        "nx": new THREE.Vector3(-1, 0, 0),
        "py": new THREE.Vector3(0, 1, 0),
        "ny": new THREE.Vector3(0, -1, 0),
        "pz": new THREE.Vector3(0, 0, 1),
        "nz": new THREE.Vector3(0, 0, -1),
    };

    public constructor(cubeSize: number) {
        // super();
        this.voxels = new Map<string, {pos: THREE.Vector3, neighbors: number}>();
        this.leafs = new Map<string, THREE.Vector3>();
        this.cubeSize = cubeSize;
    }

    public *getVoxels(): Generator<THREE.Vector3> {
        for (const voxel of this.voxels) {
            yield voxel[1].pos;
        }
    }

    public addVoxel(pos: THREE.Vector3) {
        const strPos = vector3DAsString(pos);
        if (!this.voxels.has(strPos))
        {
            const neighbors = this.countNeighbors(pos);
            this.voxels.set(strPos, {pos: pos.clone(), neighbors});
            this.updateNeighbors(pos, +1);
        }
    }

    public removeVoxel(pos: THREE.Vector3) {
        const strPos = vector3DAsString(pos)
        if (this.voxels.has(strPos))
        {
            this.voxels.delete(strPos);
            this.updateNeighbors(pos, -1);
        }
    }

    /**
     * Update neighbour count of item at pos.
     * @param pos
     * @param change must be +1 or -1
     */
    private updateNeighbors(pos: THREE.Vector3, change: number) {

        let neighbors = 0;
        for (const moveName in VoxelGeometry.moves3D) {
            const move = VoxelGeometry.moves3D[moveName];
            const neighborPoint = new THREE.Vector3(pos.x + move.x, pos.y + move.y, pos.z + move.z);
            const neighbor = this.voxels.get(vector3DAsString(neighborPoint));
            if (neighbor) {
                neighbor.neighbors += change;
                if (neighbor.neighbors == 6) {
                    this.leafs.delete(vector3DAsString(neighborPoint));
                }
                else if (neighbor.neighbors < 6) {
                    this.leafs.set(vector3DAsString(neighborPoint), neighborPoint.clone());
                }
                neighbors++;
            }
        }

        if (neighbors == 6) {
            this.leafs.delete(vector3DAsString(pos));
        }
        else if (neighbors < 6) {
            this.leafs.set(vector3DAsString(pos), pos.clone());
        }
    }

    private countNeighbors(pos: THREE.Vector3) {
        let neighbors = 0;
        for (const moveName in VoxelGeometry.moves3D) {
            const move = VoxelGeometry.moves3D[moveName];
            const neighborPoint = new THREE.Vector3(pos.x + move.x, pos.y + move.y, pos.z + move.z);
            if (this.voxels.has(vector3DAsString(neighborPoint))) {
                neighbors++;
            }
        }

        return neighbors;
    }

    /**
     * Builds a geometry from all points
     * highly inspired from https://github.com/mrdoob/three.js/blob/master/src/geometries/BoxGeometry.js
     * @returns geometry
     */
    public getGeometry(color: THREE.Color): THREE.BufferGeometry {

        const geometry = new THREE.BufferGeometry();
        const buffers: GeometryBuffers = {
            indices: [],
            vertices: [],
            normals: [],
            uvs: [],
            numberOfVertices: 0,
            groupStart: 0
        };

        // constants
        
        const depth = this.cubeSize;
        const height = this.cubeSize;
        const width = this.cubeSize;
        const depthSegments = 1;
        const widthSegments = 1;
        const heightSegments = 1;

        if (!this.verticiesCount)
            this.verticiesCount = 0;

        for (const [_, pos] of this.leafs) {
        // for (const [_, {pos}] of this.voxels) {
            for (const moveName in VoxelGeometry.moves3D) {
                const move = VoxelGeometry.moves3D[moveName];
                const neighborPoint = pos.clone().add(move);

                if (!this.voxels.has(vector3DAsString(neighborPoint))) {

                    // all faces are oriented towards the outside
            
                    switch (moveName) {
                        case "px":
                            this.buildPlane(geometry, buffers, {
                                u: "z", v: "y", w: "x", uDirection: -1, vDirection: -1,
                                width: depth, height, depth: width,
                                offsetU: this.cubeSize * pos.z, offsetV: this.cubeSize * pos.y, offsetW: this.cubeSize * pos.x,
                                gridX: depthSegments, gridY: heightSegments, materialIndex: 0
                            });
                            break;
                        case "nx":
                            this.buildPlane(geometry, buffers, {
                                u: "z", v: "y", w: "x", uDirection: 1, vDirection: -1,
                                width: depth, height, depth: -width,
                                offsetU: this.cubeSize * pos.z, offsetV: this.cubeSize * pos.y, offsetW: this.cubeSize * pos.x,
                                gridX: depthSegments, gridY: heightSegments, materialIndex: 1
                            });
                            break;
                        case "py":
                            this.buildPlane(geometry, buffers, {
                                u: "x", v: "z", w: "y", uDirection: 1, vDirection: 1,
                                width, height: depth, depth: height,
                                offsetU: this.cubeSize * pos.x, offsetV: this.cubeSize * pos.z, offsetW: this.cubeSize * pos.y,
                                gridX: widthSegments, gridY: depthSegments, materialIndex: 2
                            });
                            break;
                        case "ny":
                            this.buildPlane(geometry, buffers, {
                                u: "x", v: "z", w: "y", uDirection: 1, vDirection: -1,
                                width, height: depth, depth: -height,
                                offsetU: this.cubeSize * pos.x, offsetV: this.cubeSize * pos.z, offsetW: this.cubeSize * pos.y,
                                gridX: widthSegments, gridY: depthSegments, materialIndex: 3
                            });
                            break;
                        case "pz":
                            this.buildPlane(geometry, buffers, {
                                u: "x", v: "y", w: "z", uDirection: 1, vDirection: -1,
                                width, height, depth,
                                offsetU: this.cubeSize * pos.x, offsetV: this.cubeSize * pos.y, offsetW: this.cubeSize * pos.z,
                                gridX: widthSegments, gridY: heightSegments, materialIndex: 4
                            });
                            break;
                        case "nz":
                            this.buildPlane(geometry, buffers, {
                                u: "x", v: "y", w: "z", uDirection: -1, vDirection: -1,
                                width, height, depth: -depth,
                                offsetU: this.cubeSize * pos.x, offsetV: this.cubeSize * pos.y, offsetW: this.cubeSize * pos.z,
                                gridX: widthSegments, gridY: heightSegments, materialIndex: 5
                            });
                            break;
                    }
                }
            }
        }

        // DEBUG: set to true for testing
        // if (false) {
            
        //     // Define vertices of the triangle
        //     vertices = [
        //         new THREE.Vector3(0, 1, 0), // Top vertex
        //         new THREE.Vector3(-1, -1, 0), // Bottom-left vertex
        //         new THREE.Vector3(1, -1, 0), // Bottom-right vertex
        //     ];
            
        //     // Define UV coordinates for the vertices
        //     uvs = [
        //         new THREE.Vector2(0.5, 1), // Top vertex
        //         new THREE.Vector2(0, 0),   // Bottom-left vertex
        //         new THREE.Vector2(1, 0),   // Bottom-right vertex
        //     ];
        // }

		// build geometry

		geometry.setIndex( buffers.indices );
		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( buffers.vertices, 3 ) );
		geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( buffers.normals, 3 ) );
		geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( buffers.uvs, 2 ) );

        geometry.computeBoundingBox();
/* 
        // set colors
        const position = geometry.getAttribute("position");
        const colorsBox = [];
        for ( let i = 0, l = position.count; i < l; i ++ ) {

            // color.setHSL( Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace );
            colorsBox.push( color.r, color.g, color.b );

        }
        geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colorsBox, 3 ) );
 */
        return geometry;
    }

    /** Appends one oriented voxel face to the shared buffers, keeping winding and normals together. */
    private buildPlane(
        geometry: THREE.BufferGeometry,
        buffers: GeometryBuffers,
        plane: PlaneDefinition,
    ): void {
        const segmentWidth = plane.width / plane.gridX;
        const segmentHeight = plane.height / plane.gridY;
        const widthHalf = plane.width / 2;
        const heightHalf = plane.height / 2;
        const depthHalf = plane.depth / 2;
        const gridX1 = plane.gridX + 1;
        const gridY1 = plane.gridY + 1;
        let vertexCounter = 0;
        let groupCount = 0;
        const vector = new THREE.Vector3();

        for (let iy = 0; iy < gridY1; iy++) {
            const y = iy * segmentHeight - heightHalf;
            for (let ix = 0; ix < gridX1; ix++) {
                const x = ix * segmentWidth - widthHalf;

                vector[plane.u] = x * plane.uDirection + plane.offsetU;
                vector[plane.v] = y * plane.vDirection + plane.offsetV;
                vector[plane.w] = depthHalf + plane.offsetW;
                buffers.vertices.push(vector.x, vector.y, vector.z);

                vector[plane.u] = 0;
                vector[plane.v] = 0;
                vector[plane.w] = plane.depth > 0 ? 1 : -1;
                buffers.normals.push(vector.x, vector.y, vector.z);

                buffers.uvs.push(ix / plane.gridX, 1 - (iy / plane.gridY));
                vertexCounter++;
            }
        }

        for (let iy = 0; iy < plane.gridY; iy++) {
            for (let ix = 0; ix < plane.gridX; ix++) {
                const a = buffers.numberOfVertices + ix + gridX1 * iy;
                const b = buffers.numberOfVertices + ix + gridX1 * (iy + 1);
                const c = buffers.numberOfVertices + (ix + 1) + gridX1 * (iy + 1);
                const d = buffers.numberOfVertices + (ix + 1) + gridX1 * iy;
                buffers.indices.push(a, b, d, b, c, d);
                groupCount += 6;
            }
        }

        geometry.addGroup(buffers.groupStart, groupCount, plane.materialIndex);
        buffers.groupStart += groupCount;
        buffers.numberOfVertices += vertexCounter;
    }
}
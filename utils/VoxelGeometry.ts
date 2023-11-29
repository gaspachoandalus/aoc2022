import * as THREE from 'three';
import { vector3DAsString } from "./vector.js";

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

        let geometry = new THREE.BufferGeometry();
        const scope = geometry;

        // buffers

		const indices = [];
		const vertices = [];
		const normals = [];
		const uvs = [];

        // helper variables

		let numberOfVertices = 0;
		let groupStart = 0;

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
                            buildPlane('z', 'y', 'x', - 1, - 1, depth, height, width, this.cubeSize * pos.z, this.cubeSize * pos.y, this.cubeSize * pos.x, depthSegments, heightSegments, 0); // px
                            break;
                        case "nx":
                            buildPlane('z', 'y', 'x', 1, - 1, depth, height, - width, this.cubeSize * pos.z, this.cubeSize * pos.y, this.cubeSize * pos.x, depthSegments, heightSegments, 1); // nx
                            break;
                        case "py":
                            buildPlane('x', 'z', 'y', 1, 1, width, depth, height, this.cubeSize * pos.x, this.cubeSize * pos.z, this.cubeSize * pos.y, widthSegments, depthSegments, 2); // py
                            break;
                        case "ny":
                            buildPlane('x', 'z', 'y', 1, - 1, width, depth, - height, this.cubeSize * pos.x, this.cubeSize * pos.z, this.cubeSize * pos.y, widthSegments, depthSegments, 3); // ny
                            break;
                        case "pz":
                            buildPlane('x', 'y', 'z', 1, - 1, width, height, depth, this.cubeSize * pos.x, this.cubeSize * pos.y, this.cubeSize * pos.z, widthSegments, heightSegments, 4); // pz
                            break;
                        case "nz":
                            buildPlane('x', 'y', 'z', - 1, - 1, width, height, - depth, this.cubeSize * pos.x, this.cubeSize * pos.y, this.cubeSize * pos.z, widthSegments, heightSegments, 5); // nz
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

		geometry.setIndex( indices );
		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
		geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
		geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

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

        function buildPlane( u, v, w, udir, vdir, width, height, depth, offsetY, offsetV, offsetW, gridX, gridY, materialIndex ) {

			const segmentWidth = width / gridX;
			const segmentHeight = height / gridY;

			const widthHalf = width / 2;
			const heightHalf = height / 2;
			const depthHalf = depth / 2;

			const gridX1 = gridX + 1;
			const gridY1 = gridY + 1;

			let vertexCounter = 0;
			let groupCount = 0;

			const vector = new THREE.Vector3();

			// generate vertices, normals and uvs

			for ( let iy = 0; iy < gridY1; iy ++ ) {

				const y = iy * segmentHeight - heightHalf;

				for ( let ix = 0; ix < gridX1; ix ++ ) {

					const x = ix * segmentWidth - widthHalf;

					// set values to correct vector component

					vector[ u ] = x * udir + offsetY;
					vector[ v ] = y * vdir + offsetV;
					vector[ w ] = depthHalf + offsetW;

					// now apply vector to vertex buffer

					vertices.push( vector.x, vector.y, vector.z );

					// set values to correct vector component

					vector[ u ] = 0;
					vector[ v ] = 0;
					vector[ w ] = depth > 0 ? 1 : - 1;

					// now apply vector to normal buffer

					normals.push( vector.x, vector.y, vector.z );

					// uvs

					uvs.push( ix / gridX );
					uvs.push( 1 - ( iy / gridY ) );

					// counters

					vertexCounter += 1;

				}

			}

			// indices

			// 1. you need three indices to draw a single face
			// 2. a single segment consists of two faces
			// 3. so we need to generate six (2*3) indices per segment

			for ( let iy = 0; iy < gridY; iy ++ ) {

				for ( let ix = 0; ix < gridX; ix ++ ) {

					const a = numberOfVertices + ix + gridX1 * iy;
					const b = numberOfVertices + ix + gridX1 * ( iy + 1 );
					const c = numberOfVertices + ( ix + 1 ) + gridX1 * ( iy + 1 );
					const d = numberOfVertices + ( ix + 1 ) + gridX1 * iy;

					// faces

					indices.push( a, b, d );
					indices.push( b, c, d );

					// increase counter

					groupCount += 6;

				}

			}

			// add a group to the geometry. this will ensure multi material support

			scope.addGroup( groupStart, groupCount, materialIndex );

			// calculate new start value for groups

			groupStart += groupCount;

			// update total number of vertices

			numberOfVertices += vertexCounter;

		}
    }
}
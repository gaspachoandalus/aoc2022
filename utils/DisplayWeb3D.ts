import * as dat from "lil-gui";
import * as THREE from 'three';
import { Vector3 } from 'three';
import { ArcballControls } from 'three/examples/jsm/controls/ArcballControls.js';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js';
import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { VertexNormalsHelper } from 'three/examples/jsm/helpers/VertexNormalsHelper.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { CSG, Vector } from './CSGMesh.js'; // https://sbcode.net/threejs/csg/
import { Pause } from './Pause.js';
import { VoxelGeometry } from "./VoxelGeometry.js";
import { Checkpoint } from "./Checkpoint.js";
import { Display3D, Style, Colors } from "./Display3D.js";
import { Log } from "./Log.js";
import { getThrottleLimit, MAX_PREVIEW_ITERATIONS_PER_SECOND } from "./DisplayOptions.js";
import type { DisplayOptions } from "./DisplayOptions.js";
import { createDisplayControlsHelp } from "./DisplayControlsHelp.js";

function isWireframeMaterial(material: THREE.Material): material is THREE.Material & { wireframe: boolean } {
    return "wireframe" in material && typeof material.wireframe === "boolean";
}

/**
 * Way to merge cubes from the same group
 */
enum MergeMode {
    none = 1,           // no merge, each cube is 
    voxelGeometry = 2,  // internal project voxel geometry
    csg = 3,            // cubes from the same mesh are merged using CSG library
    instanced = 4,      // threejs instanced
};


/**
 * Each group is a mesh composed of voxels
 */
type Group = {
    color: THREE.Color;
    material: THREE.Material;
    mergeMode: MergeMode;
    buffer?: ArrayBuffer;
    verticiesCount?: number;
    csg?: CSG;
    mesh?: THREE.Mesh<THREE.BufferGeometry>;
    group?: THREE.Group;
    vertexNormalsHelper?: VertexNormalsHelper;
    items?: Map<string, THREE.Mesh>;
    mixer?: THREE.AnimationMixer; // animation mixer for this group / this mesh
    guiFolder?: dat.GUI; // folder entry in GUI
    name?: string; // group name
};

type BufferedBlock = { x: number; y: number; z: number };

const VOXEL_FACE_TEXTURE_SIZE = 128;
const DEFAULT_CAMERA_FOV = 50;
const MIN_CAMERA_FOV = 25;
const MAX_CAMERA_FOV = 100;
const CAMERA_FOV_WHEEL_SENSITIVITY = 0.05;
const MAX_CAMERA_FOV_CHANGE_PER_EVENT = 5;
let voxelFaceTexture: THREE.DataTexture | undefined;

function getVoxelFaceTexture(): THREE.DataTexture {
    if (voxelFaceTexture) {
        return voxelFaceTexture;
    }

    const size = VOXEL_FACE_TEXTURE_SIZE;
    const pixels = new Uint8Array(size * size * 4);
    const edgeWidth = size * 0.03;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const edgeDistance = Math.min(x, y, size - 1 - x, size - 1 - y);
            const edge = Math.max(0, 1 - edgeDistance / edgeWidth);
            const softEdge = edge * edge * (3 - 2 * edge);
            const channel = Math.round(255 * (1 - 0.065 * softEdge));
            const pixelIndex = (y * size + x) * 4;

            pixels[pixelIndex] = channel;
            pixels[pixelIndex + 1] = channel;
            pixels[pixelIndex + 2] = channel;
            pixels[pixelIndex + 3] = 255;
        }
    }

    voxelFaceTexture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    voxelFaceTexture.colorSpace = THREE.SRGBColorSpace;
    voxelFaceTexture.magFilter = THREE.LinearFilter;
    voxelFaceTexture.minFilter = THREE.LinearMipmapLinearFilter;
    voxelFaceTexture.generateMipmaps = true;
    voxelFaceTexture.needsUpdate = true;

    return voxelFaceTexture;
}

export class WebDisplay3D implements Display3D
{
    // https://threejs.org/docs
    // https://discoverthreejs.com/tips-and-tricks/
    
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;

    private studioGrid?: THREE.GridHelper;
    private studioGridSize = 0;
    private studioGridSpacing = 0;
    private studioAnchor?: THREE.Vector3;
    private studioGridY = 0;
    
    spotLights: Array<{
        color: THREE.ColorRepresentation,
        intensityScale?: number,
        rotationY: number,
        rotationZ: number,
        spotLight?: THREE.SpotLight,
        spotLightHelper?: THREE.SpotLightHelper
    }> = [];
    
    blocksBuffers: Record<number /* group */, Array<{x: number, y: number, z: number}>>; // buffer map by group
    
    boundaries: {min: Vector3, max: Vector3};

    groups: Array<Group> = [];
    
    groupsFolder?: dat.GUI;
    
    orbitControls: OrbitControls;
    flyControls: FlyControls;
    firstPersonControls: FirstPersonControls;
    arcballControls: ArcballControls;
    pointerLockControls: PointerLockControls;
    stats1?: Stats.Panel;
    
    axes: THREE.AxesHelper;
    ambientLight: THREE.AmbientLight;
    
    readonly raycaster = new THREE.Raycaster();
    readonly pointer = new THREE.Vector2();

    altKey = false;
    lastUserInteraction = 0;
    
    cameraTarget: THREE.Vector3;
    private readonly normalFollowTarget = new THREE.Vector3();
    private readonly normalFollowPosition = new THREE.Vector3();
    private readonly normalFollowCurrentRotation = new THREE.Quaternion();
    private readonly normalFollowTargetRotation = new THREE.Quaternion();
    private normalFollowTargetInitialized = false;
    private readonly followViewportMargin = 0.3;
    private readonly projectedFollowTarget = new THREE.Vector3();
    private previewCameraInitialized = false;

    readonly cameraPosition = new THREE.Vector3();
    readonly cubeSize = 50;
    private readonly normalFollowDistance = 36 * this.cubeSize;

    readonly viewDistance = 1_000 * this.cubeSize;
    readonly lightDistance = 60 * this.cubeSize;
    readonly spotLightAngle = Math.PI / 3; // Math.PI / 6
    readonly follow_delay_after_user_move_ms = 5_000;
    private readonly options: DisplayOptions;
    
    readonly simulation = {
        maxIterationsPerSecond: 200,
        stats: false,
        debugAxes: true,
        debugLights: false,
        debugNormals: false,
        spotLightIntensity: 15,
        wireframe: false,
        get pause() {
            return Pause.paused();
        },
        set pause(value: boolean) {
            Pause.toggle();
        }
    };
    private setDebugLights(enabled: boolean) {
        if (enabled) {
    
            // spotlight helpers
    
            for (const spotLight of this.spotLights) {
                if (!spotLight.spotLightHelper) {
                    spotLight.spotLightHelper = new THREE.SpotLightHelper( spotLight.spotLight );
                    this.scene.add( spotLight.spotLightHelper );
                }
                spotLight.spotLightHelper.visible = true;
            }
        }
        else {
    
            for (const spotLight of this.spotLights) {
                spotLight.spotLightHelper.visible = false;
            }
    
        }
    }
    
    private setDebugAxes(enabled: boolean) {
        if (enabled) {
    
             // axes 
    
            if (!this.axes) {
                this.axes = new THREE.AxesHelper(2000);
                this.scene.add(this.axes);
            }
            this.axes.visible = true;
        }
        else {
    
            if (this.axes) {
                this.axes.visible = false;
            }
    
        }
    }
    
    public static create(): Display3D {
        return new WebDisplay3D();
    }

    public constructor(options: DisplayOptions = {}) {
        this.options = options;
    }

    public init(iterationsPerSecond?: number) {
    
        console.log("init");
    
        // simulation speed
    
        const requestedRate = iterationsPerSecond ?? 100;
        this.simulation.maxIterationsPerSecond = this.options.preview
            ? this.options.previewIterationsPerSecond ?? requestedRate
            : requestedRate;

        if (this.scene) {
            return;
        }
    
        // camera
    
        this.camera = new THREE.PerspectiveCamera( DEFAULT_CAMERA_FOV, window.innerWidth / window.innerHeight, 1, this.viewDistance );
        this.camera.position.setFromCylindrical(new THREE.Cylindrical(this.lightDistance, 0, this.lightDistance));
    
        // scene
    
        this.scene = new THREE.Scene();
        this.scene.matrixAutoUpdate = false;
    
        // ambient light
    
        this.ambientLight = new THREE.AmbientLight( 0xffffff, .18 );
        this.scene.add( this.ambientLight );

        const keyLight = new THREE.DirectionalLight(0xffffff, .6);
        keyLight.position.set(1, 2, 1.2);
        this.scene.add(keyLight, keyLight.target);
    
        if (true) {
    
            const hemisphereLight = new THREE.HemisphereLight( 0xeaf2ff, 0x34414d, .65 );
            this.scene.add( hemisphereLight );
    
        }
    
        this.createSimulationControls();
    
        // debug axes
    
        this.setDebugAxes(this.simulation.debugAxes);
    
        this.createStudioGrid();
    }

    /** Creates the full-run controls while keeping preview rendering free of debug UI. */
    private createSimulationControls(): void {
        if (this.options.preview) {
            return;
        }

        this.stats1 = new (Stats as any)();
        this.stats1.dom.id = "stats";
        this.stats1.dom.classList.add("hidden");
        const overlays = document.getElementById("simulation-overlays");
        if (!overlays) {
            throw new Error("Missing simulation overlays element.");
        }
        overlays.appendChild(this.stats1.dom);

        const gui = new dat.GUI();
        const simulationFolder = gui.addFolder('Simulation');
        simulationFolder.add(this.simulation, "pause").name("paused").listen().onChange(value => {
            value ? Pause.pause() : Pause.continue();
        });
        simulationFolder.add(this.simulation, "stats").name("show FPS").listen().onChange(value => {
            this.stats1.dom.classList.toggle("hidden", !value);
        });
        simulationFolder.add(this.simulation, 'maxIterationsPerSecond', 0, MAX_PREVIEW_ITERATIONS_PER_SECOND, 1).name("max iterations/s");
        simulationFolder.add(this.camera, 'fov', MIN_CAMERA_FOV, MAX_CAMERA_FOV, 1)
            .name("FOV (°)")
            .decimals(1)
            .listen()
            .onChange(() => this.camera.updateProjectionMatrix());
        simulationFolder.add(this.scene.children, 'length').name("Object count").disable().listen();
        simulationFolder.add(Checkpoint, 'countPerSecond').name("iterations/s").decimals(2).disable().listen();
        simulationFolder.open();

        const ambientLightFolder = gui.addFolder('Light');
        ambientLightFolder.add(this.ambientLight, 'intensity', 0, 1, 0.01).name("Ambient");
        ambientLightFolder.add(this.simulation, 'spotLightIntensity', 0, 100, 1).name("Spotlights").onChange(value => {
            for (const spotlight of this.spotLights) {
                spotlight.spotLight.intensity = value / 10 * (spotlight.intensityScale ?? 1);
            }
        });

        this.groupsFolder = gui.addFolder('Groups');

        const debugFolder = gui.addFolder('Debug');
        debugFolder.add(this.simulation, 'debugLights').name("show spotlights").onChange(value => {
            this.setDebugLights(value);
        });
        debugFolder.add(this.simulation, 'debugAxes').name("show axes").onChange(value => {
            this.setDebugAxes(value);
        });
        debugFolder.add(this.simulation, 'debugNormals').name("show normals").onChange(value => {
            this.simulation.debugNormals = value;
        });

        const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, wireframe: true });
        debugFolder.add(this.simulation, 'wireframe').onChange(value => {
            this.scene.overrideMaterial = value ? wireframeMaterial : null;
        });
    }

    private createStudioGrid(): void {
        this.studioGridSize = this.normalFollowDistance * 4;
        this.studioGridY = -this.cubeSize * 0.42;

        const divisions = Math.round(this.studioGridSize / (this.cubeSize * 2));
        this.studioGridSpacing = this.studioGridSize / divisions;
        this.studioGrid = this.createStudioGridGeometry(this.studioGridSize);
        this.studioGrid.position.y = this.studioGridY;
        this.scene.add(this.studioGrid);

        this.initializeStudioGridAnchor();
    }

    private createStudioGridGeometry(size: number): THREE.GridHelper {
        const divisions = Math.round(size / this.studioGridSpacing);
        const grid = new THREE.GridHelper(size, divisions, 0x50696e, 0x50696e);
        grid.material.transparent = true;
        grid.material.opacity = 1;
        grid.material.depthWrite = false;
        grid.renderOrder = 2;
        grid.frustumCulled = false;
        return grid;
    }

    private initializeStudioGridAnchor(): void {
        if (!this.studioGrid || this.studioAnchor) {
            return;
        }

        const bounds = new THREE.Box3();
        for (const group of this.groups) {
            const object = group?.group ?? group?.mesh;
            if (object) {
                bounds.expandByObject(object);
            }
        }

        if (bounds.isEmpty()) {
            return;
        }

        const contentCenter = bounds.getCenter(new THREE.Vector3());
        this.studioAnchor = new THREE.Vector3(contentCenter.x, 0, contentCenter.z);
        this.studioGridY = bounds.min.y - this.cubeSize * 0.42;
        this.positionStudioGrid(this.studioAnchor);
        this.expandStudioGridToContain(bounds);
    }

    private positionStudioGrid(anchor: THREE.Vector3): void {
        if (!this.studioGrid || this.studioGridSpacing === 0) {
            return;
        }

        const spacing = this.studioGridSpacing;
        this.studioGrid.position.set(
            Math.round(anchor.x / spacing) * spacing,
            this.studioGridY,
            Math.round(anchor.z / spacing) * spacing
        );
    }

    private expandStudioGridToContain(bounds: THREE.Box3): void {
        if (!this.studioGrid) {
            return;
        }

        const center = this.studioGrid.position;
        const halfExtent = Math.max(
            Math.abs(bounds.min.x - center.x),
            Math.abs(bounds.max.x - center.x),
            Math.abs(bounds.min.z - center.z),
            Math.abs(bounds.max.z - center.z)
        );
        this.expandStudioGridToHalfExtent(halfExtent);
    }

    private expandStudioGridToIncludeBlock(x: number, z: number): void {
        if (!this.studioGrid || !this.studioAnchor) {
            return;
        }

        const center = this.studioGrid.position;
        const minX = x * this.cubeSize;
        const maxX = minX + this.cubeSize;
        const minZ = z * this.cubeSize;
        const maxZ = minZ + this.cubeSize;
        const halfExtent = Math.max(
            Math.abs(minX - center.x),
            Math.abs(maxX - center.x),
            Math.abs(minZ - center.z),
            Math.abs(maxZ - center.z)
        );
        this.expandStudioGridToHalfExtent(halfExtent);
    }

    private expandStudioGridToHalfExtent(halfExtent: number): void {
        if (!this.studioGrid || this.studioGridSpacing === 0) {
            return;
        }

        const spacing = this.studioGridSpacing;
        const requiredSize = Math.ceil((2 * (halfExtent + spacing)) / spacing) * spacing;
        if (requiredSize <= this.studioGridSize) {
            return;
        }

        const expandedSize = Math.ceil(Math.max(requiredSize, this.studioGridSize * 1.25) / spacing) * spacing;
        const grid = this.studioGrid;
        const expandedGrid = this.createStudioGridGeometry(expandedSize);
        const previousGeometry = grid.geometry;
        const previousMaterial = grid.material;

        grid.geometry = expandedGrid.geometry;
        grid.material = expandedGrid.material;
        previousGeometry.dispose();
        if (Array.isArray(previousMaterial)) {
            previousMaterial.forEach(material => material.dispose());
        } else {
            previousMaterial.dispose();
        }
        this.studioGridSize = expandedSize;
    }
    
    private createMaterial(style: Style) {
    
        const lambertMaterialParameters: THREE.MeshLambertMaterialParameters = {
            color: style.color ?? Colors.green,
            opacity: style.opacity ?? .7,
            transparent: style.transparent ?? false,
            emissive: style.color ?? Colors.green,
            emissiveIntensity: (style.color == Colors.red ? .5 : .3),
            depthWrite: true
        };
        const toonMaterialParameters: THREE.MeshToonMaterialParameters = {
            color: style.color ?? Colors.green,
            opacity: style.opacity ?? .7,
            transparent: style.transparent ?? false,
            emissive: style.color ?? Colors.green,
            emissiveIntensity: (style.color == Colors.red ? .5 : .3),
            depthWrite: true
        };
        const normalMaterialParameters: THREE.MeshNormalMaterialParameters = {
            opacity: style.opacity ?? .7,
            transparent: style.transparent ?? false
        };
        const phongMaterialParameters: THREE.MeshPhongMaterialParameters = {
            color: style.color ?? Colors.green,
            opacity: style.opacity ?? .7,
            transparent: style.transparent ?? false,
            emissive: style.color ?? Colors.green,
            emissiveIntensity: (style.color == Colors.red ? .5 : .3),
            shininess: 200,
            depthWrite: true
        };
        const standardMaterialParameters: THREE.MeshStandardMaterialParameters = {
            color: style.color ?? Colors.green,
            opacity: style.opacity ?? .7,
            transparent: style.transparent ?? false,
            roughness: .72,
            metalness: .05,
            map: getVoxelFaceTexture(),
            side: THREE.DoubleSide
        };
        const shaderMaterial: THREE.ShaderMaterialParameters = {
            uniforms: {
              time: { value: 1.0 },
              resolution: { value: new THREE.Vector2() }
            },
            vertexShader: `
              uniform float time;
              uniform vec2 resolution;
              void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec4 pos = vec4(uv * 2.0 - 1.0, sin(time + uv.x * 10.0), 1.0);
                gl_Position = pos;
              }
            `,
            fragmentShader: `
              uniform float time;
              void main() {
                gl_FragColor = vec4(vec3(sin(time)), 1.0);
              }
            `
          };
    
        // return new THREE.MeshPhongMaterial( phongMaterialParameters );
        return new THREE.MeshStandardMaterial( standardMaterialParameters );
        // return new THREE.MeshToonMaterial( toonMaterialParameters );
        // return new THREE.ShaderMaterial( shaderMaterial );
        // return new THREE.MeshPhysicalMaterial( materialParameters );
        // return new THREE.MeshLambertMaterial( materialParameters );
        // return new THREE.MeshNormalMaterial( materialParameters );
    }
    
    /**
     * defines attributes of a group of voxels
     * @param group group id
     * @param style characteristics
     */
    public setStyle(group: number, style: Style) {
    
        if (!this.groups[group]) {
    
            this.groups[group] = {
                color: new THREE.Color(style.color),
                material: this.createMaterial(style),
                name: style.name,
                mergeMode: MergeMode.voxelGeometry
            }
    
        }
        
        else {
    
            if (style.name != null) {
                this.groups[group].name = style.name;
            }
            if (style.color != null && (this.groups[group].material as any).color) {
                (this.groups[group].material as any).color.set(style.color);
            }
            if (style.transparent != null) {
                this.groups[group].material.transparent = style.transparent;
            }
            if (style.opacity != null) {
                this.groups[group].material.opacity = style.opacity;
            }
    
        }
    
        if (this.groups[group].mesh) {
            
            this.groups[group].material.needsUpdate = true;
        }
    }
    
    public start(): void {
    
        console.log("start");
    
        // spot lights
    
        this.spotLights = [
            { color: 0x770000, intensityScale: .25, rotationY: 0, rotationZ: 0 }, // +X
            { color: 0x770000, intensityScale: .25, rotationY: Math.PI, rotationZ: 0 }, // -X
            { color: 0x007700, intensityScale: .25, rotationY: Math.PI / 2, rotationZ: Math.PI / 2 }, // +Y
            { color: 0x007700, intensityScale: .25, rotationY: Math.PI / 2, rotationZ: 3 * Math.PI / 2 }, // -Y
            { color: 0x000077, intensityScale: .25, rotationY: Math.PI / 2, rotationZ: Math.PI }, // +Z
            { color: 0x000077, intensityScale: .25, rotationY: Math.PI / 2, rotationZ: 0 } // -Z
        ];
    
        // instanciate spotlights
    
        for (const spotLight of this.spotLights) {
            // The spots orbit far from the scene, so disable distance cutoff and decay.
            spotLight.spotLight = new THREE.SpotLight(spotLight.color, this.simulation.spotLightIntensity / 10 * (spotLight.intensityScale ?? 1), 0, this.spotLightAngle, .5, 0 );

    
            this.positionAndDirectLight( spotLight.spotLight, spotLight.rotationY, spotLight.rotationZ)
            this.scene.add( spotLight.spotLight );
            this.scene.add( spotLight.spotLight.target );
        }
    
        // renderer
    
        this.renderer = new THREE.WebGLRenderer( { antialias: false, alpha: true } );
        this.renderer.autoClear = false;
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.domElement.id = "canvas";
        this.renderer.domElement.dataset.aocRenderer = "true";
        this.renderer.domElement.classList.add("display-canvas--3d");
        document.body.appendChild( this.renderer.domElement );
        if (!this.options.preview) {
            const controlsHelp = createDisplayControlsHelp("3d", [
                {
                    label: "Mouse",
                    description: "Click the scene to capture the pointer; move to look. Esc releases."
                },
                {
                    label: "Wheel",
                    description: "Scroll down (wheel back) to widen the field of view; scroll up (wheel forward) to narrow it."
                },
                {
                    label: "W/A/S/D",
                    description: "While captured, move forward/back and left/right; arrows also work.",
                    key: true
                },
                { label: "R / F", description: "Move up/down while captured.", key: true },
                {
                    label: "Speed",
                    description: "Tap and release Ctrl to toggle quarter speed; tap again for normal. Hold Shift to double speed; it temporarily overrides slow mode."
                },
                { label: "Space", description: "Pause or resume.", key: true },
                { label: "L", description: "Advance one step.", key: true },
                {
                    label: "Touch",
                    description: "No touch gestures; use mouse and keyboard."
                }
            ]);
            const summary = controlsHelp.querySelector("summary");
            if (!summary) {
                throw new Error("3D controls summary was not created");
            }

            this.movementSpeedStatus = document.createElement("span");
            this.movementSpeedStatus.setAttribute("aria-live", "polite");
            summary.append(" · ", this.movementSpeedStatus);
            this.updateMovementSpeedStatus();
            document.body.appendChild(controlsHelp);
        }
    
        // orbit control
    
        const controlsType: number = 3;
        if (controlsType === 0) {
            this.orbitControls = new OrbitControls( this.camera, this.renderer.domElement );
            this.orbitControls.addEventListener( "start", () => {
                this.lastUserInteraction = performance.now();
                this.cameraTarget = null;
            });
        }
        else if (controlsType === 1) {
    
            this.firstPersonControls = new FirstPersonControls( this.camera, this.renderer.domElement );
            // this.firstPersonControls.activeLook = false;
            // this.firstPersonControls.lookSpeed = 0.8;
            this.firstPersonControls.movementSpeed = 500;
            // (this.firstPersonControls as any).noFly = false;
            // this.firstPersonControls.lookVertical = true;
            // this.firstPersonControls.constrainVertical = true;
            // this.firstPersonControls.verticalMin = 1.0;
            // this.firstPersonControls.verticalMax = 2.0;
        }
        else if (controlsType === 2) {
            
            this.flyControls = new FlyControls( this.camera, this.renderer.domElement );
            this.flyControls.dragToLook = true;
            this.flyControls.autoForward = false;
            this.flyControls.movementSpeed = 500;
            this.flyControls.rollSpeed = Math.PI / 6;
            // this.flyControls.addEventListener( "start", () => {
            //     this.lastUserInteraction = performance.now();
            //     this.cameraTarget = null;
            // });
        }
        else if (controlsType === 3) {
    
            this.pointerLockControls = new PointerLockControls(this.camera, this.renderer.domElement);
            this.scene.add( this.pointerLockControls.getObject() );
    
        }
        else
        {
            this.arcballControls = new ArcballControls( this.camera, this.renderer.domElement, this.scene );
            this.arcballControls.enableGrid = true;
            this.arcballControls.activateGizmos(false);
            this.arcballControls.setGizmosVisible(true);
        }
    
        // events
    
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
        window.addEventListener( 'keydown', this.onKeyDown.bind(this) );
        window.addEventListener( 'keyup', this.onKeyUp.bind(this) );
        window.addEventListener( 'blur', this.onWindowBlur.bind(this) );
        window.addEventListener( 'wheel', this.onWheel.bind(this), { passive: false } );
        window.addEventListener( 'pointermove', this.onPointerMove.bind(this) );
        window.addEventListener( 'pointerdown', this.onPointerDown.bind(this) );
        
        this.renderer.setAnimationLoop( this.animate.bind(this) );
    }
    
    /** Applies queued voxels and rebuilds each group's geometry once per render flush. */
    private flushBlocksBuffer(): void {
        if (!this.blocksBuffers) {
            return;
        }

        for (const [groupId, blocks] of Object.entries(this.blocksBuffers)) {
            const group = this.groups[groupId];
            if (!group) {
                throw new Error(`undefined group ${groupId}`);
            }

            for (const block of blocks) {
                this.addBufferedBlock(groupId, group, block);
            }

            if (group.mergeMode === MergeMode.voxelGeometry) {
                this.refreshVoxelGeometry(group);
            }
        }

        this.blocksBuffers = null;
        this.initializeStudioGridAnchor();
    }

    /** Routes one queued block through the merge strategy selected for its group. */
    private addBufferedBlock(groupId: string, group: Group, block: BufferedBlock): void {
        switch (group.mergeMode) {
            case MergeMode.none:
                this.addUnmergedVoxel(groupId, group, block);
                break;
            case MergeMode.csg:
                this.addCsgVoxel(group, block);
                break;
            case MergeMode.voxelGeometry:
                this.addVoxelGeometry(groupId, group, block);
                break;
            case MergeMode.instanced:
                this.addInstancedVoxel(groupId, group, block);
                break;
        }

        this.createGroupControls(groupId, group);
    }

    /** Creates a cube translated from grid coordinates into the display's world space. */
    private createVoxelBox(block: BufferedBlock): THREE.BoxGeometry {
        const geometry = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);
        geometry.translate(this.cubeSize / 2, this.cubeSize / 2, this.cubeSize / 2);
        geometry.translate(
            block.x * this.cubeSize,
            block.y * this.cubeSize,
            block.z * this.cubeSize,
        );
        return geometry;
    }

    /** Adds a separate mesh per cube inside a shared scene group. */
    private addUnmergedVoxel(groupId: string, group: Group, block: BufferedBlock): void {
        if (!group.group) {
            group.group = new THREE.Group();
            this.scene.add(group.group);
        }

        group.mesh = new THREE.Mesh(this.createVoxelBox(block), group.material);
        group.mesh.userData = { group: groupId };
        group.group.add(group.mesh);
    }

    /** Accumulates a cube into the group's constructive-solid-geometry model. */
    private addCsgVoxel(group: Group, block: BufferedBlock): void {
        const voxelGeometry = this.createVoxelBox(block);
        if (!group.csg && !group.mesh) {
            group.csg = CSG.fromGeometry(voxelGeometry);
        } else {
            if (!group.csg && group.mesh) {
                group.csg = CSG.fromMesh(group.mesh);
            }
            group.csg = group.csg.union(CSG.fromGeometry(voxelGeometry));
        }
    }

    /** Stores a voxel in the project's surface-culling geometry and creates its mesh on demand. */
    private addVoxelGeometry(groupId: string, group: Group, block: BufferedBlock): void {
        if (!group.mesh) {
            const voxelGeometry = new VoxelGeometry(this.cubeSize);
            voxelGeometry.addVoxel(new Vector3(block.x, block.y, block.z));
            group.mesh = new THREE.Mesh(voxelGeometry.getGeometry(null), group.material);
            group.mesh.userData = { group: groupId, voxelGeometry };
            this.scene.add(group.mesh);
            return;
        }

        const voxelGeometry = group.mesh.userData.voxelGeometry as VoxelGeometry;
        voxelGeometry.addVoxel?.(new Vector3(block.x, block.y, block.z));
    }

    /** Adds a cube instance and batches the GPU instance-matrix update. */
    private addInstancedVoxel(groupId: string, group: Group, block: BufferedBlock): void {
        const geometry = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);
        geometry.translate(this.cubeSize / 2, this.cubeSize / 2, this.cubeSize / 2);

        if (!group.mesh) {
            group.mesh = new THREE.InstancedMesh(geometry, group.material, 10000);
            group.mesh.userData = { group: groupId };
            (group.mesh as THREE.InstancedMesh).count = 0;
            this.scene.add(group.mesh);
        }

        const mesh = group.mesh as THREE.InstancedMesh;
        const index = mesh.count;
        mesh.count++;
        mesh.setMatrixAt(
            index,
            new THREE.Matrix4().makeTranslation(
                block.x * this.cubeSize,
                block.y * this.cubeSize,
                block.z * this.cubeSize,
            ),
        );

        if (!mesh.userData.needsUpdate) {
            mesh.userData.needsUpdate = setTimeout(() => {
                (group.mesh as THREE.InstancedMesh).instanceMatrix.needsUpdate = true;
                delete group.mesh.userData.needsUpdate;
            }, 100);
        }
    }

    /** Creates the per-group controls after its first block has established the render object. */
    private createGroupControls(groupId: string, group: Group): void {
        if (group.guiFolder || !this.groupsFolder) {
            return;
        }

        const groupName = group.name ? `${group.name} (${groupId})` : `${groupId}`;
        group.guiFolder = this.groupsFolder.addFolder(`group ${groupName}`);
        group.guiFolder.add(group.group ?? group.mesh.material, "visible");

        if (!group.group) {
            group.guiFolder.add(group.mesh.material, "transparent").onChange(() => {
                if (group.mesh) {
                    (group.mesh.material as THREE.MeshPhongMaterial).needsUpdate = true;
                }
            });
            if ((group.mesh.material as any).color) {
                group.guiFolder.addColor(group.mesh.material, "color");
            }
            group.guiFolder.add(group.mesh.material, "opacity", 0, 1);
        }
    }

    /** Rebuilds the exposed voxel faces and releases the geometry replaced by that rebuild. */
    private refreshVoxelGeometry(group: Group): void {
        const previousGeometry = group.mesh.geometry;
        group.mesh.geometry = (group.mesh.userData.voxelGeometry as VoxelGeometry).getGeometry(group.color);
        previousGeometry.dispose();
    }
    
    public log(text: string) {
    
        Log.log(text);
    
    }
    
    public addBlock(x: number, y: number, z: number, group: number) {
    
        this.blocksBuffers ??= {};
        this.blocksBuffers[group] ??= [];
        this.blocksBuffers[group].push({x, y, z});
        this.expandStudioGridToIncludeBlock(x, z);
    
        return this;
    }
    
    public fadeOut(group: number, opacity: number) {
    
        if (this.groups[group]?.mesh) {
    
            (this.groups[group].mesh.material as THREE.MeshPhongMaterial).transparent = true;
            (this.groups[group].mesh.material as THREE.MeshPhongMaterial).needsUpdate = true;
    
            const animationName = `setOpacity ${opacity}`;
            let clip = THREE.AnimationClip.findByName(this.groups[group]?.mesh.animations, animationName);
            if (!clip) {
                const opacityKF = new THREE.NumberKeyframeTrack( '.material.opacity', [ 0, 3 ], [1, opacity], THREE.InterpolateSmooth );
                // const visibleKF = new THREE.BooleanKeyframeTrack('.material.visible', [ 0, 2 ], [ true, false ]);
                clip = new THREE.AnimationClip( animationName, 0, [ opacityKF ] );
                clip.resetDuration();
            }
    
            if (!this.groups[group].mixer) {
    
                this.groups[group].mixer = new THREE.AnimationMixer( this.groups[group].mesh );
    
            }
    
            this.groups[group].mixer.addEventListener("finished", (e) => {
                // debugger;
                // e.action.stop();
                // e.target.
            });
    
            const animationAction = this.groups[group].mixer.clipAction( clip );
            animationAction.clampWhenFinished = true;
            animationAction.setLoop(THREE.LoopOnce, 0);
            animationAction.play();
        }
    
    }
    
    public clear(group: number) {
        
        if (this.blocksBuffers?.[group])
        {
            // clear source pending voxels
            delete this.blocksBuffers[group];
        }
    
        // clear existing mesh
        if (this.groups[group]?.mesh) {
            this.scene.remove( this.groups[group].mesh );
            this.groups[group].mesh = null;
        }
        this.initializeStudioGridAnchor();
    }
    
    public move(sourceGroup: number, targetGroup: number) {
        
        console.log(`merge ${sourceGroup} into ${targetGroup}`);
    
        // copy pending voxels
        if (this.blocksBuffers?.[sourceGroup])
        {
            for (const voxel of this.blocksBuffers[sourceGroup]) {
                this.addBlock(voxel.x, voxel.y, voxel.z, targetGroup);
            }
        }
    
        // copy existing voxels
        if (this.groups[sourceGroup].mesh?.userData?.voxelGeometry && this.groups[targetGroup].mergeMode == MergeMode.voxelGeometry)
        {
            for (const voxel of (this.groups[sourceGroup].mesh?.userData?.voxelGeometry as VoxelGeometry).getVoxels()) {
                this.addBlock(voxel.x, voxel.y, voxel.z, targetGroup);
            }
        }
    
        this.clear(sourceGroup);
    }
    
    public async pause(): Promise<void> {
    
        if (this.options.preview) {
            return await this.checkpoint();
        }

        Pause.pause();
        return await Checkpoint.checkpoint(getThrottleLimit(this.simulation.maxIterationsPerSecond));
    
    }
    
    public async checkpoint(): Promise<void> {
    
        return Checkpoint.checkpoint(getThrottleLimit(this.simulation.maxIterationsPerSecond));
    
    }
    
    moveForward = false;
    moveBackward = false;
    moveUp = false;
    moveDown = false;
    moveLeft = false;
    moveRight = false;
    moveFast = false;
    moveSlowMode = false;
    private movementSpeedStatus: HTMLSpanElement | null = null;
    
    /** Synchronizes the visible speed status with the active movement mode. */
    private updateMovementSpeedStatus(): void {
        if (!this.movementSpeedStatus) {
            return;
        }

        if (this.moveFast) {
            this.movementSpeedStatus.textContent = "Fast speed";
        }
        else if (this.moveSlowMode) {
            this.movementSpeedStatus.textContent = "Slow speed";
        }
        else {
            this.movementSpeedStatus.textContent = "Normal speed";
        }
    }
    
    private onKeyDown (event: KeyboardEvent): any {
        if (event.target instanceof Element && event.target.closest(".display-controls")) {
            return;
        }
    
        this.altKey = event.altKey;

        const moveFast = !!event.shiftKey;
        if (this.moveFast !== moveFast) {
            this.moveFast = moveFast;
            this.updateMovementSpeedStatus();
        }

        if (event.code === "ControlLeft" || event.code === "ControlRight") {
            if (!event.repeat) {
                this.moveSlowMode = !this.moveSlowMode;
                this.updateMovementSpeedStatus();
            }
            return;
        }
    
        switch ( event.code ) {
    
            case "Space":
                Pause.toggle();
                break;
    
            case "KeyL":
                Pause.step();
                break;
    
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = true;
                break;
    
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = true;
                break;
    
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = true;
                break;
    
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = true;
                break;
    
            case 'KeyR':
                this.moveUp = true;
                break;
    
            case 'KeyF':
                this.moveDown = true;
                break;
    
        }
    
    }
    
    private onKeyUp (event: KeyboardEvent): any {
    
        this.altKey = event.altKey;
        const moveFast = !!event.shiftKey;
        if (this.moveFast !== moveFast) {
            this.moveFast = moveFast;
            this.updateMovementSpeedStatus();
        }
    
        switch ( event.code ) {
    
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = false;
                break;
    
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = false;
                break;
    
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = false;
                break;
    
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = false;
                break;
    
            case 'KeyR':
                this.moveUp = false;
                break;
    
            case 'KeyF':
                this.moveDown = false;
                break;
        }
    }

    private onWindowBlur(): void {
        this.altKey = false;
        this.moveForward = false;
        this.moveBackward = false;
        this.moveUp = false;
        this.moveDown = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.moveFast = false;
        this.updateMovementSpeedStatus();
        this.highlightSelectedObject();
    }
    
    private onWheel (event: WheelEvent): void {
        if (event.target instanceof Element && event.target.closest(".display-controls, .lil-gui")) {
            return;
        }

        if (!this.camera || !this.renderer) {
            return;
        }

        if (!this.pointerLockControls?.isLocked && event.target !== this.renderer.domElement) {
            return;
        }

        const normalizedDeltaY = event.deltaY * (
            event.deltaMode === WheelEvent.DOM_DELTA_LINE
                ? 16
                : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                    ? 100
                    : 1
        );
        if (normalizedDeltaY === 0) {
            return;
        }

        event.preventDefault();

        const fovChange = THREE.MathUtils.clamp(
            normalizedDeltaY * CAMERA_FOV_WHEEL_SENSITIVITY,
            -MAX_CAMERA_FOV_CHANGE_PER_EVENT,
            MAX_CAMERA_FOV_CHANGE_PER_EVENT
        );
        const nextFov = THREE.MathUtils.clamp(
            this.camera.fov + fovChange,
            MIN_CAMERA_FOV,
            MAX_CAMERA_FOV
        );
        if (nextFov !== this.camera.fov) {
            this.camera.fov = nextFov;
            this.camera.updateProjectionMatrix();
        }
    }
    
    private onPointerMove (event: PointerEvent): any {
    
        // calculate pointer position in normalized device coordinates
        // (-1 to +1) for both components
    
        this.pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        this.pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    
    }
    
    
    private onPointerDown (event: PointerEvent): any {
    
        if (event.target === this.renderer.domElement) {
            this.pointerLockControls?.lock();
        }
    
    }
    
    
    private onWindowResize() {
    
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    
        this.render();
    
    }

    private snapCameraToInitialTarget(target: THREE.Vector3): void {
        const cameraFollow = this.options.cameraFollow;
        if (
            this.options.preview
            || !this.camera
            || !cameraFollow?.snapToInitialTarget
            || this.normalFollowTargetInitialized
        ) {
            return;
        }

        if (cameraFollow.positionDirection) {
            this.normalFollowPosition.set(...cameraFollow.positionDirection);
        } else {
            this.normalFollowPosition.copy(this.camera.position).sub(target);
        }
        if (this.normalFollowPosition.lengthSq() === 0) {
            this.normalFollowPosition.set(1, 1, 1);
        }

        const followDistance = this.normalFollowDistance * (cameraFollow.distanceMultiplier ?? 1);
        this.camera.position.copy(this.normalFollowPosition.setLength(followDistance).add(target));
        this.camera.lookAt(target);
        this.normalFollowTarget.copy(target);
        this.normalFollowTargetInitialized = true;
    }
    
    public center(group: number): void;
    public center(x: number, y: number, z: number): void;
    public center(x: number, y?: number, z?: number): void {
    
        if (typeof y === "undefined" && typeof z === "undefined") {
            const group = x;
            if (this.groups[group]?.mesh?.geometry?.boundingBox) {
                const center = new THREE.Vector3();
                this.groups[group].mesh.geometry.boundingBox.getCenter(center);
                this.cameraTarget = center.clone();
                this.snapCameraToInitialTarget(this.cameraTarget);
                if (this.options.preview) {
                    this.normalFollowTarget.copy(this.cameraTarget);
                    this.normalFollowTargetInitialized = true;
                }
    
                const distance = this.cameraTarget.clone().sub( this.camera.position );
                distance.setLength( 100 * this.cubeSize );
                this.cameraPosition.copy( this.cameraTarget.clone().sub( distance ) );
            }
        }
        else {
            const target = new THREE.Vector3(x, y, z).multiplyScalar(this.cubeSize).addScalar(this.cubeSize);
            this.cameraTarget = target;
            this.snapCameraToInitialTarget(target);

            if (this.options.preview && this.camera) {
                if (
                    this.previewCameraInitialized
                    && this.isTargetWithinFollowFrame(target)
                ) {
                    this.normalFollowTarget.copy(target);
                    this.normalFollowTargetInitialized = true;
                    return;
                }
                this.previewCameraInitialized = true;
                this.normalFollowTarget.copy(target);
                this.normalFollowTargetInitialized = true;
                const viewDirection = this.camera.position.clone().sub(target);
                if (viewDirection.lengthSq() === 0) {
                    viewDirection.set(1, 1, 1);
                }
                viewDirection.normalize();
                const previewZoom = Math.max(0.5, Math.min(this.options.previewZoom ?? 1, 4));
                this.camera.position.copy(target).addScaledVector(viewDirection, this.cubeSize * 10 / previewZoom);
                this.camera.lookAt(target);
            }
        }
    
    }

    private isTargetWithinFollowFrame(target: THREE.Vector3): boolean {
        this.camera.updateMatrixWorld();
        const projectedTarget = this.projectedFollowTarget.copy(target).project(this.camera);
        const safeFrameLimit = 1 - this.followViewportMargin * 2;

        return projectedTarget.z >= -1
            && projectedTarget.z <= 1
            && Math.abs(projectedTarget.x) <= safeFrameLimit
            && Math.abs(projectedTarget.y) <= safeFrameLimit;
    }

    private updateCameraFollow(delta: number): void {
        const target = this.cameraTarget;
        if (!target || !this.camera) {
            return;
        }

        if (this.isTargetWithinFollowFrame(target)) {
            this.normalFollowTarget.copy(target);
            this.normalFollowTargetInitialized = true;
            return;
        }

        if (!this.normalFollowTargetInitialized) {
            this.normalFollowTarget.copy(target);
            this.normalFollowTargetInitialized = true;
        }
        this.normalFollowTarget.lerp(target, 1 - Math.exp(-8 * delta));

        const cameraFollow = this.options.cameraFollow;
        if (cameraFollow?.positionDirection) {
            this.normalFollowPosition.set(...cameraFollow.positionDirection);
        } else {
            this.normalFollowPosition.copy(this.camera.position).sub(this.normalFollowTarget);
        }
        if (this.normalFollowPosition.lengthSq() === 0) {
            this.normalFollowPosition.set(1, 1, 1);
        }
        const followDistance = this.normalFollowDistance * (cameraFollow?.distanceMultiplier ?? 1);
        this.normalFollowPosition.setLength(followDistance).add(this.normalFollowTarget);

        const easing = 1 - Math.exp(-5 * delta);
        this.camera.position.lerp(this.normalFollowPosition, easing);

        this.normalFollowCurrentRotation.copy(this.camera.quaternion);
        this.camera.lookAt(this.normalFollowTarget);
        this.normalFollowTargetRotation.copy(this.camera.quaternion);
        this.camera.quaternion
            .copy(this.normalFollowCurrentRotation)
            .slerp(this.normalFollowTargetRotation, 1 - Math.exp(-8 * delta));
    }
    
    animationClock = new THREE.Clock();
    voxelsClock = new THREE.Clock();
    
    private animate( time ) {
    
        const delta = this.animationClock.getDelta();
    
        // log
    
        Log.update();
    
        // display lights
    
        if (this.simulation.debugLights) {
            for (const spotLight of this.spotLights) {
                spotLight.spotLightHelper?.update();
            }
        }
    
        // move camera towards requested center

        if (
            this.cameraTarget &&
            !this.options.preview &&
            !this.pointerLockControls?.isLocked
        ) {
            this.updateCameraFollow(delta);
        }
    
        if (this.cameraTarget && (performance.now() - this.lastUserInteraction) > this.follow_delay_after_user_move_ms) {
    
            if (this.orbitControls) {
                this.orbitControls?.target.lerp(this.cameraTarget, delta );
                this.camera.position.lerp(this.cameraPosition, delta );
            }
    
            for (const spotLight of this.spotLights) {
                this.positionAndDirectLight(spotLight.spotLight, spotLight.rotationY, spotLight.rotationZ, delta);
            }
    
        }
    
        // flush blocks buffer and create meshes
    
        this.flushBlocksBuffer();
    
        // update controls
    
        this.orbitControls?.update();
        this.flyControls?.update(delta);
        this.firstPersonControls?.update(delta);
        this.animatePointerLockControls(delta);
        // Alter selected object
    
        this.highlightSelectedObject();
    
        // render scene
    
        this.render();
    
        // group stuff: animations and gui update
    
        for (const group of this.groups) {
    
            if (group?.mixer) {
    
                group.mixer.update( delta );
    
            }
    
            if (group?.guiFolder) {
    
                group.guiFolder.controllers.forEach(c => c.updateDisplay());
    
            }
        }
        
        // update stats GUI
    
        if (this.simulation.stats) {
            this.stats1?.update(undefined, undefined);
        }
    
    }
    
    private positionAndDirectLight(spotLight: THREE.SpotLight, rotationY: number, rotationZ: number, time: number = 1) {
    
        if (!spotLight || !this.cameraTarget)
            return;
    
        let pos = new Vector3( 1, 0, 0 );
        pos.applyEuler(new THREE.Euler(0, rotationY, rotationZ, THREE.Euler.DEFAULT_ORDER));
        pos.multiplyScalar( this.lightDistance );
        pos.add( this.cameraTarget )
    
        spotLight.position.lerp( pos, time );
        spotLight.target.position.lerp( this.cameraTarget, time );
    
    }
    
    velocity = new THREE.Vector3(); // velocity is change of location over time
    
    private animatePointerLockControls(delta: number) {

        const moveForce = 7500; // change of velocity over time
        const speedMultiplier = this.moveFast ? 2 : this.moveSlowMode ? 0.25 : 1;
        const maxVelocity = 5000 * speedMultiplier;
        const friction = 0.99;
    
        const controls = this.pointerLockControls;
        if (this.options.preview) {
            this.cameraTarget = null;
        }
        if (!controls) {
            return;
        }
    
        const accelerationVector = new THREE.Vector3();
    
        const forward = new Vector3();
        controls.getDirection( forward );
        forward.normalize();
    
        // friction
        const frictionFactor = Math.pow(1 - friction, delta);
        this.velocity.multiplyScalar( frictionFactor );
        if (this.velocity.length() < 1) {
            this.velocity.setLength( 0 );
        }
    
        if ( controls.isLocked === true ) {
    
            const accelerationFactor = moveForce * speedMultiplier;
    
            if (this.moveForward) {
                accelerationVector.addScaledVector( forward, accelerationFactor );
            }
            else if (this.moveBackward) {
                accelerationVector.addScaledVector( forward, -accelerationFactor );
            }
    
            if (this.moveUp) {
                accelerationVector.add( this.camera.up.clone().setLength( accelerationFactor ))
    
            }
            else if (this.moveDown) {
                accelerationVector.add( this.camera.up.clone().negate().setLength( accelerationFactor ))
            }
    
            if (this.moveRight) {
                const right = forward.cross(new THREE.Vector3(0, 1, 0)).normalize();
                accelerationVector.add( right.setLength( accelerationFactor ))
            }
            else if (this.moveLeft) {
                const left = forward.cross(new THREE.Vector3(0, -1, 0)).normalize();
                accelerationVector.add( left.setLength( accelerationFactor ))
            }
        }
    
        this.velocity.add( accelerationVector );
        this.velocity.clampLength(0, maxVelocity);
        controls.getObject().position.addScaledVector( this.velocity, delta );
    
    }
    
    previousIntersectObject: THREE.Object3D | null = null;
    wireframeObject: THREE.LineSegments | null = null;
    vertexNormalHelper;

    private setWireframe(mesh: THREE.Mesh, enabled: boolean): boolean {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        let updated = false;

        for (const material of materials) {
            if (!isWireframeMaterial(material)) {
                continue;
            }

            material.wireframe = enabled;
            material.needsUpdate = true;
            updated = true;
        }

        return updated;
    }

    private createWireframeOverlay(mesh: THREE.Mesh): void {
        mesh.updateWorldMatrix(true, false);
        const geometry = new THREE.EdgesGeometry(mesh.geometry);
        geometry.applyMatrix4(mesh.matrixWorld);

        this.wireframeObject = new THREE.LineSegments(
            geometry,
            new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false })
        );
        this.wireframeObject.renderOrder = 1;
        this.scene.add(this.wireframeObject);
    }

    private highlightSelectedObject() {
    
        let intersectObject: THREE.Object3D | null = null;
    
        if (this.altKey) {
    
            // update the picking ray with the camera and pointer position
            this.raycaster.setFromCamera( this.pointer, this.camera );
        
            // calculate objects intersecting the picking ray
            const intersects = this.raycaster.intersectObjects( this.scene.children );
        
            intersectObject = intersects.find(({ object }) =>
                object !== this.wireframeObject && object.visible
            )?.object ?? null;
        }
    
        if (this.previousIntersectObject !== intersectObject) {
    
            if (intersectObject) {
                console.log(`intersect object ${JSON.stringify(intersectObject.userData)}`);
            }
    
            if (this.vertexNormalHelper) {
    
                this.scene.remove( this.vertexNormalHelper );
                this.vertexNormalHelper = null;
    
            }
    
            if (intersectObject instanceof THREE.Mesh && this.simulation.debugNormals) {
                
                this.vertexNormalHelper = new VertexNormalsHelper( intersectObject, this.cubeSize / 2, 0xff0000 );
                this.scene.add( this.vertexNormalHelper );
    
            }
    
            if (this.wireframeObject) {
                this.scene.remove(this.wireframeObject);
                this.wireframeObject.geometry.dispose();
                const materials = Array.isArray(this.wireframeObject.material)
                    ? this.wireframeObject.material
                    : [this.wireframeObject.material];
                for (const material of materials) {
                    material.dispose();
                }
                this.wireframeObject = null;
            }

            if (this.previousIntersectObject instanceof THREE.Mesh) {
                this.setWireframe(this.previousIntersectObject, false);
            }

            if (intersectObject instanceof THREE.Mesh && !this.setWireframe(intersectObject, true)) {
                this.createWireframeOverlay(intersectObject);
            }
            
            this.previousIntersectObject = intersectObject;
        }
    
    }

    private render() {
    
        this.renderer.clear();

        const overrideMaterial = this.scene.overrideMaterial;
        if (!overrideMaterial || !this.studioGrid) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const simulationObjects = this.groups.reduce<THREE.Object3D[]>((objects, { group, mesh }) => {
            const object = group ?? mesh;
            if (object) {
                objects.push(object);
            }
            return objects;
        }, []);
        const simulationVisibility = simulationObjects.map((object) => [object, object.visible] as const);
        const gridVisible = this.studioGrid.visible;

        try {
            for (const [object] of simulationVisibility) {
                object.visible = false;
            }
            this.scene.overrideMaterial = null;
            this.renderer.render(this.scene, this.camera);

            for (const [object, visible] of simulationVisibility) {
                object.visible = visible;
            }
            this.studioGrid.visible = false;
            this.scene.overrideMaterial = overrideMaterial;
            this.renderer.render(this.scene, this.camera);
        } finally {
            for (const [object, visible] of simulationVisibility) {
                object.visible = visible;
            }
            this.studioGrid.visible = gridVisible;
            this.scene.overrideMaterial = overrideMaterial;
        }
    }
}

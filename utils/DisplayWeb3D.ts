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

const max_maxIterationsPerSecond = 1000;

export class WebDisplay3D implements Display3D
{
    // https://threejs.org/docs
    // https://discoverthreejs.com/tips-and-tricks/
    
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    
    skyboxCamera: THREE.PerspectiveCamera;
    skyboxScene: THREE.Scene;
    
    spotLights: Array<{
        color: THREE.ColorRepresentation,
        intensity?: number,
        rotationY: number,
        rotationZ: number,
        spotLight?: THREE.SpotLight,
        spotLightHelper?: THREE.SpotLightHelper
    }> = [];
    
    blocksBuffers: Record<number /* group */, Array<{x: number, y: number, z: number}>>; // buffer map by group
    
    boundaries: {min: Vector3, max: Vector3};

    groups: Array<Group> = [];
    
    groupsFolder: dat.GUI;
    
    orbitControls: OrbitControls;
    flyControls: FlyControls;
    firstPersonControls: FirstPersonControls;
    arcballControls: ArcballControls;
    pointerLockControls: PointerLockControls;
    stats1: Stats.Panel;
    
    axes: THREE.AxesHelper;
    ambientLight: THREE.AmbientLight;
    
    readonly raycaster = new THREE.Raycaster();
    readonly pointer = new THREE.Vector2();

    altKey = false;
    lastUserInteraction = 0;
    
    cameraTarget: THREE.Vector3;

    readonly cameraPosition = new THREE.Vector3();
    readonly cubeSize = 50;

    readonly viewDistance = 1_000 * this.cubeSize;
    readonly lightDistance = 60 * this.cubeSize;
    readonly spotLightAngle = Math.PI / 3; // Math.PI / 6
    readonly follow_delay_after_user_move_ms = 5_000;
    
    readonly simulation = {
        maxIterationsPerSecond: 200,
        debugAxes: false,
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

    public init(iterationsPerSecond?: number) {
    
        console.log("init");
    
        // simulation speed
    
        this.simulation.maxIterationsPerSecond = iterationsPerSecond ?? 100;
    
        // camera
    
        this.camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, this.viewDistance );
        this.camera.position.setFromCylindrical(new THREE.Cylindrical(this.lightDistance, 0, this.lightDistance));
    
        // scene
    
        this.scene = new THREE.Scene();
        this.scene.matrixAutoUpdate = false;
    
        // skybox camera
        this.skyboxCamera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, this.viewDistance );
    
        // skybox scene
        this.skyboxScene = new THREE.Scene();
    
        // ambient light
    
        this.ambientLight = new THREE.AmbientLight( 0xffffff, .25 );
        this.scene.add( this.ambientLight );
    
        if (true) {
    
            const hemisphereLight = new THREE.HemisphereLight( 0xffffbb, 0x080820, .5 );
            this.scene.add( hemisphereLight );
    
        }
    
        // stats
    
        this.stats1 = new (Stats as any)();
        this.stats1.dom.id = "stats";
        document.body.appendChild(this.stats1.dom);
    
        // dat.gui
        const gui = new dat.GUI();
        const ambientLightFolder = gui.addFolder('Light');
        ambientLightFolder.add(this.ambientLight, 'intensity', 0, 1, 0.01).name("Ambient");
        ambientLightFolder.add(this.simulation, 'spotLightIntensity', 0, 100, 1).name("Spotlights").onChange(value => {
            for (const spotlight of this.spotLights) {
                spotlight.spotLight.intensity = value;
            }
        });
        const simulationFolder = gui.addFolder('Simulation');
        const pause = simulationFolder.add(this.simulation, "pause").name("paused").listen().onChange(value => {
            value ? Pause.pause() : Pause.continue();
        });;
        simulationFolder.add(this.simulation, 'maxIterationsPerSecond', 0, max_maxIterationsPerSecond, 1).name("max iterations/s");
        simulationFolder.add(this.simulation, 'debugLights').name("show spotlights").onChange(value => {
            this.setDebugLights(value);
        });
        simulationFolder.add(this.simulation, 'debugAxes').name("show axes").onChange(value => {
            this.setDebugAxes(value);
        });
        simulationFolder.add(this.simulation, 'debugNormals').name("show normals").onChange(value => {
            this.simulation.debugNormals = value;
        });
        simulationFolder.open()
        this.groupsFolder = gui.addFolder('Groups');
    
        // override material
        const wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0xFFFFFF, wireframe: true });
        simulationFolder.add(this.simulation, 'wireframe').onChange( value => {
            if (value) {
                this.scene.overrideMaterial = wireframeMaterial;
            } else {
                this.scene.overrideMaterial = null;
            }
        });
    
        simulationFolder.add(this.scene.children, 'length').name("Object count").disable().listen();
        simulationFolder.add(Checkpoint, 'countPerSecond').name("iterations/s").decimals(2).disable().listen();
    
        // debug axes
    
        this.setDebugAxes(this.simulation.debugAxes);
    
        // floor
    
        if (false) {
            var floorMaterial = new THREE.MeshStandardMaterial({
                color: new THREE.Color("lightgray"),
                // emissive: white,
                emissiveIntensity: .3,
                roughness: 0,
                side: THREE.DoubleSide
            });
            var floorGeometry = new THREE.PlaneGeometry(100000, 100000, 10, 10);
            var floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
            floorMesh.rotation.x = - Math.PI / 2;
            // floorMesh.receiveShadow = true;
            this.scene.add( floorMesh );
        }
    
        // skybox
    
        const materialArray = this.createMaterialArray("Daylight Box_Pieces", "Daylight Box", ".bmp");
        const skyboxGeo = new THREE.BoxGeometry(this.viewDistance, this.viewDistance, this.viewDistance);
        const skybox = new THREE.Mesh(skyboxGeo, materialArray);
        this.skyboxScene.add(skybox);
        
        // fog
    
        if (true) {
    
            this.scene.fog = new THREE.Fog( 0xcccccc, 10, this.viewDistance );
    
        }
    
    }
    
    private createPathStrings(foldername: string, filename: string, extension: string) {
        const basePath = "./static/skybox/";
        const baseFilename = basePath + foldername + "/" + filename;
        // const sides = ["ft", "bk", "up", "dn", "rt", "lf"];
        const sides = ["rt", "lf", "up", "dn", "ft", "bk" ];
        const pathStings = sides.map(side => {
            return baseFilename + "_" + side + extension;
        });
        
        return pathStings;
    }
    
    private createMaterialArray(foldername: string, filename: string, extension: string): THREE.Material[] {
    
        const skyboxImagepaths = this.createPathStrings(foldername, filename, extension);
        const materialArray = skyboxImagepaths.map(image => {
            let texture = new THREE.TextureLoader().load(image);
            return new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
        });
        return materialArray;
    }
    

    line: THREE.LineSegments;
    
    /**
     * Sets or changes a white box on the scene at the origin point
     * Previous values (or 1 by default) will be used for missing parameters.
     * @param width box width
     * @param height box height
     * @param depth box depth
     */
    public setBox(width?: number, height?: number, depth?: number) {
    
        const actualParameters = ((this.line?.geometry as THREE.EdgesGeometry)?.parameters?.geometry as THREE.BoxGeometry)?.parameters;
    
        if (this.line) {
            this.scene.remove( this.line );
        }
    
        const worldWidth = width ? this.cubeSize * width : (actualParameters?.width ?? this.cubeSize);
        const worldHeight = height ? this.cubeSize * height : (actualParameters?.height ?? this.cubeSize);
        const worldDepth = depth ? this.cubeSize * depth : (actualParameters?.depth ?? this.cubeSize);
    
        const geometry = new THREE.BoxGeometry(worldWidth, worldHeight, worldDepth);
    
        const edges = new THREE.EdgesGeometry(geometry);
        this.line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff }));
        this.line.position.set(worldWidth / 2, worldHeight / 2, worldDepth / 2);
        this.scene.add(this.line);
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
            emissive: style.color ?? Colors.green,
            emissiveIntensity: (style.color == Colors.red ? .5 : .3),
            roughness: 0,
            metalness: .3,
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
            {
                color: Colors.pink,
                rotationY: 0,
                rotationZ: 0
            },
            {
                color: Colors.green,
                intensity: this.simulation.spotLightIntensity * 1.5,
                rotationY: Math.PI,
                rotationZ: 0
            },
            {
                color: Colors.orange,
                rotationY: Math.PI / 2,
                rotationZ: 0
            },
            {
                color: Colors.yellow,
                rotationY: Math.PI / 2,
                rotationZ: Math.PI
            },
            {
                color: Colors.blue,
                rotationY: Math.PI / 2,
                rotationZ: 3 * Math.PI / 2
            },
            {
                color: Colors.white,
                rotationY: Math.PI / 2,
                rotationZ: Math.PI / 2
            }
        ];
    
        // instanciate spotlights
    
        for (const spotLight of this.spotLights) {
            spotLight.spotLight = new THREE.SpotLight(spotLight.color, spotLight.intensity ?? this.simulation.spotLightIntensity, this.lightDistance, this.spotLightAngle, .5, 1.5 );
            // spotLight.spotLight.castShadow = true;
    
            // spotLight.spotLight.shadow.mapSize.width = 512; // default
            // spotLight.spotLight.shadow.mapSize.height = 512; // default
            // spotLight.spotLight.shadow.camera.near = 0.5; // default
            // spotLight.spotLight.shadow.camera.far = 500; // default
            // spotLight.spotLight.shadow.focus = 1; // default
    
            this.positionAndDirectLight( spotLight.spotLight, spotLight.rotationY, spotLight.rotationZ)
            this.scene.add( spotLight.spotLight );
            this.scene.add( spotLight.spotLight.target );
        }
    
        // renderer
    
        this.renderer = new THREE.WebGLRenderer( { antialias: false } );
        this.renderer.autoClear = false;
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        document.body.appendChild( this.renderer.domElement );
    
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
        window.addEventListener( 'wheel', this.onWheel.bind(this), { passive: false } );
        window.addEventListener( 'pointermove', this.onPointerMove.bind(this) );
        window.addEventListener( 'pointerdown', this.onPointerDown.bind(this) );
        
        this.renderer.setAnimationLoop( this.animate.bind(this) );
    }
    
    private flushBlocksBuffer() {
    
        // console.log(`flushBlocksBuffer ${voxelsClock.getDelta()} ms`);
    
        if (!this.blocksBuffers) {
            return;
        }
    
        for (const group in this.blocksBuffers) {
            const blocksBuffer = this.blocksBuffers[group];
            
            // find group and assert it exists
            const type = this.groups[group];
            if (!type) {
                throw new Error(`undefined group ${group}`)
            };
        
            for (const [index, item] of blocksBuffer.entries()) {
    
                if (type.mergeMode == MergeMode.none) {
        
                    const voxelGeo = new THREE.BoxGeometry( this.cubeSize, this.cubeSize, this.cubeSize );
                    voxelGeo.translate(+ this.cubeSize / 2, + this.cubeSize / 2, + this.cubeSize / 2);
                    voxelGeo.translate(item.x * this.cubeSize, item.y * this.cubeSize, item.z * this.cubeSize);
        
                    if (!type.group) {
                        type.group = new THREE.Group()
                        this.scene.add( type.group );
                    }
        
                    type.mesh = new THREE.Mesh( voxelGeo, type.material );
                    type.mesh.userData = { group: group };
        
                    type.group.add( type.mesh );
                }
                else if (type.mergeMode == MergeMode.csg) {
            
                    const voxelGeo = new THREE.BoxGeometry( this.cubeSize, this.cubeSize, this.cubeSize );
                    voxelGeo.translate(+ this.cubeSize / 2, + this.cubeSize / 2, + this.cubeSize / 2);
                        
                    voxelGeo.translate(item.x * this.cubeSize, item.y * this.cubeSize, item.z * this.cubeSize);
        
                    if (!type.csg && !type.mesh) {
                        type.csg = CSG.fromGeometry(voxelGeo);
                    }
                    else {
                        if (!type.csg && type.mesh) {
                            type.csg = CSG.fromMesh(type.mesh);
                        }
                        
                        type.csg = type.csg.union(CSG.fromGeometry(voxelGeo));
                    }
                }
                else if (type.mergeMode == MergeMode.voxelGeometry) {
        
                    if (!type.mesh) {
    
                        const voxelGeometry = new VoxelGeometry(this.cubeSize);
                        voxelGeometry.addVoxel(new Vector3(item. x, item.y, item.z));
        
                        // material
                        // const boxMaterial = new THREE.MeshPhongMaterial( { specular: 0xffffff, flatShading: true, vertexColors: true } );
    
                        // type.mesh = new THREE.Mesh( voxelGeometry.getGeometry(type.color), boxMaterial );
                        type.mesh = new THREE.Mesh( voxelGeometry.getGeometry(null), type.material );
                        type.mesh.userData = { group: group, voxelGeometry: voxelGeometry };
                        this.scene.add(type.mesh);
    
                    }
                    else {
    
                        const voxelGeometry = type.mesh.userData.voxelGeometry as VoxelGeometry;
                        voxelGeometry.addVoxel?.(new Vector3(item.x, item.y, item.z));
                    }
                }
                else if (type.mergeMode == MergeMode.instanced) {
            
                    const voxelGeo = new THREE.BoxGeometry( this.cubeSize, this.cubeSize, this.cubeSize );
                    voxelGeo.translate(+ this.cubeSize / 2, + this.cubeSize / 2, + this.cubeSize / 2);
                        
                    if (!type.mesh) {
                        // type.group = new THREE.Group();
                        type.mesh = new THREE.InstancedMesh( voxelGeo, type.material, 10000 );
                        type.mesh.userData = { group: group };
                        (type.mesh as THREE.InstancedMesh).count = 0;
        
                        this.scene.add(type.mesh);
                    }
        
                    const pos = new THREE.Vector3(item.x, item.y, item.z);
        
                    const index = (type.mesh as THREE.InstancedMesh).count;
                    (type.mesh as THREE.InstancedMesh).count++;
                    (type.mesh as THREE.InstancedMesh).setMatrixAt(index, new THREE.Matrix4().makeTranslation(item.x * this.cubeSize, item.y * this.cubeSize, item.z * this.cubeSize));
        
                    if (!(type.mesh as THREE.InstancedMesh).userData.needsUpdate) {
        
                        (type.mesh as THREE.InstancedMesh).userData.needsUpdate = setTimeout(() => {
                            (type.mesh as THREE.InstancedMesh).instanceMatrix.needsUpdate = true;
                            delete (type.mesh as THREE.InstancedMesh).userData.needsUpdate;
                        }, 100);
            
                    }
                }
    
                // Update mesh from CSG
                if (false && type?.csg) {
        
                    const start = Date.now();
        
                    if (type.mesh) {
                        type.mesh.copy(CSG.toMesh(type.csg, new THREE.Matrix4()));
                        type.mesh.userData = { group };
                        type.mesh.material = type.material;
                    }
                    else {
                        type.mesh = CSG.toMesh(type.csg, new THREE.Matrix4());
                        type.mesh.material = type.material;
                        type.mesh.userData = { group };
                        this.scene.add(type.mesh);
                    }
        
                    // console.log(`toMesh took ${Date.now() - start}ms`);
        
                    type.csg = null;
                }
    
                // create folder GUI
                if (!type.guiFolder) {
                    const groupName = type.name ? `${type.name} (${group})` : `${group}`;
                    type.guiFolder = this.groupsFolder.addFolder(`group ${groupName}`);
    
                    type.guiFolder.add(type.group ?? type.mesh.material, "visible");
    
                    if (!type.group) {
                        type.guiFolder.add(type.mesh.material, "transparent").onChange(value => {
                            if (type.mesh) {
                                (type.mesh.material as THREE.MeshPhongMaterial).needsUpdate = true;
                            }
                        });
                        if ((type.mesh.material as any).color) {
                            type.guiFolder.addColor(type.mesh.material, "color");
                        }
                        type.guiFolder.add(type.mesh.material, "opacity", 0, 1);
                    }
                }
            }
    
            if (type.mergeMode == MergeMode.voxelGeometry) {
        
                type.mesh.geometry = (type.mesh.userData.voxelGeometry as VoxelGeometry).getGeometry( type.color );
    
            }
    
        }
    
        this.blocksBuffers = null;
    }
    
    public log(text: string) {
    
        Log.log(text);
    
    }
    
    public addBlock(x: number, y: number, z: number, group: number) {
    
        this.blocksBuffers ??= {};
        this.blocksBuffers[group] ??= [];
        this.blocksBuffers[group].push({x, y, z});
    
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
    
        Pause.pause();
        return await Checkpoint.throttle(this.simulation.maxIterationsPerSecond);
    
    }
    
    public async throttle(ratio: number = 1): Promise<void> {
    
        return Checkpoint.throttle(
            this.simulation.maxIterationsPerSecond == max_maxIterationsPerSecond
                ? -1
                : this.simulation.maxIterationsPerSecond
        );
    
    }
    
    moveForward = false;
    moveBackward = false;
    moveUp = false;
    moveDown = false;
    moveLeft = false;
    moveRight = false;
    moveFast = false;
    
    /**
     * Stop moving time after mouse wheel has been used
     */
    stopMovingTime: number = null;
    
    private onKeyDown (event: KeyboardEvent): any {
    
        this.altKey = event.altKey;
    
        this.moveFast = !!event.shiftKey;
    
        switch ( event.code ) {
    
            case "Space":
                Pause.toggle();
                break;
    
            case "KeyL":
                Pause.step();
                break;
    
            case 'ArrowUp':
            case 'KeyW':
                this.stopMovingTime = null;
                this.moveForward = true;
                break;
    
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = true;
                break;
    
            case 'ArrowDown':
            case 'KeyS':
                this.stopMovingTime = null;
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
    
    private onWheel (event: WheelEvent): any {
    
        event.preventDefault();
    
        if (event.deltaY < 0) {
            this.moveForward = true;
            this.stopMovingTime = Date.now() + 100;
        }
        else if (event.deltaY > 0) {
            this.moveBackward = true;
            this.stopMovingTime = Date.now() + 100;
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
    
    public center(group: number): void;
    public center(x: number, y: number, z: number): void;
    public center(x: number, y?: number, z?: number): void {
    
        if (typeof y === "undefined" && typeof z === "undefined") {
            const group = x;
            if (this.groups[group]?.mesh?.geometry?.boundingBox) {
                const center = new THREE.Vector3();
                this.groups[group].mesh.geometry.boundingBox.getCenter(center);
                this.cameraTarget = center.clone();
    
                const distance = this.cameraTarget.clone().sub( this.camera.position );
                distance.setLength( 100 * this.cubeSize );
                this.cameraPosition.copy( this.cameraTarget.clone().sub( distance ) );
            }
        }
        else {
            this.cameraTarget = new THREE.Vector3(x, y, z).multiplyScalar(this.cubeSize).addScalar(this.cubeSize);
        }
    
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
    
        this.stats1.update(undefined, undefined);
    
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
        const maxVelocity = 5000;
        const friction = 0.99;
    
        const controls = this.pointerLockControls;
    this.cameraTarget=null;
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
    
        if (this.cameraTarget) {
    
            const currentTarget = controls.getObject().position.clone().addScaledVector( forward, 100 );
    
            currentTarget.lerp( this.cameraTarget, delta / 100 );
            controls.getObject().lookAt( currentTarget );
    
        }
    
        if ( controls.isLocked === true ) {
    
            const accelerationFactor = moveForce * (this.moveFast ? 2 : 1);
    
            if (this.stopMovingTime !== null && Date.now() > this.stopMovingTime)  {
                this.stopMovingTime = null;
                this.moveForward = false;
                this.moveBackward = false;
            }
    
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
    
    previousIntersectObject;
    wireframeObject;
    previousIntersectObjectOriginalColor;
    vertexNormalHelper;
    
    private highlightSelectedObject() {
    
        let intersectObject: THREE.Object3D;
    
        if (this.altKey) {
    
            // update the picking ray with the camera and pointer position
            this.raycaster.setFromCamera( this.pointer, this.camera );
        
            // calculate objects intersecting the picking ray
            const intersects = this.raycaster.intersectObjects( this.scene.children );
        
            let intersectIdx: number;
            for (intersectIdx = 0; intersectIdx < intersects.length; intersectIdx++) {
                if (intersects[intersectIdx].object != this.wireframeObject && intersects[intersectIdx].object.visible) break;
            }
        
            intersectObject = intersects[intersectIdx]?.object;
        }
    
        if (this.previousIntersectObject != intersectObject) {
    
            console.log(`intersect object ${JSON.stringify( intersectObject?.userData )}`);
    
            if (this.vertexNormalHelper) {
    
                this.scene.remove( this.vertexNormalHelper );
                this.vertexNormalHelper = null;
    
            }
    
            if (intersectObject instanceof THREE.Mesh && this.simulation.debugNormals) {
                
                this.vertexNormalHelper = new VertexNormalsHelper( intersectObject, this.cubeSize / 2, 0xff0000 );
                this.scene.add( this.vertexNormalHelper );
    
            }
    
            const mode = 0;
            if (mode == 0) {
    
                if (this.wireframeObject) {
                    this.scene.remove(this.wireframeObject);
                    this.wireframeObject = null;
                }
    
                if (this.previousIntersectObject instanceof THREE.InstancedMesh) {
                    this.previousIntersectObject.material.wireframe = false;
                }
    
                if (intersectObject instanceof THREE.InstancedMesh) {
                    intersectObject.material.wireframe = true;
                }
                else if (intersectObject instanceof THREE.Mesh && intersectObject.material instanceof THREE.MeshPhongMaterial) {
                    const geometry = new THREE.EdgesGeometry( intersectObject.geometry );
                    const material = new THREE.LineBasicMaterial( { color: 0xffffff } );
                    this.wireframeObject = new THREE.LineSegments( geometry, material );
                    this.wireframeObject.renderOrder = -1; // before other objects
                    this.scene.add( this.wireframeObject );
                }
            
            }
            else {
    
                // put original color back on previous selected object
                if (this.previousIntersectObject instanceof THREE.Mesh && this.previousIntersectObject.material instanceof THREE.MeshPhongMaterial) {
                    this.previousIntersectObject.material.color.setHex(this.previousIntersectObjectOriginalColor);
                }
        
                // change color of current selected object
                if (intersectObject instanceof THREE.Mesh&& intersectObject.material instanceof THREE.MeshPhongMaterial) {
                    this.previousIntersectObjectOriginalColor = intersectObject.material.color.getHex();
                    intersectObject.material.color.setHex(Colors.white);
                }
            }
            
            this.previousIntersectObject = intersectObject;
        }
    
    }

    private render() {
    
        this.skyboxCamera.rotation.setFromRotationMatrix( new THREE.Matrix4().extractRotation( this.camera.matrixWorld ) );
        this.renderer.clear();
        this.renderer.render(this.skyboxScene, this.skyboxCamera);
        this.renderer.render( this.scene, this.camera );
    
    }
}

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { setupControls } from './controls.js'
import { createDrone } from './drone.js'
import { createEnvironment, particleSystem } from './environment.js'
import { IntegratedSystems } from './integrated-systems.js'
import './style.css'

// Inisialisasi scene, camera, dan renderer
const scene = new THREE.Scene()
// Scene background diatur di environment.js

// Kamera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 70, 120) // Posisi kamera disesuaikan untuk tampilan kandang 100x100

// Make camera globally accessible for optimization
window.camera = camera;

// Renderer dengan kualitas lebih tinggi
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas: document.querySelector('#app'),
  powerPreference: 'high-performance'
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Meningkatkan pixel ratio untuk detail lebih baik
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap // Soft shadows untuk hasil lebih realistis
renderer.toneMapping = THREE.ACESFilmicToneMapping // Tone mapping film-like untuk warna lebih natural
renderer.toneMappingExposure = 1.2 // Tingkatkan exposure untuk pencahayaan lebih baik
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true; // Aktifkan untuk pencahayaan fisik yang lebih realistis

// Post processing untuk efek visual yang lebih realistis
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// SSAO untuk bayangan ambient dan kedalaman yang lebih realistis
const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 16;
ssaoPass.minDistance = 0.005;
ssaoPass.maxDistance = 0.1;
composer.addPass(ssaoPass);

// Bloom untuk efek cahaya yang lebih realistis
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.2, 0.2, 0.9);
composer.addPass(bloomPass);

// Simple FPS counter
const fpsDisplay = document.createElement('div');
fpsDisplay.style.position = 'absolute';
fpsDisplay.style.top = '10px';
fpsDisplay.style.left = '10px';
fpsDisplay.style.background = 'rgba(0,0,0,0.5)';
fpsDisplay.style.color = 'white';
fpsDisplay.style.padding = '5px';
fpsDisplay.style.borderRadius = '4px';
fpsDisplay.style.fontFamily = 'monospace';
fpsDisplay.style.fontSize = '12px';
fpsDisplay.style.zIndex = '1000';
fpsDisplay.textContent = 'FPS: --';

// Only show in debug mode or when manually enabled
if (window.location.search.includes('debug') || window.location.search.includes('fps')) {
  document.body.appendChild(fpsDisplay);
}

// FPS calculation variables
let frameCount = 0;
let lastFpsUpdate = 0;

// Controls untuk menggerakkan kamera dengan mouse
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.minDistance = 2
controls.maxDistance = 30
controls.maxPolarAngle = Math.PI / 2 - 0.1 // Batasi kamera agar tidak bisa melihat dari bawah

// Implement realistic sky
function initSky() {
  try {
    // Add Sky
    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    // Add Sun Helper
    const sunSphere = new THREE.Mesh(
      new THREE.SphereGeometry(20000, 16, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    sunSphere.position.y = -700000;
    sunSphere.visible = false;
    scene.add(sunSphere);

    // GUI parameters - set untuk waktu golden hour (sunrise/sunset)
    const effectController = {
      turbidity: 6.5,       // Lebih rendah untuk langit yang lebih cerah
      rayleigh: 1.7,        // Pengaruh hamburan Rayleigh (warna biru pada atmosfer)
      mieCoefficient: 0.043, // Pengaruh partikel mie (efek kabut, polusi)
      mieDirectionalG: 0.8,  // Arah hamburan mie (forward scattering)
      elevation: 5,          // Ketinggian matahari dari horizon (derajat)
      azimuth: 115,          // Arah matahari (derajat)
      exposure: 0.42         // Exposure untuk tone mapping
    };

    function guiChanged() {
      const uniforms = sky.material.uniforms;
      uniforms['turbidity'].value = effectController.turbidity;
      uniforms['rayleigh'].value = effectController.rayleigh;
      uniforms['mieCoefficient'].value = effectController.mieCoefficient;
      uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

      const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
      const theta = THREE.MathUtils.degToRad(effectController.azimuth);

      sunSphere.position.x = Math.cos(theta) * Math.cos(phi) * 100000;
      sunSphere.position.y = Math.sin(phi) * 100000;
      sunSphere.position.z = Math.sin(theta) * Math.cos(phi) * 100000;
      
      sky.material.uniforms['sunPosition'].value.copy(sunSphere.position);
      renderer.toneMappingExposure = effectController.exposure;
      
      // Tambahkan directional light yang mengikuti posisi matahari
      createSunLight(sunSphere.position);
    }
    
    // Fungsi untuk membuat directional light berdasarkan posisi matahari
    function createSunLight(sunPosition) {
      // Hapus directional light yang lama jika ada
      scene.children.forEach(child => {
        if(child.userData && child.userData.isSunLight) {
          scene.remove(child);
        }
      });
      
      // Buat directional light baru
      const sunLight = new THREE.DirectionalLight(
        // Warna cahaya lebih oranye untuk sunrise/sunset
        new THREE.Color(0xffaa55), 
        1.5 // Intensitas
      );
      
      // Posisi light berdasarkan arah matahari
      const lightPosition = new THREE.Vector3(
        sunPosition.x, 
        sunPosition.y, 
        sunPosition.z
      ).normalize().multiplyScalar(50);
      
      sunLight.position.copy(lightPosition);
      sunLight.castShadow = true;
      
      // Setup shadow quality tinggi
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 200;
      sunLight.shadow.camera.left = -50;
      sunLight.shadow.camera.right = 50;
      sunLight.shadow.camera.top = 50;
      sunLight.shadow.camera.bottom = -50;
      sunLight.shadow.bias = -0.0005; // Reduce shadow acne
      sunLight.shadow.normalBias = 0.02; // Better shadow mapping
      
      // Mark as sun light
      sunLight.userData = { isSunLight: true };
      scene.add(sunLight);
    }

    guiChanged();

    // Add fog untuk efek jarak (atmospheric perspective)
    scene.fog = new THREE.FogExp2(0xd8e7ff, 0.002);
    
    // Fallback jika tekstur skybox tidak tersedia
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
  } catch (error) {
    console.error("Error initializing sky:", error);
    
    // Fallback simple sky using color
    console.log("Using simple sky fallback");
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    
    // Add basic lighting
    const directionalLight = new THREE.DirectionalLight(0xffffeb, 1.2);
    directionalLight.position.set(50, 100, 30);
    directionalLight.castShadow = true;
    
    // Shadow setup
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 10;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    
    scene.add(directionalLight);
    
    // Add fog
    scene.fog = new THREE.FogExp2(0xd8e7ff, 0.002);
  }
}

// Initialize sky
initSky();

// Buat lingkungan kandang peternakan ayam sayur dengan tekstur dan material yang lebih realistis
createEnvironment(scene)

// Inisialisasi sistem partikel dan ventilasi
// Cari objek ventilasi dan partikel dari scene
let ventilationSystem = null;
let particlesGroup = null;

// Cari referensi objek untuk animasi
scene.traverse((object) => {
  // Periksa properti yang khas untuk objek ventilasi
  if (object.children && object.children.some(child => child.blades || child.flap)) {
    ventilationSystem = object;
  }
  // Periksa properti yang khas untuk objek partikel
  if (object.updateParticles) {
    particlesGroup = object;
  }
});

// Inisialisasi sistem partikel dengan referensi yang ditemukan
if (particlesGroup && ventilationSystem) {
  particleSystem.initAnimation(particlesGroup, ventilationSystem);
}

// Buat drone dan posisikan di atas kandang
const drone = createDrone()
drone.position.set(0, 3, 0) // Posisi awal drone di atas kandang
scene.add(drone)

// Initialize integrated systems
const integratedSystems = new IntegratedSystems(scene);
integratedSystems.initialize(drone);

// Setup kontrol keyboard untuk drone
const droneState = {
  position: { x: 0, y: 3, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  speed: 0.02,
  rotationSpeed: 0.005,
  propellerSpeed: 0.1,
  manualControlEnabled: true, // Tambahkan flag untuk kontrol manual
  // Tambah mode auto-pilot
  autopilot: {
    active: false,
    waypoints: [],
    currentWaypoint: 0,
    loopMode: true,
    waypointTolerance: 1.0,    // Jarak dalam meter saat waypoint dianggap tercapai
    patrolPoints: []           // Point untuk mode patrol
  }
}
setupControls(drone, droneState)

// Simulasi data sensor
const sensorData = {
  temperature: 25.0,
  humidity: 65.0,
  co2: 800,
  particulate: 35,
  ammonia: 3.5,
  updateInterval: null
}

// Setup sensor data simulation
function setupSensorSimulation() {
  // Buat panel untuk menampilkan semua data sensor
  createSensorPanel();
  
  // Update sensor UI elements
  function updateSensorUI() {
    // Update data teknis drone
    if (drone.sensorData) {
      // Safely set element text content if element exists
      const safeSetTextContent = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
        }
      };
      
      // Safely set element style property if element exists
      const safeSetStyle = (id, property, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.style[property] = value;
        }
      };
      
      // Update data orientasi
      safeSetTextContent('pitch-reading', drone.sensorData.orientation.pitch + '°');
      safeSetTextContent('roll-reading', drone.sensorData.orientation.roll + '°');
      safeSetTextContent('yaw-reading', drone.sensorData.orientation.yaw + '°');
      
      // Update data ketinggian & flight time
      safeSetTextContent('altitude-reading', drone.sensorData.altitude + 'm');
      safeSetTextContent('flight-time', formatTime(drone.sensorData.flightTime));
      
      // Pastikan nilai battery valid
      let batteryLevel = drone.sensorData.battery;
      if (typeof batteryLevel !== 'number' || isNaN(batteryLevel)) {
        batteryLevel = 85; // Default jika tidak valid
      }
      
      // Update data battery dengan batasan nilai
      batteryLevel = Math.max(0, Math.min(100, batteryLevel));
      safeSetTextContent('battery-level', batteryLevel.toFixed(1) + '%');
      
      // Update data signal strength
      let signalStrength = drone.sensorData.signalStrength;
      if (typeof signalStrength !== 'number' || isNaN(signalStrength)) {
        signalStrength = 95; // Default jika tidak valid
      }
      safeSetTextContent('signal-strength', signalStrength.toFixed(0) + '%');
      
      // Update bar untuk signal strength
      safeSetStyle('signal-bar', 'width', signalStrength + '%');
      
      // Update battery bar dengan batasan nilai
      safeSetStyle('battery-bar', 'width', batteryLevel + '%');
      
      // Ubah warna battery bar berdasarkan level
      const batteryBar = document.getElementById('battery-bar');
      if (batteryBar) {
        if (batteryLevel > 50) {
          batteryBar.style.backgroundColor = '#4CAF50'; // Hijau
        } else if (batteryLevel > 20) {
          batteryBar.style.backgroundColor = '#FFC107'; // Kuning
        } else {
          batteryBar.style.backgroundColor = '#F44336'; // Merah
        }
      }
      
      // Update info teknis battery
      if (drone.physics && drone.physics.status) {
        // Pastikan semua nilai valid, gunakan nilai default jika tidak
        const voltage = drone.physics.status.voltage || '11.1';
        const current = drone.physics.status.current || '0.0';
        const power = drone.physics.status.power || '0';
        const remainingTime = drone.physics.status.estimatedFlightTime || '00';
        
        safeSetTextContent('battery-voltage', voltage);
        safeSetTextContent('battery-current', current);
        safeSetTextContent('battery-power', power);
        safeSetTextContent('remaining-time', remainingTime);
        
        // Update throttle dengan validasi
        let throttle = parseFloat(drone.physics.status.throttle) || 0;
        throttle = Math.max(0, Math.min(10, throttle)); // Limit range
        const throttlePercent = throttle * 30; // Scale untuk tampilan visual (max 300%)
        safeSetTextContent('throttle-value', throttle.toFixed(2));
        safeSetStyle('throttle-bar', 'width', throttlePercent + '%');
        
        // Debug info battery
        if (drone.sensorData.flightTime % 5 < 0.02) { // Log setiap ~5 detik
          console.log(`UI Update - Battery: ${batteryLevel.toFixed(2)}%, Voltage: ${voltage}V, Current: ${current}A`);
        }
      }
      
      // Update nilai RPM untuk masing-masing motor
      for (let i = 0; i < drone.motorSpeed.length; i++) {
        // Pastikan nilai RPM valid
        const rpm = drone.motorSpeed[i] || 0;
        safeSetTextContent(`motor-${i+1}-rpm`, rpm + ' RPM');
      }
    }
  }

  // Function to format flight time in MM:SS format
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Simulate sensor readings based on drone position and physics
  function simulateSensorReadings() {
    try {
      // Update UI dengan nilai-nilai baru
      updateSensorUI();
    } catch (error) {
      console.error("Error updating sensor UI:", error);
      // Don't throw the error to avoid crashing
    }
  }
  
  // Give the UI some time to initialize before starting updates
  setTimeout(() => {
    // Set up simulation interval - lebih sering update untuk UI responsif
    sensorData.updateInterval = setInterval(simulateSensorReadings, 50); // Update setiap 50ms
    
    // Initial update
    simulateSensorReadings();
  }, 500); // Wait 500ms for the UI to be ready
  
  // Make sure the interval is cleared when page is unloaded
  window.addEventListener('beforeunload', () => {
    if (sensorData.updateInterval) {
      clearInterval(sensorData.updateInterval);
    }
  });
}

// Create a complete sensor data panel
function createSensorPanel() {
  // Buat container untuk panel sensor
  let sensorPanel = document.getElementById('sensor-panel');
  
  // If panel already exists, just ensure it's visible
  if (sensorPanel) {
    sensorPanel.style.display = 'block';
    sensorPanel.style.visibility = 'visible';
    sensorPanel.style.opacity = '1';
    return;
  }
  
  // Otherwise create a new panel
  sensorPanel = document.createElement('div');
  sensorPanel.id = 'sensor-panel';
  sensorPanel.style.position = 'absolute';
  sensorPanel.style.top = '20px';
  sensorPanel.style.right = '20px';
  sensorPanel.style.width = '300px';
  sensorPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  sensorPanel.style.color = 'white';
  sensorPanel.style.padding = '15px';
  sensorPanel.style.borderRadius = '5px';
  sensorPanel.style.fontFamily = 'Arial, sans-serif';
  sensorPanel.style.fontSize = '14px';
  sensorPanel.style.zIndex = '1000';
  sensorPanel.style.display = 'block';
  
  // HTML untuk panel
  sensorPanel.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
      <h3 style="margin: 0; color: #44AAFF;">Drone Telemetry</h3>
      <div style="text-align: right;">
        <span id="flight-time" style="font-family: monospace; font-size: 16px; color: #44AAFF;">00:00</span>
        <span style="font-size: 12px; color: #CCC; display: block; margin-top: 2px;">Flight time</span>
      </div>
    </div>
    
    <div style="margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
        <span>Battery</span>
        <span id="battery-level">85%</span>
      </div>
      <div style="height: 10px; background-color: #333; border-radius: 5px; overflow: hidden;">
        <div id="battery-bar" style="height: 100%; width: 85%; background-color: #4CAF50;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 3px; color: #AAA;">
        <span><span id="battery-voltage">11.1</span>V</span>
        <span><span id="battery-current">0.0</span>A</span>
        <span><span id="battery-power">0</span>W</span>
        <span>Est. <span id="remaining-time">00</span>min</span>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; grid-gap: 10px; margin-bottom: 15px;">
      <div class="sensor-box" style="background-color: rgba(255,255,255,0.1); padding: 8px; border-radius: 5px;">
        <div style="font-size: 12px; color: #CCC;">Altitude</div>
        <div id="altitude-reading" style="font-size: 18px; font-weight: bold;">0.0m</div>
      </div>
      <div class="sensor-box" style="background-color: rgba(255,255,255,0.1); padding: 8px; border-radius: 5px;">
        <div style="font-size: 12px; color: #CCC; margin-bottom: 3px;">Orientation</div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span>P: <span id="pitch-reading">0°</span></span>
          <span>R: <span id="roll-reading">0°</span></span>
          <span>Y: <span id="yaw-reading">0°</span></span>
        </div>
      </div>
    </div>
    
    <div class="panel-section" style="margin-bottom: 15px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
        <div style="font-size: 12px; color: #CCC;">Motors</div>
        <div style="font-size: 11px; display: flex; align-items: center;">
          <div style="display: flex; align-items: center; margin-right: 8px;">
            <span style="width: 8px; height: 8px; background-color: rgba(204,0,0,0.8); display: inline-block; margin-right: 3px; border-radius: 50%;"></span>
            <span>CW</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="width: 8px; height: 8px; background-color: rgba(0,0,204,0.8); display: inline-block; margin-right: 3px; border-radius: 50%;"></span>
            <span>CCW</span>
          </div>
        </div>
      </div>
      <div class="motors-container" style="display: grid; grid-template-columns: 1fr 1fr; grid-gap: 5px; font-size: 12px; font-family: monospace;">
        <div style="background-color: rgba(204,0,0,0.2); padding: 5px; border-radius: 3px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px;">FR:</span>
          <span id="motor-1-rpm" style="font-weight: bold;">0 RPM</span>
        </div>
        <div style="background-color: rgba(0,0,204,0.2); padding: 5px; border-radius: 3px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px;">FL:</span>
          <span id="motor-2-rpm" style="font-weight: bold;">0 RPM</span>
        </div>
        <div style="background-color: rgba(0,0,204,0.2); padding: 5px; border-radius: 3px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px;">BR:</span>
          <span id="motor-3-rpm" style="font-weight: bold;">0 RPM</span>
        </div>
        <div style="background-color: rgba(204,0,0,0.2); padding: 5px; border-radius: 3px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px;">BL:</span>
          <span id="motor-4-rpm" style="font-weight: bold;">0 RPM</span>
        </div>
      </div>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px;">
      <div style="width: 48%;">
        <div style="display: flex; justify-content: space-between; color: #CCC; margin-bottom: 3px;">
          <span>Throttle</span>
          <span id="throttle-value">0%</span>
        </div>
        <div style="height: 6px; background-color: #333; border-radius: 3px; overflow: hidden;">
          <div id="throttle-bar" style="height: 100%; width: 0%; background-color: #FF5722;"></div>
        </div>
      </div>
      <div style="width: 48%;">
        <div style="display: flex; justify-content: space-between; color: #CCC; margin-bottom: 3px;">
          <span>Signal</span>
          <span id="signal-strength">95%</span>
        </div>
        <div style="height: 6px; background-color: #333; border-radius: 3px; overflow: hidden;">
          <div id="signal-bar" style="height: 100%; width: 95%; background-color: #8BC34A;"></div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(sensorPanel);
  
  // Style untuk units
  const style = document.createElement('style');
  style.textContent = `
    .sensor-unit {
      font-size: 10px;
      color: #CCC;
      margin-left: 2px;
      font-weight: normal;
    }
  `;
  document.head.appendChild(style);
}

// Initialize sensor simulation
setupSensorSimulation();

// Tambahkan fungsi untuk waypoint navigation
function setupWaypointNavigation() {
  // Buat UI panel untuk autopilot
  createAutopilotUI();
  
  // Buat panel untuk autopilot controls
  function createAutopilotUI() {
    let autopilotPanel = document.getElementById('autopilot-panel');
    
    // If panel already exists, just ensure it's visible
    if (autopilotPanel) {
      autopilotPanel.style.display = 'block';
      autopilotPanel.style.visibility = 'visible';
      autopilotPanel.style.opacity = '1';
      return;
    }
    
    // Otherwise create a new panel
    autopilotPanel = document.createElement('div');
    autopilotPanel.id = 'autopilot-panel';
    autopilotPanel.style.position = 'absolute';
    autopilotPanel.style.bottom = '20px';
    autopilotPanel.style.left = '20px';
    autopilotPanel.style.width = '300px';
    autopilotPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    autopilotPanel.style.color = 'white';
    autopilotPanel.style.padding = '15px';
    autopilotPanel.style.borderRadius = '5px';
    autopilotPanel.style.fontFamily = 'Arial, sans-serif';
    autopilotPanel.style.fontSize = '14px';
    autopilotPanel.style.zIndex = '1000';
    autopilotPanel.style.display = 'block';
    
    autopilotPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
        <h3 style="margin: 0; color: #44AAFF;">Drone Autopilot</h3>
        <div>
          <button id="autopilot-toggle" style="background-color: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Aktifkan</button>
        </div>
      </div>
      
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
          <span>Mode:</span>
          <select id="autopilot-mode" style="background-color: #333; color: white; border: 1px solid #555; padding: 3px; border-radius: 3px;">
            <option value="waypoints">Waypoints</option>
            <option value="patrol">Patroli Kandang</option>
          </select>
        </div>
        
        <div id="waypoint-controls" style="margin-top: 8px;">
          <button id="add-waypoint" style="background-color: #555; color: white; border: none; padding: 3px 8px; border-radius: 3px; margin-right: 5px; cursor: pointer;">Tambah Posisi Saat Ini</button>
          <button id="clear-waypoints" style="background-color: #f44336; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">Hapus Semua</button>
          
          <div style="margin-top: 8px;">
            <div style="font-size: 12px; color: #CCC; margin-bottom: 5px;">Waypoints:</div>
            <div id="waypoint-list" style="max-height: 100px; overflow-y: auto; font-size: 11px; font-family: monospace;">
              <div style="color: #999; text-align: center;">Belum ada waypoint</div>
            </div>
          </div>
        </div>
      </div>
      
      <div style="margin-top: 10px; font-size: 12px; color: #CCC;">
        <div style="margin-bottom: 5px;">Status: <span id="autopilot-status">Tidak Aktif</span></div>
        <div id="current-target" style="display: none;">
          Target: <span id="target-coords">-</span> (<span id="distance-to-target">0.0</span>m)
        </div>
      </div>
    `;
    
    document.body.appendChild(autopilotPanel);
    
    // Set up event listeners for autopilot controls
    setupAutopilotControls();
  }
  
  // Setup event listeners untuk UI autopilot
  function setupAutopilotControls() {
    // Toggle autopilot on/off
    const toggleButton = document.getElementById('autopilot-toggle');
    toggleButton.addEventListener('click', () => {
      droneState.autopilot.active = !droneState.autopilot.active;
      toggleButton.textContent = droneState.autopilot.active ? 'Matikan' : 'Aktifkan';
      toggleButton.style.backgroundColor = droneState.autopilot.active ? '#f44336' : '#4CAF50';
      
      document.getElementById('autopilot-status').textContent = 
        droneState.autopilot.active ? 'Aktif' : 'Tidak Aktif';
      
      document.getElementById('current-target').style.display = 
        droneState.autopilot.active ? 'block' : 'none';
      
      // Set manual control flag berdasarkan autopilot status
      droneState.manualControlEnabled = !droneState.autopilot.active;
      
      // Reset waypoint counter saat diaktifkan
      if (droneState.autopilot.active) {
        droneState.autopilot.currentWaypoint = 0;
        
        // Jika mode patrol dan belum ada patrol points, buat patrol path
        const mode = document.getElementById('autopilot-mode').value;
        if (mode === 'patrol' && droneState.autopilot.patrolPoints.length === 0) {
          generatePatrolPath();
        }
        
        // Set flight dynamics control source
        if (window.flightDynamics) {
          window.flightDynamics.controlSource = 'autopilot';
        }
      } else {
        // Set flight dynamics control source back to manual
        if (window.flightDynamics) {
          window.flightDynamics.controlSource = 'manual';
        }
      }
    });
    
    // Mode selection
    const modeSelect = document.getElementById('autopilot-mode');
    modeSelect.addEventListener('change', () => {
      const isPatrol = modeSelect.value === 'patrol';
      
      if (isPatrol && droneState.autopilot.patrolPoints.length === 0) {
        generatePatrolPath();
      }
      
      if (droneState.autopilot.active) {
        droneState.autopilot.currentWaypoint = 0;
      }
      
      updateWaypointList();
    });
    
    // Add current position as waypoint
    document.getElementById('add-waypoint').addEventListener('click', () => {
      const position = {
        x: drone.position.x,
        y: drone.position.y,
        z: drone.position.z
      };
      
      droneState.autopilot.waypoints.push(position);
      updateWaypointList();
    });
    
    // Clear all waypoints
    document.getElementById('clear-waypoints').addEventListener('click', () => {
      droneState.autopilot.waypoints = [];
      updateWaypointList();
    });
    
    // Initial state
    updateWaypointList();
  }
  
  // Generate rute patrol di sekitar kandang
  function generatePatrolPath() {
    const patrolPoints = [];
    const height = 3.5; // Ketinggian patrol
    const coopSize = 90; // Ukuran kandang
    const margin = 10;   // Jarak dari dinding
    
    // Buat parameter untuk path
    const pathSize = coopSize - margin * 2;
    const halfSize = pathSize / 2;
    
    // Buat titik-titik pada persegi panjang di sekitar kandang
    // Titik pojok
    patrolPoints.push({ x: -halfSize, y: height, z: -halfSize }); // 1. Pojok depan kiri
    
    // Tambah beberapa titik di sisi depan
    patrolPoints.push({ x: -halfSize/2, y: height, z: -halfSize });
    patrolPoints.push({ x: 0, y: height, z: -halfSize });
    patrolPoints.push({ x: halfSize/2, y: height, z: -halfSize });
    
    patrolPoints.push({ x: halfSize, y: height, z: -halfSize }); // 2. Pojok depan kanan
    
    // Tambah beberapa titik di sisi kanan
    patrolPoints.push({ x: halfSize, y: height, z: -halfSize/2 });
    patrolPoints.push({ x: halfSize, y: height, z: 0 });
    patrolPoints.push({ x: halfSize, y: height, z: halfSize/2 });
    
    patrolPoints.push({ x: halfSize, y: height, z: halfSize }); // 3. Pojok belakang kanan
    
    // Tambah beberapa titik di sisi belakang
    patrolPoints.push({ x: halfSize/2, y: height, z: halfSize });
    patrolPoints.push({ x: 0, y: height, z: halfSize });
    patrolPoints.push({ x: -halfSize/2, y: height, z: halfSize });
    
    patrolPoints.push({ x: -halfSize, y: height, z: halfSize }); // 4. Pojok belakang kiri
    
    // Tambah beberapa titik di sisi kiri
    patrolPoints.push({ x: -halfSize, y: height, z: halfSize/2 });
    patrolPoints.push({ x: -halfSize, y: height, z: 0 });
    patrolPoints.push({ x: -halfSize, y: height, z: -halfSize/2 });
    
    // Tambah titik tengah kandang
    patrolPoints.push({ x: 0, y: height, z: 0 }); // Tengah kandang
    
    // Pattern diagonal melintasi kandang
    patrolPoints.push({ x: -halfSize, y: height, z: -halfSize }); // Kembali ke awal
    
    droneState.autopilot.patrolPoints = patrolPoints;
  }
  
  // Update list waypoint di UI
  function updateWaypointList() {
    const waypointList = document.getElementById('waypoint-list');
    const mode = document.getElementById('autopilot-mode').value;
    
    if (mode === 'waypoints') {
      // Display custom waypoints
      if (droneState.autopilot.waypoints.length === 0) {
        waypointList.innerHTML = '<div style="color: #999; text-align: center;">Belum ada waypoint</div>';
      } else {
        let html = '';
        droneState.autopilot.waypoints.forEach((point, index) => {
          html += `<div style="margin-bottom: 3px; padding: 2px; ${index === droneState.autopilot.currentWaypoint && droneState.autopilot.active ? 'background-color: rgba(76, 175, 80, 0.3);' : ''}">
            ${index + 1}. (${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)})
          </div>`;
        });
        waypointList.innerHTML = html;
      }
    } else {
      // Display patrol waypoints
      if (droneState.autopilot.patrolPoints.length === 0) {
        waypointList.innerHTML = '<div style="color: #999; text-align: center;">Generating patrol path...</div>';
        setTimeout(() => {
          generatePatrolPath();
          updateWaypointList();
        }, 500);
      } else {
        let html = '<div style="color: #999; text-align: center;">Rute Patroli Terprogram</div>';
        waypointList.innerHTML = html;
      }
    }
  }
  
  // Fungsi untuk mengupdate status autopilot di UI
  function updateAutopilotStatus() {
    try {
      if (!droneState.autopilot.active) return;
      
      // Safely set element text content if element exists
      const safeSetTextContent = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
        }
      };
      
      // Safely set element style property if element exists
      const safeSetStyle = (id, property, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.style[property] = value;
        }
      };
      
      // Safely set element display property
      const safeSetDisplay = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.style.display = value;
        }
      };
      
      const mode = document.getElementById('autopilot-mode')?.value || 'waypoints';
      const points = mode === 'waypoints' ? droneState.autopilot.waypoints : droneState.autopilot.patrolPoints;
      
      if (points.length === 0) {
        safeSetTextContent('autopilot-status', 'Menunggu waypoints');
        safeSetDisplay('current-target', 'none');
        return;
      }
      
      const currentWaypoint = droneState.autopilot.currentWaypoint;
      const target = points[currentWaypoint];
      
      // Calculate distance to target
      const dx = drone.position.x - target.x;
      const dy = drone.position.y - target.y;
      const dz = drone.position.z - target.z;
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      // Update UI
      safeSetTextContent('autopilot-status', `Menuju Target ${currentWaypoint + 1}/${points.length}`);
      safeSetTextContent('target-coords', `(${target.x.toFixed(1)}, ${target.y.toFixed(1)}, ${target.z.toFixed(1)})`);
      safeSetTextContent('distance-to-target', distance.toFixed(1));
      
      // Update current waypoint in list
      updateWaypointList();
    } catch (error) {
      console.error("Error updating autopilot status:", error);
    }
  }
  
  // Setup interval untuk update status
  setInterval(updateAutopilotStatus, 200);
  
  // Setup autopilot control loop
  function updateAutopilot() {
    if (!droneState.autopilot.active) return;
    
    // Jika ada obstacle avoidance aktif, beri prioritas
    const flightDynamics = window.flightDynamics;
    if (flightDynamics && flightDynamics.controlSource === 'obstacle_avoidance') {
      return; // Obstacle avoidance has higher priority
    }
    
    const mode = document.getElementById('autopilot-mode').value;
    const points = mode === 'waypoints' ? droneState.autopilot.waypoints : droneState.autopilot.patrolPoints;
    
    if (points.length === 0) return;
    
    const currentWaypoint = droneState.autopilot.currentWaypoint;
    const target = points[currentWaypoint];
    
    // Calculate vector to target
    const dx = target.x - drone.position.x;
    const dy = target.y - drone.position.y;
    const dz = target.z - drone.position.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    // Check if waypoint reached
    if (distance < droneState.autopilot.waypointTolerance) {
      // Move to next waypoint
      droneState.autopilot.currentWaypoint = (currentWaypoint + 1) % points.length;
      
      // If we completed a loop and not in loop mode, stop autopilot
      if (droneState.autopilot.currentWaypoint === 0 && !droneState.autopilot.loopMode) {
        droneState.autopilot.active = false;
        droneState.manualControlEnabled = true;
        document.getElementById('autopilot-toggle').textContent = 'Aktifkan';
        document.getElementById('autopilot-toggle').style.backgroundColor = '#4CAF50';
        document.getElementById('autopilot-status').textContent = 'Selesai';
        document.getElementById('current-target').style.display = 'none';
        
        // Update flight dynamics control source
        if (flightDynamics) {
          flightDynamics.controlSource = 'manual';
        }
      }
      
      return;
    }
    
    // Normalize direction vector
    const length = Math.sqrt(dx*dx + dz*dz); // horizontal length
    let dirX = 0;
    let dirZ = 0;
    
    if (length > 0.001) {
      dirX = dx / length;
      dirZ = dz / length;
    }
    
    // Set control source if not already set
    if (flightDynamics && flightDynamics.controlSource !== 'autopilot') {
      flightDynamics.controlSource = 'autopilot';
    }
    
    // Apply movement to flight dynamics
    if (flightDynamics) {
      // Move horizontally
      const moveSpeed = 0.0015; // Kecepatan autopilot
      flightDynamics.velocity.x += dirX * moveSpeed;
      flightDynamics.velocity.z += dirZ * moveSpeed;
      
      // Adjust altitude
      const verticalSpeed = 0.001;
      if (Math.abs(dy) > 0.2) {
        flightDynamics.velocity.y += Math.sign(dy) * verticalSpeed;
      }
      
      // Rotate drone to face direction of travel
      if (length > 0.001) {
        // Calculate target yaw (atan2 gives angle in radians)
        const targetYaw = Math.atan2(-dirX, -dirZ);
        
        // Calculate the difference
        let yawDiff = targetYaw - drone.rotation.y;
        
        // Normalize the difference to [-PI, PI]
        while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
        while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
        
        // Apply rotation (with smoothing)
        flightDynamics.rotationVelocity.y += yawDiff * 0.01;
      }
    }
  }
  
  // Setup interval untuk kontrol autopilot
  setInterval(updateAutopilot, 16); // 60fps approximation
}

// Initialize waypoint navigation
setupWaypointNavigation();

// Handle resize window
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
})

// Level of detail settings for optimization
const LOD = {
  enabled: true,
  distanceThresholds: {
    high: 30,    // Full detail within this distance
    medium: 100,  // Medium detail within this distance
    low: 200     // Low detail beyond high distance
  },
  currentLevel: 'high',
  checkDistance: function(position) {
    if (!this.enabled) return 'high';
    
    const cameraPosition = camera.position;
    const distance = Math.sqrt(
      Math.pow(cameraPosition.x - position.x, 2) + 
      Math.pow(cameraPosition.y - position.y, 2) + 
      Math.pow(cameraPosition.z - position.z, 2)
    );
    
    if (distance <= this.distanceThresholds.high) {
      return 'high';
    } else if (distance <= this.distanceThresholds.medium) {
      return 'medium';
    } else {
      return 'low';
    }
  },
  applyToScene: function(scene) {
    // Apply LOD to chickens
    scene.traverse(object => {
      // Only process objects with userData.type set
      if (object.userData && object.userData.type) {
        const level = this.checkDistance(object.position);
        
        switch (object.userData.type) {
          case 'chicken':
            // Only show details in high detail mode
            if (level !== 'high' && object.children.length > 2) {
              // Hide small details (wings, beaks, etc) in medium/low detail
              for (let i = 2; i < object.children.length; i++) {
                object.children[i].visible = (level === 'high');
              }
            }
            break;
            
          case 'plant':
            // Reduce complexity for plants
            if (level === 'low' && object.material) {
              object.material.wireframe = true;
            } else if (object.material) {
              object.material.wireframe = false;
            }
            break;
            
          case 'decoration':
            // Hide decorations in low detail mode
            object.visible = (level !== 'low');
            break;
        }
      }
    });
  }
};

// Konfigurasi global untuk performa
const PERFORMANCE = {
  targetFPS: 30,
  lowPerfMode: false,
  throttleInterval: 1000 / 30, // 33.33ms per frame at 30fps
  cullingInterval: 10,         // Update culling setiap 10 frame
  particleUpdateInterval: 3,   // Update partikel setiap 3 frame
  monitoringInterval: 60,      // Pemantauan performa setiap 60 frame
  reduceQualityThreshold: 25,  // Threshold untuk penurunan kualitas (ms)
  qualityReductionCooldown: 0, // Cooldown untuk penurunan kualitas
  particleCount: 100,          // Jumlah partikel default
  maxShadowMapSize: 2048,      // Shadow map size
  bloomIntensity: 0.2,         // Bloom intensity
  dynamicLOD: true             // Adjust LOD dynamically
};

// Deteksi perangkat low-end
function detectPerformance() {
  // Deteksi perangkat low-end
  const lowEndDevice = 
    navigator.hardwareConcurrency <= 4 || // 4 cores or less
    /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent) || 
    window.innerWidth < 1024; // Probably mobile
    
  // Set config berdasarkan kemampuan perangkat
  if (lowEndDevice) {
    console.log("Detected low-end device, optimizing for performance");
    PERFORMANCE.lowPerfMode = true;
    PERFORMANCE.targetFPS = 24;
    PERFORMANCE.throttleInterval = 1000 / 24;
    PERFORMANCE.cullingInterval = 15;
    PERFORMANCE.particleUpdateInterval = 5;
    PERFORMANCE.particleCount = 30;
    PERFORMANCE.maxShadowMapSize = 1024;
    PERFORMANCE.bloomIntensity = 0.1;
    
    // Update LOD thresholds
    if (LOD && LOD.distanceThresholds) {
      LOD.distanceThresholds.high = 15;
      LOD.distanceThresholds.medium = 30;
      LOD.distanceThresholds.low = 60;
    }
    
    // Disable some post-processing
    if (bloomPass) {
      bloomPass.strength = 0.1;
    }
    if (ssaoPass) {
      ssaoPass.enabled = false;
    }
  }
}

// Animation loop
let lastFrameTime = 0;
let frameTimes = []; // Track recent frame times for monitoring
let cullingFrameCount = 0; // Counter for less frequent operations
let heavyOperationTimers = { // Timers for heavy operations
  culling: 0,
  particles: 0,
  propellerEffects: 0,
  monitoring: 0
};

// Add a variable to track last panel check time
let lastCheckPanelsTime = 0;

function animate(currentTime) {
  // Schedule next frame first to avoid blocking the event loop
  requestAnimationFrame(animate);
  
  // Skip processing if tab is not active to save resources
  if (document.hidden) {
    return;
  }
  
  // Calculate delta time for smoother animations regardless of frame rate
  const deltaTime = currentTime - lastFrameTime;
  const fpsInterval = 1000 / 60; // Target 60fps
  
  // Update FPS counter
  frameCount++;
  if (currentTime - lastFpsUpdate > 1000) { // Update every second
    const fps = Math.round(frameCount * 1000 / (currentTime - lastFpsUpdate));
    fpsDisplay.textContent = `FPS: ${fps}`;
    frameCount = 0;
    lastFpsUpdate = currentTime;
    
    // Adjust performance settings if FPS is consistently low
    if (fps < 20 && !PERFORMANCE.lowPerfMode) {
      console.log("FPS below threshold, enabling low performance mode");
      PERFORMANCE.lowPerfMode = true;
      PERFORMANCE.cullingInterval = 20;
      PERFORMANCE.particleUpdateInterval = 6;
      
      // Disable heavy visual effects
      if (bloomPass) bloomPass.strength = 0.1;
      if (ssaoPass) ssaoPass.enabled = false;
    }
  }
  
  // Throttle frames for better performance - this significantly reduces CPU load
  if (deltaTime < PERFORMANCE.throttleInterval) {
    return; // Skip this frame
  }
  
  // Performance monitoring
  const frameStartTime = performance.now();
  
  // Distribute operations based on time passed since their last execution
  heavyOperationTimers.culling += deltaTime;
  heavyOperationTimers.particles += deltaTime;
  heavyOperationTimers.propellerEffects += deltaTime;
  heavyOperationTimers.monitoring += deltaTime;
  
  // Step 1: Update Controls - Always do this for responsive camera
  controls.update();
  
  // Step 2: Drone update - essential for gameplay
  updateDrone(currentTime, deltaTime);
  
  // Step 3: Run culling and other expensive operations less frequently
  const cullingInterval = PERFORMANCE.cullingInterval * fpsInterval;
  if (heavyOperationTimers.culling >= cullingInterval) {
    updateSceneObjects();
    heavyOperationTimers.culling = 0;
  }
  
  // Step 4: Run integrated systems updates (can be expensive)
  // Let's do these on alternating frames to spread out the load
  if (cullingFrameCount % 2 === 0) {
    integratedSystems.update(currentTime);
  }
  
  // Step 5: Run particle updates even less frequently
  const particleInterval = PERFORMANCE.particleUpdateInterval * fpsInterval;
  if (heavyOperationTimers.particles >= particleInterval) {
    particleSystem.updateAnimation();
    heavyOperationTimers.particles = 0;
  }
  
  // Step 6: Render - don't use compositor effects in low perf mode
  if (PERFORMANCE.lowPerfMode && PERFORMANCE.deviceTier === 'low') {
    renderer.render(scene, camera);
  } else {
    composer.render();
  }
  
  // Step 7: Performance monitoring and adaptive quality
  const monitoringInterval = PERFORMANCE.monitoringInterval * fpsInterval;
  if (heavyOperationTimers.monitoring >= monitoringInterval) {
    monitorPerformance(frameStartTime);
    heavyOperationTimers.monitoring = 0;
  }
  
  // Update frame counters
  cullingFrameCount++;
  lastFrameTime = currentTime;
  
  // Regularly check panel visibility (every 5 seconds)
  if (currentTime - lastCheckPanelsTime > 5000) {
    checkPanelsVisibility();
    lastCheckPanelsTime = currentTime;
  }
}

// Separate drone update into its own function to improve code organization
function updateDrone(currentTime, deltaTime) {
  // Update drone propellers rotation - this is lightweight and can run every frame
  if (drone.propellers) {
    // Adjust propeller speed based on flight dynamics
    let baseSpeed = droneState.propellerSpeed;
    
    // If flight dynamics is available, adjust propeller speed based on vertical thrust
    if (window.flightDynamics) {
      const flightDynamics = window.flightDynamics;
      const verticalInput = flightDynamics.velocity.y;
      
      // Increase propeller speed with vertical velocity
      baseSpeed += Math.abs(verticalInput) * 0.1;
      
      // Update motor speeds for telemetry less frequently
      if (drone.motorSpeed && cullingFrameCount % 2 === 0) {
        updateMotorSpeeds(flightDynamics, baseSpeed);
      }
    }
    
    // Normalize propeller speed based on delta time for consistent motion regardless of frame rate
    const normalizedSpeed = baseSpeed * (deltaTime / (1000/60));
    
    // Apply propeller rotation - an essential animation
    updatePropellers(normalizedSpeed);
  }
}

// Helper function to update motor speeds
function updateMotorSpeeds(flightDynamics, baseSpeed) {
  const baseRPM = 1000 + Math.abs(flightDynamics.velocity.y) * 3000;
  
  // Add variance based on control inputs
  const pitchFactor = flightDynamics.velocity.z * 500;  // Pitch affects front/back motors
  const rollFactor = flightDynamics.velocity.x * 500;   // Roll affects left/right motors
  const yawFactor = flightDynamics.rotationVelocity.y * 1000; // Yaw affects diagonal motors
  
  // Update each motor RPM (following quadcopter physics)
  // Motor 1: Front Right (CW) - Pitch: -, Roll: +, Yaw: +
  drone.motorSpeed[0] = Math.max(0, baseRPM - pitchFactor + rollFactor + yawFactor);
  
  // Motor 2: Front Left (CCW) - Pitch: -, Roll: -, Yaw: -
  drone.motorSpeed[1] = Math.max(0, baseRPM - pitchFactor - rollFactor - yawFactor);
  
  // Motor 3: Back Right (CCW) - Pitch: +, Roll: +, Yaw: -
  drone.motorSpeed[2] = Math.max(0, baseRPM + pitchFactor + rollFactor - yawFactor);
  
  // Motor 4: Back Left (CW) - Pitch: +, Roll: -, Yaw: +
  drone.motorSpeed[3] = Math.max(0, baseRPM + pitchFactor - rollFactor + yawFactor);
}

// Helper function to update propellers
function updatePropellers(baseSpeed) {
  drone.propellers.forEach((propeller, index) => {
    // Arah putaran sesuai dengan kaidah fisika drone quadcopter
    // Propeller CW berputar searah jarum jam, CCW berputar berlawanan
    if (propeller.userData && propeller.userData.isCW) {
      propeller.rotation.y -= baseSpeed; // Clockwise
    } else {
      propeller.rotation.y += baseSpeed; // Counter-clockwise
    }
    
    // Skip blade opacity updates on most frames to improve performance
    if (cullingFrameCount === 0 && !PERFORMANCE.lowPerfMode) {
      updatePropellerBlades(propeller);
    }
  });
}

// Helper function for propeller blade opacity
function updatePropellerBlades(propeller) {
  // Animasi blur propeller berdasarkan kecepatan
  if (propeller.children && propeller.children.length > 0) {
    propeller.children.forEach(blade => {
      if (drone.motorSpeed && propeller.userData.motorIndex !== undefined) {
        // Scale transparency based on motor speed
        const motorIndex = propeller.userData.motorIndex;
        const rpm = drone.motorSpeed[motorIndex];
        const maxRPM = 5000;
        const minOpacity = 0.3;
        const maxOpacity = 0.9;
        
        if (blade.material) {
          blade.material.transparent = true;
          blade.material.opacity = minOpacity + (1 - Math.min(rpm / maxRPM, 1)) * (maxOpacity - minOpacity);
        }
      }
    });
  }
}

// Helper function for scene objects update and culling
function updateSceneObjects() {
  // Only do expensive LOD in high performance mode
  if (PERFORMANCE.dynamicLOD) {
    // Apply level of detail optimizations
    LOD.applyToScene(scene);
  }
  
  // Create frustum instance for culling
  const frustum = new THREE.Frustum();
  
  // Apply frustum culling - don't render objects outside camera view
  const matrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  frustum.setFromProjectionMatrix(matrix);
  
  // Cache frequently accessed properties
  const camPosition = camera.position;
  
  // Only process objects in chunks to spread processing load
  // We'll use a technique similar to "incremental culling"
  const maxObjectsPerFrame = PERFORMANCE.lowPerfMode ? 30 : 50;
  
  // Get all meshes that are candidates for culling
  if (!window.cullableObjects) {
    // First time, gather all cullable objects
    window.cullableObjects = [];
    // Use faster method for traversal
    const traverseForCulling = function(object) {
      if (object.isMesh && object.userData && !object.userData.essential && !object.userData.neverCull) {
        window.cullableObjects.push(object);
      }
      // Traverse only direct children instead of all descendants
      const children = object.children;
      for (let i = 0, l = children.length; i < l; i++) {
        traverseForCulling(children[i]);
      }
    };
    traverseForCulling(scene);
  }
  
  // Process a subset of objects each time
  if (window.cullableObjects && window.cullableObjects.length > 0) {
    // Determine range of objects to process
    const startIdx = (cullingFrameCount * maxObjectsPerFrame) % window.cullableObjects.length;
    const endIdx = Math.min(startIdx + maxObjectsPerFrame, window.cullableObjects.length);
    
    // Direct array access is faster than using forEach
    for (let i = startIdx; i < endIdx; i++) {
      const object = window.cullableObjects[i];
      if (!object) continue;
      
      // Distance-based culling - quick early rejection test
      // Use squared distance to avoid expensive square root computation
      const dx = camPosition.x - object.position.x;
      const dy = camPosition.y - object.position.y;
      const dz = camPosition.z - object.position.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      
      // Skip objects that are too far (200 * 200 = 40000)
      if (distanceSquared > 40000) {
        if (object.visible) object.visible = false;
        continue;
      }
      
      // Only do frustum culling on nearby objects to save CPU
      const visible = distanceSquared < 10000 ? frustum.intersectsObject(object) : true;
      
      // Only update visibility if it's changed to avoid thrashing
      if (object.visible !== visible) {
        object.visible = visible;
      }
    }
  }
}

// Helper function for performance monitoring
function monitorPerformance(frameStartTime) {
  const frameTime = performance.now() - frameStartTime;
  
  // Only keep the most recent frames
  frameTimes.push(frameTime);
  if (frameTimes.length > 30) { // 30 samples is enough
    frameTimes.shift();
  }
  
  // Get average frame time
  const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
  
  // Check if we need to reduce quality
  if (avgFrameTime > PERFORMANCE.reduceQualityThreshold) {
    if (PERFORMANCE.qualityReductionCooldown <= 0) {
      reduceQuality();
      PERFORMANCE.qualityReductionCooldown = 60; // Wait 60 frames before next reduction
    }
  }
  
  // Decrease cooldown
  if (PERFORMANCE.qualityReductionCooldown > 0) {
    PERFORMANCE.qualityReductionCooldown--;
  }
}

// Helper function to reduce quality
function reduceQuality() {
  if (LOD.enabled && LOD.distanceThresholds.high > 10) {
    // Reduce LOD distances
    LOD.distanceThresholds.high -= 0.5;
    LOD.distanceThresholds.medium -= 1;
    console.log('Reducing quality for better performance');
    
    // Reduce other visual quality as well
    if (bloomPass && bloomPass.strength > 0.05) {
      bloomPass.strength -= 0.02;
    }
    
    // Disable SSAO if we get desperate
    if (ssaoPass && ssaoPass.enabled && LOD.distanceThresholds.high < 15) {
      ssaoPass.enabled = false;
    }
  }
}

// Mark drone as essential to never be culled
drone.userData = { essential: true, neverCull: true };

animate();

// Tambahkan fungsi ini ke welcome screen setup
function setupUIControls() {
  // Setup collapsible panels
  setupCollapsiblePanels();
  
  // Setup draggable panels
  makePanelsDraggable();
  
  // Ensure all panels are visible and properly initialized
  checkPanelsVisibility();
}

// Add a function to check and fix panel visibility issues
function checkPanelsVisibility() {
  const panelIds = [
    'sensor-panel',
    'autopilot-panel',
    'system-status-panel',
    'vision-panel'
  ];
  
  // Check if panels exist and are visible
  let panelsCreated = false;
  
  panelIds.forEach(panelId => {
    const panel = document.getElementById(panelId);
    if (panel) {
      panelsCreated = true;
      // Reset any properties that might be causing invisibility
      panel.style.display = '';
      panel.style.visibility = 'visible';
      panel.style.opacity = '1';
      
      // Ensure content is visible
      const panelContent = Array.from(panel.children).filter(el => el !== panel.querySelector('h3') && el !== panel.firstElementChild);
      panelContent.forEach(element => {
        element.style.display = '';
      });
      
      // Reset collapsed state
      panel.dataset.collapsed = 'false';
      
      // Update toggle icon if it exists
      const toggleIcon = panel.querySelector('.toggle-icon');
      if (toggleIcon) {
        toggleIcon.innerHTML = '&#9650;';
      }
    }
  });
  
  // If no panels found, re-create them
  if (!panelsCreated) {
    console.log('No panels found, recreating...');
    createSensorPanel();
    setTimeout(() => {
      setupWaypointNavigation();
      setupSensorSimulation();
      setupCollapsiblePanels();
      makePanelsDraggable();
    }, 500);
  }
}

// Tambahkan panggilan fungsi setupUIControls setelah semua panel dibuat
function showWelcomeScreen() {
  const welcomeScreen = document.createElement('div');
  welcomeScreen.id = 'welcome-screen';
  welcomeScreen.style.position = 'fixed';
  welcomeScreen.style.top = '0';
  welcomeScreen.style.left = '0';
  welcomeScreen.style.width = '100%';
  welcomeScreen.style.height = '100%';
  welcomeScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
  welcomeScreen.style.color = 'white';
  welcomeScreen.style.display = 'flex';
  welcomeScreen.style.flexDirection = 'column';
  welcomeScreen.style.justifyContent = 'center';
  welcomeScreen.style.alignItems = 'center';
  welcomeScreen.style.padding = '2rem';
  welcomeScreen.style.zIndex = '9999';
  welcomeScreen.style.fontFamily = 'Arial, sans-serif';
  welcomeScreen.style.textAlign = 'center';
  
  welcomeScreen.innerHTML = `
    <div style="max-width: 800px;">
      <h1 style="color: #44AAFF; margin-bottom: 1rem;">Selamat Datang di Simulasi Drone Kandang Ayam</h1>
      
      <p style="margin-bottom: 1.5rem; font-size: 16px; line-height: 1.5;">
        Simulasi ini memungkinkan Anda mengendalikan drone inspeksi di dalam kandang ayam modern.
        Drone dilengkapi dengan sistem posisi indoor, obstacle avoidance, landing otomatis, dan analisis visual.
      </p>
      
      <div style="background-color: rgba(255, 255, 255, 0.1); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
        <h2 style="color: #44AAFF; margin-top: 0; margin-bottom: 1rem; font-size: 20px;">Fitur Utama</h2>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: left;">
          <div>
            <h3 style="color: #44AAFF; margin-bottom: 0.5rem; font-size: 16px;">Navigasi & Kontrol</h3>
            <ul style="padding-left: 1.5rem; margin-top: 0.5rem;">
              <li>Kontrol manual via keyboard</li>
              <li>Mode autopilot dengan waypoints kustom</li>
              <li>Mode patroli otomatis</li>
              <li>Docking & charging otomatis</li>
            </ul>
          </div>
          
          <div>
            <h3 style="color: #44AAFF; margin-bottom: 0.5rem; font-size: 16px;">Sistem Canggih</h3>
            <ul style="padding-left: 1.5rem; margin-top: 0.5rem;">
              <li>Positioning berbasis UWB & visual</li>
              <li>Obstacle avoidance real-time</li>
              <li>Analisis visual distribusi ayam</li>
              <li>Monitoring kondisi kandang</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="background-color: rgba(255, 255, 255, 0.1); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
        <h2 style="color: #44AAFF; margin-top: 0; margin-bottom: 1rem; font-size: 20px;">Kontrol Dasar</h2>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: left;">
          <div>
            <p style="margin: 0; font-weight: bold; color: #44AAFF;">Navigasi Drone:</p>
            <ul style="padding-left: 1.5rem; margin-top: 0.5rem;">
              <li>Panah: Gerak horizontal</li>
              <li>W/S: Naik/Turun</li>
              <li>A/D: Rotasi kiri/kanan</li>
              <li>Shift: Kecepatan tinggi</li>
            </ul>
          </div>
          
          <div>
            <p style="margin: 0; font-weight: bold; color: #44AAFF;">Kamera & Interface:</p>
            <ul style="padding-left: 1.5rem; margin-top: 0.5rem;">
              <li>Mouse klik & drag: Rotasi kamera</li>
              <li>Scroll: Zoom in/out</li>
              <li>Panel sebelah kanan: Data sensor</li>
              <li>Panel sebelah kiri: Status sistem</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="background-color: rgba(255, 255, 255, 0.1); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
        <h2 style="color: #44AAFF; margin-top: 0; margin-bottom: 1rem; font-size: 20px;">Panel UI Bisa Ditutup</h2>
        <p style="margin-bottom: 1rem;">
          Klik pada ikon segitiga di sebelah judul panel untuk membuka/menutup panel. 
          Anda juga bisa menggeser panel dengan klik dan drag di judul panel.
        </p>
      </div>
      
      <button id="start-simulation" style="background-color: #44AAFF; color: white; border: none; padding: 1rem 2rem; font-size: 1.2rem; border-radius: 4px; cursor: pointer; transition: background-color 0.2s;">
        Mulai Simulasi
      </button>
  </div>
  `;
  
  document.body.appendChild(welcomeScreen);
  
  // Add event listener for start button
  document.getElementById('start-simulation').addEventListener('click', () => {
    welcomeScreen.style.opacity = '0';
    welcomeScreen.style.transition = 'opacity 0.5s';
    
    // Initialize panels first for better loading sequence
    createSensorPanel();
    
    setTimeout(() => {
      welcomeScreen.remove();
      
      // Create all panels right after welcome screen is dismissed
      setupUIControls();
      
      // Force panel reset if they're not visible
      setTimeout(() => {
        console.log("Checking panel visibility after welcome screen closed");
        checkPanelsVisibility();
        createHelpIndicator();
      }, 1000);
    }, 500);
  });
}

// Function to create a help indicator
function createHelpIndicator() {
  const helpIndicator = document.createElement('div');
  helpIndicator.style.position = 'fixed';
  helpIndicator.style.bottom = '10px';
  helpIndicator.style.right = '10px';
  helpIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  helpIndicator.style.color = 'white';
  helpIndicator.style.padding = '5px 10px';
  helpIndicator.style.borderRadius = '3px';
  helpIndicator.style.fontSize = '12px';
  helpIndicator.style.zIndex = '9999';
  helpIndicator.style.pointerEvents = 'none';
  helpIndicator.style.opacity = '0.7';
  helpIndicator.textContent = 'Press F9 to reset UI if panels disappear';
  
  document.body.appendChild(helpIndicator);
  
  // Fade out after 10 seconds
  setTimeout(() => {
    helpIndicator.style.transition = 'opacity 1s';
    helpIndicator.style.opacity = '0.2';
  }, 10000);
  
  // Show on hover
  helpIndicator.addEventListener('mouseenter', () => {
    helpIndicator.style.opacity = '0.9';
  });
  
  helpIndicator.addEventListener('mouseleave', () => {
    helpIndicator.style.opacity = '0.2';
  });
}

// Call this function after the welcome screen is dismissed
window.addEventListener('load', () => {
  // Initialize panels first even before showing welcome screen
  // to make sure they're ready when the screen is dismissed
  createSensorPanel();
  
  // Show welcome screen
  showWelcomeScreen();
  
  // Setup UI controls to ensure panels are accessible
  setTimeout(() => {
    // Don't set up UI here, do it after welcome screen is dismissed instead
    // This avoids creating duplicate UI elements
    
    // Add a failsafe check if the user doesn't click the welcome button
    setTimeout(() => {
      const welcomeScreen = document.getElementById('welcome-screen');
      if (welcomeScreen) {
        console.log("Welcome screen still visible after timeout, forcing initialization");
        setupUIControls();
        checkPanelsVisibility();
        createHelpIndicator();
      }
    }, 10000); // 10 second failsafe
  }, 1000);
});

// Clean up resources when page is unloaded
window.addEventListener('beforeunload', () => {
  // Dispose integrated systems
  if (integratedSystems) {
    integratedSystems.dispose();
  }
});

// Setup fungsi untuk collapsible panel UI
function setupCollapsiblePanels() {
  try {
    // Daftar ID panel yang bisa di-collapse
    const panelIds = [
      'sensor-panel',         // Panel telemetri di kanan atas
      'autopilot-panel',      // Panel autopilot di kiri bawah
      'system-status-panel',  // Panel status sistem di kiri
      'vision-panel'          // Panel kamera di bawah
    ];
    
    let setupCount = 0;
    
    panelIds.forEach(panelId => {
      try {
        const panel = document.getElementById(panelId);
        if (!panel) {
          console.log(`Panel with ID ${panelId} not found, will try again later`);
          return; // Skip jika panel tidak ditemukan
        }
        
        setupCount++;
        
        // Ambil header panel (biasanya elemen pertama)
        const header = panel.querySelector('h3') || panel.firstElementChild;
        if (!header) {
          console.log(`Header for panel ${panelId} not found`);
          return;
        }
        
        // Skip if already set up (avoid duplicates)
        if (header.querySelector('.toggle-icon')) {
          return;
        }
        
        // Tambahkan toggle icon
        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'toggle-icon';
        toggleIcon.innerHTML = '&#9650;'; // Unicode untuk triangle up (expanded = true, bisa ditutup)
        toggleIcon.style.marginLeft = '10px';
        toggleIcon.style.cursor = 'pointer';
        toggleIcon.style.fontSize = '12px';
        
        // Simpan referensi ke konten panel (semua kecuali header)
        const panelContent = Array.from(panel.children).filter(el => el !== header);
        
        // Set state awal (expanded)
        panel.dataset.collapsed = 'false';
        
        // Fungsi untuk mengubah status panel
        const togglePanel = (collapse) => {
          panel.dataset.collapsed = String(collapse);
          
          // Update icon: &#9650; = up arrow (bisa ditutup), &#9660; = down arrow (bisa dibuka)
          toggleIcon.innerHTML = collapse ? '&#9660;' : '&#9650;';
          toggleIcon.title = collapse ? 'Klik untuk membuka panel' : 'Klik untuk menutup panel';
          
          // Toggle content visibility
          panelContent.forEach(element => {
            element.style.display = collapse ? 'none' : '';
          });
          
          // Simpan preferensi user di localStorage
          try {
            localStorage.setItem(`${panelId}-collapsed`, collapse);
          } catch (e) {
            console.warn("Could not save panel state to localStorage:", e);
          }
        };
        
        // Tambahkan event listener untuk toggle
        toggleIcon.addEventListener('click', (e) => {
          e.stopPropagation(); // Mencegah event bubbling
          const isCurrentlyCollapsed = panel.dataset.collapsed === 'true';
          togglePanel(!isCurrentlyCollapsed);
        });
        
        // Tambahkan icon ke header
        header.appendChild(toggleIcon);
        
        // Cek localStorage untuk state terakhir
        try {
          const savedState = localStorage.getItem(`${panelId}-collapsed`);
          if (savedState === 'true') {
            // Collapse panel jika sebelumnya disimpan sebagai collapsed
            togglePanel(true);
          }
        } catch (e) {
          console.warn("Could not retrieve panel state from localStorage:", e);
        }
      } catch (error) {
        console.error(`Error setting up collapsible panel ${panelId}:`, error);
      }
    });
    
    // If no panels were successfully set up, retry after a delay
    if (setupCount === 0) {
      console.log("No panels were found, will retry setup in 500ms");
      setTimeout(setupCollapsiblePanels, 500);
    }
  } catch (error) {
    console.error("Error in setupCollapsiblePanels:", error);
  }
}

// Function untuk membuat panel bisa di-drag (opsional)
function makePanelsDraggable() {
  try {
    const panels = document.querySelectorAll('#sensor-panel, #autopilot-panel, #system-status-panel, #vision-panel');
    
    if (panels.length === 0) {
      console.log("No panels found for drag functionality, will retry later");
      setTimeout(makePanelsDraggable, 500);
      return;
    }
    
    panels.forEach(panel => {
      try {
        const header = panel.querySelector('h3') || panel.firstElementChild;
        if (!header) {
          console.log(`No header found for panel ${panel.id}, skipping draggable setup`);
          return;
        }
        
        // Skip if already draggable
        if (panel.dataset.draggable === 'true') {
          return;
        }
        
        // Mark as draggable
        panel.dataset.draggable = 'true';
        
        // Jadikan panel relatif agar bisa di-drag
        panel.style.position = 'absolute';
        
        // Variabel untuk tracking posisi drag
        let isDragging = false;
        let offsetX, offsetY;
        
        // Setup event listener untuk drag
        header.addEventListener('mousedown', (e) => {
          isDragging = true;
          offsetX = e.clientX - panel.getBoundingClientRect().left;
          offsetY = e.clientY - panel.getBoundingClientRect().top;
          
          panel.style.cursor = 'grabbing';
        });
        
        // Event listener untuk menggerakkan panel
        document.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          
          panel.style.left = (e.clientX - offsetX) + 'px';
          panel.style.top = (e.clientY - offsetY) + 'px';
        });
        
        // Event listener untuk berhenti drag
        document.addEventListener('mouseup', () => {
          if (isDragging) {
            isDragging = false;
            panel.style.cursor = 'default';
            
            // Simpan posisi terakhir di localStorage
            try {
              localStorage.setItem(`${panel.id}-position`, JSON.stringify({
                left: panel.style.left,
                top: panel.style.top
              }));
            } catch (e) {
              console.warn("Failed to save panel position to localStorage:", e);
            }
          }
        });
        
        // Restore posisi dari localStorage
        try {
          const savedPosition = localStorage.getItem(`${panel.id}-position`);
          if (savedPosition) {
            try {
              const position = JSON.parse(savedPosition);
              panel.style.left = position.left;
              panel.style.top = position.top;
            } catch (e) {
              console.error('Error parsing saved position', e);
            }
          }
        } catch (e) {
          console.warn("Failed to retrieve panel position from localStorage:", e);
        }
      } catch (error) {
        console.error(`Error making panel ${panel.id} draggable:`, error);
      }
    });
  } catch (error) {
    console.error("Error in makePanelsDraggable:", error);
  }
}

// Add a keyboard shortcut to force reset UI
window.addEventListener('keydown', (e) => {
  // Check if F5 is pressed while holding Alt
  if (e.key === 'F9') {
    forceResetUI();
    e.preventDefault();
  }
});

// Function to force reset all UI panels
function forceResetUI() {
  console.log('Force resetting UI panels...');
  
  // Remove existing panels first
  const existingPanels = document.querySelectorAll('#sensor-panel, #autopilot-panel, #system-status-panel, #vision-panel');
  existingPanels.forEach(panel => {
    panel.remove();
  });
  
  // Recreate all panels
  createSensorPanel();
  
  // Wait a bit for other systems to initialize
  setTimeout(() => {
    setupWaypointNavigation(); // This creates autopilot panel
    setupSensorSimulation();
    
    // Setup panel controls
    setupCollapsiblePanels();
    makePanelsDraggable();
    
    // Final visibility check
    checkPanelsVisibility();
  }, 500);
}

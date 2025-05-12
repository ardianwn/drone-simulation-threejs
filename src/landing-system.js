import * as THREE from 'three';

// Class untuk mengelola sistem landing dan charging otomatis
export class LandingSystem {
  constructor(scene) {
    this.scene = scene;
    this.landingPads = [];
    this.chargingStations = [];
    this.currentPad = null;
    
    // Status sistem
    this.status = {
      isLanding: false,
      isCharging: false,
      targetPad: null,
      landingPhase: 'idle', // 'idle', 'approach', 'descent', 'landed'
      landingProgress: 0,
      chargingProgress: 0,
      chargingRate: 10, // Persen per menit
      lastUpdate: Date.now()
    };
    
    // Konfigurasi sistem
    this.config = {
      enabled: true,
      visualizeHelpers: true,
      landingPadCount: 2,     // Jumlah landing pad di kandang
      approachHeight: 3.0,    // Ketinggian pendekatan dalam meter
      descentSpeed: 0.5,      // Kecepatan turun dalam m/s
      landingPrecision: 0.15, // Presisi landing dalam meter
      chargingEnabled: true,  // Aktifkan fitur charging
      autoCharge: false,      // Otomatis charge ketika baterai rendah
      lowBatteryThreshold: 20 // Persen baterai untuk trigger autoCharge
    };
    
    // Setup landingpad dan charging stations
    this.setupLandingPads();
    
    // Setup update loop
    this.updateInterval = setInterval(() => this.update(), 100);
  }
  
  // Setup landing pad dan charging stations
  setupLandingPads() {
    // Posisi landing pad di kandang
    const padPositions = [
      { x: -40, y: 0.01, z: -40 }, // Pojok depan kiri
      { x: 40, y: 0.01, z: 40 },   // Pojok belakang kanan
    ];
    
    // Buat landing pad
    padPositions.forEach((pos, index) => {
      // Buat landing pad visual
      const padGeometry = new THREE.CylinderGeometry(2, 2, 0.1, 32);
      const padMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x444444,
        emissive: 0x222222
      });
      
      const pad = new THREE.Mesh(padGeometry, padMaterial);
      pad.position.set(pos.x, pos.y, pos.z);
      pad.receiveShadow = true;
      pad.userData = { 
        type: 'landing_pad', 
        id: `pad_${index}`,
        hasChargingStation: true
      };
      
      // Tambahkan marking "H" di tengah
      this.addPadMarkings(pad);
      
      // Tambahkan lampu indikator di sekitar pad
      this.addPadLights(pad);
      
      // Jika pad memiliki charging station, tambahkan
      if (pad.userData.hasChargingStation) {
        this.addChargingStation(pad);
      }
      
      // Tambahkan ke scene dan simpan referensi
      this.scene.add(pad);
      this.landingPads.push(pad);
    });
    
    console.log(`[LandingSystem] ${this.landingPads.length} landing pads configured`);
  }
  
  // Tambahkan marking "H" pada landing pad
  addPadMarkings(pad) {
    // Buat texture dinamis dengan "H"
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    // Gambar lingkaran luar
    context.beginPath();
    context.arc(256, 256, 250, 0, 2 * Math.PI);
    context.strokeStyle = '#FFFFFF';
    context.lineWidth = 20;
    context.stroke();
    
    // Gambar "H"
    context.font = 'bold 300px Arial';
    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('H', 256, 256);
    
    // Apply texture
    const texture = new THREE.CanvasTexture(canvas);
    const markingMaterial = new THREE.MeshBasicMaterial({ 
      map: texture,
      transparent: true
    });
    
    const markingGeometry = new THREE.PlaneGeometry(4, 4);
    const marking = new THREE.Mesh(markingGeometry, markingMaterial);
    marking.rotation.x = -Math.PI / 2; // Horizontal
    marking.position.y = 0.06;  // Sedikit di atas pad
    
    pad.add(marking);
  }
  
  // Tambahkan lampu LED di sekeliling pad
  addPadLights(pad) {
    const lightCount = 16;
    const radius = 1.9;
    
    for (let i = 0; i < lightCount; i++) {
      const angle = (i / lightCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      // Buat geometri lampu
      const lightGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8);
      const lightMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x33FF33, 
        emissive: 0x33FF33,
        emissiveIntensity: 1.0
      });
      
      const light = new THREE.Mesh(lightGeometry, lightMaterial);
      light.position.set(x, 0.05, z);
      light.rotation.x = Math.PI / 2;
      
      // Tambahkan point light
      const pointLight = new THREE.PointLight(0x33FF33, 0.2, 3);
      pointLight.position.set(0, 0.1, 0);
      light.add(pointLight);
      
      // Simpan reference untuk animasi
      light.userData = {
        defaultColor: 0x33FF33,
        chargingColor: 0x3333FF,
        landingColor: 0xFF3333,
        light: pointLight
      };
      
      pad.add(light);
    }
  }
  
  // Tambahkan charging station pada landing pad
  addChargingStation(pad) {
    // Buat base untuk charging station
    const baseGeometry = new THREE.BoxGeometry(1, 0.2, 1);
    const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x555555 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(0, 0.15, -1.5); // Di samping pad
    pad.add(base);
    
    // Tambahkan connector arm
    const armGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
    const armMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.set(0, 0.3, -1.25);
    pad.add(arm);
    
    // Tambahkan connector head
    const headGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
    const headMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x3333FF, 
      emissive: 0x0000FF,
      emissiveIntensity: 0.5
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0.3, -1);
    pad.add(head);
    
    // Tambahkan point light untuk efek charging
    const chargingLight = new THREE.PointLight(0x0000FF, 0.5, 3);
    chargingLight.position.set(0, 0.3, -1);
    pad.add(chargingLight);
    
    // Simpan referensi charging components
    pad.userData.chargingStation = {
      base: base,
      arm: arm,
      head: head,
      light: chargingLight,
      isActive: false
    };
    
    this.chargingStations.push(pad);
  }
  
  // Update status sistem
  update() {
    // Update timestamp
    const now = Date.now();
    const elapsed = (now - this.status.lastUpdate) / 1000; // dalam detik
    this.status.lastUpdate = now;
    
    // Dapatkan drone
    const drone = this.getDroneFromScene();
    if (!drone) return;
    
    // Check battery level untuk auto-charge jika diaktifkan
    if (this.config.autoCharge && 
        drone.sensorData && 
        drone.sensorData.battery < this.config.lowBatteryThreshold &&
        !this.status.isLanding && !this.status.isCharging) {
      // Mulai landing otomatis ke pad terdekat
      const nearestPad = this.findNearestLandingPad(drone.position);
      if (nearestPad) {
        this.initiateAutomaticLanding(drone, nearestPad);
      }
    }
    
    // Update status landing
    if (this.status.isLanding) {
      this.updateLandingSequence(drone, elapsed);
    }
    
    // Update status charging
    if (this.status.isCharging) {
      this.updateChargingStatus(drone, elapsed);
    }
    
    // Update visual effects pada landing pads
    this.updatePadVisuals();
  }
  
  // Temukan landing pad terdekat
  findNearestLandingPad(position) {
    let nearestPad = null;
    let minDistance = Infinity;
    
    this.landingPads.forEach(pad => {
      const dx = pad.position.x - position.x;
      const dz = pad.position.z - position.z;
      const distance = Math.sqrt(dx*dx + dz*dz);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPad = pad;
      }
    });
    
    return nearestPad;
  }
  
  // Mulai sequence landing otomatis
  initiateAutomaticLanding(drone, targetPad) {
    // Set status landing
    this.status.isLanding = true;
    this.status.targetPad = targetPad;
    this.status.landingPhase = 'approach';
    this.status.landingProgress = 0;
    
    console.log(`[LandingSystem] Initiating automatic landing to pad ${targetPad.userData.id}`);
    
    // Disable manual control dan autopilot
    if (window.droneState) {
      window.droneState.manualControlEnabled = false;
      if (window.droneState.autopilot) {
        window.droneState.autopilot.active = false;
        
        // Update UI jika ada
        const toggleButton = document.getElementById('autopilot-toggle');
        if (toggleButton) {
          toggleButton.textContent = 'Aktifkan';
          toggleButton.style.backgroundColor = '#4CAF50';
        }
      }
    }
    
    // Tampilkan notifikasi landing
    this.showLandingNotification();
  }
  
  // Update sequence landing
  updateLandingSequence(drone, elapsed) {
    if (!this.status.targetPad) return;
    
    const padPosition = this.status.targetPad.position;
    const flightDynamics = window.flightDynamics;
    
    if (!flightDynamics) return;
    
    switch (this.status.landingPhase) {
      case 'approach':
        // Approach: gerak horizontal ke atas pad pada ketinggian aman
        const dx = padPosition.x - drone.position.x;
        const dz = padPosition.z - drone.position.z;
        const horizontalDistance = Math.sqrt(dx*dx + dz*dz);
        
        // Adjust altitude to approach height
        const dyApproach = this.config.approachHeight - drone.position.y;
        
        // Apply force based on horizontal position error
        flightDynamics.velocity.x += dx * 0.001;
        flightDynamics.velocity.z += dz * 0.001;
        flightDynamics.velocity.y += dyApproach * 0.001;
        
        // Sedikit damping untuk prevent oscillation
        flightDynamics.velocity.x *= 0.99;
        flightDynamics.velocity.z *= 0.99;
        
        // Rotate drone to face landing pad
        const targetYaw = Math.atan2(dz, dx) - Math.PI/2;
        let yawDiff = targetYaw - drone.rotation.y;
        while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
        while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
        flightDynamics.rotationVelocity.y += yawDiff * 0.01;
        
        // Update progress
        this.status.landingProgress = (1 - Math.min(1, horizontalDistance / 20)) * 50;
        
        // Transition to descent phase when close enough and at right height
        if (horizontalDistance < 0.3 && Math.abs(dyApproach) < 0.2) {
          this.status.landingPhase = 'descent';
          console.log(`[LandingSystem] Transitioning to descent phase`);
        }
        break;
        
      case 'descent':
        // Descent: turun perlahan ke landing pad sambil mempertahankan posisi
        const dxDescent = padPosition.x - drone.position.x;
        const dzDescent = padPosition.z - drone.position.z;
        
        // Apply gentle horizontal correction
        flightDynamics.velocity.x += dxDescent * 0.002;
        flightDynamics.velocity.z += dzDescent * 0.002;
        
        // Apply downward velocity for smooth descent
        flightDynamics.velocity.y = -this.config.descentSpeed * 0.01;
        
        // Update progress (50-100%)
        const altitudeProgress = 1 - Math.min(1, drone.position.y / this.config.approachHeight);
        this.status.landingProgress = 50 + altitudeProgress * 50;
        
        // Check jika drone sudah landing
        if (drone.position.y < 0.5) {
          // Finalize landing
          drone.position.y = 0.5;
          flightDynamics.velocity.x = 0;
          flightDynamics.velocity.y = 0;
          flightDynamics.velocity.z = 0;
          flightDynamics.rotationVelocity.x = 0;
          flightDynamics.rotationVelocity.y = 0;
          flightDynamics.rotationVelocity.z = 0;
          
          // Update status
          this.status.landingPhase = 'landed';
          this.status.landingProgress = 100;
          
          console.log(`[LandingSystem] Drone successfully landed`);
          
          // If landing pad has charging station, initiate charging
          if (this.status.targetPad.userData.hasChargingStation) {
            this.initiateCharging(drone);
          }
        }
        break;
        
      case 'landed':
        // Drone has landed, maintain position
        flightDynamics.velocity.x = 0;
        flightDynamics.velocity.y = 0;
        flightDynamics.velocity.z = 0;
        break;
    }
  }
  
  // Mulai proses charging
  initiateCharging(drone) {
    if (!this.config.chargingEnabled || !drone.sensorData) return;
    
    console.log(`[LandingSystem] Initiating charging sequence`);
    
    // Update charging status
    this.status.isCharging = true;
    this.status.chargingProgress = 0;
    
    // Activate charging station
    if (this.status.targetPad && this.status.targetPad.userData.chargingStation) {
      this.status.targetPad.userData.chargingStation.isActive = true;
      
      // Update charging station visuals
      const chargingStation = this.status.targetPad.userData.chargingStation;
      chargingStation.head.material.emissiveIntensity = 1.0;
      chargingStation.light.intensity = 1.0;
      
      // Animate connector to connect to drone
      this.animateConnector(chargingStation, true);
    }
    
    // Show charging notification
    this.showChargingNotification(drone.sensorData.battery);
    
    // Update battery indicator if exists
    this.updateBatteryUI(drone.sensorData.battery);
  }
  
  // Update status charging
  updateChargingStatus(drone, elapsed) {
    if (!this.status.isCharging || !drone.sensorData) return;
    
    // Calculate charging increment based on rate per minute
    const batteryIncrement = (this.config.chargingRate / 60) * elapsed;
    
    // Update drone battery level
    drone.sensorData.battery = Math.min(100, drone.sensorData.battery + batteryIncrement);
    this.status.chargingProgress = drone.sensorData.battery;
    
    // Update UI
    this.updateBatteryUI(drone.sensorData.battery);
    
    // Check if fully charged
    if (drone.sensorData.battery >= 99.9) {
      console.log(`[LandingSystem] Charging complete, battery at ${drone.sensorData.battery.toFixed(1)}%`);
      
      // Deactivate charging
      this.status.isCharging = false;
      
      if (this.status.targetPad && this.status.targetPad.userData.chargingStation) {
        this.status.targetPad.userData.chargingStation.isActive = false;
        
        // Update charging station visuals
        const chargingStation = this.status.targetPad.userData.chargingStation;
        chargingStation.head.material.emissiveIntensity = 0.5;
        chargingStation.light.intensity = 0.5;
        
        // Animate connector to disconnect from drone
        this.animateConnector(chargingStation, false);
      }
      
      // Re-enable manual control
      if (window.droneState) {
        window.droneState.manualControlEnabled = true;
      }
      
      // Clear landing status
      this.status.isLanding = false;
      this.status.landingPhase = 'idle';
      this.status.targetPad = null;
      
      // Show notification
      this.showChargingCompleteNotification();
    }
  }
  
  // Animate charging connector
  animateConnector(chargingStation, connect) {
    // Animasi connector (in real implementation, would be smoother animation)
    if (connect) {
      // Connect: move connector to drone
      chargingStation.arm.position.z = -1.0;
      chargingStation.head.position.z = -0.75;
    } else {
      // Disconnect: retract connector
      chargingStation.arm.position.z = -1.25;
      chargingStation.head.position.z = -1.0;
    }
  }
  
  // Update visual effects pada landing pads
  updatePadVisuals() {
    this.landingPads.forEach(pad => {
      // Skip if no lights
      if (!pad.children) return;
      
      // Get light status
      const isTargetPad = pad === this.status.targetPad;
      const isLanding = this.status.isLanding;
      const isCharging = this.status.isCharging && isTargetPad;
      
      // Update lights
      pad.children.forEach(child => {
        if (child.userData && child.userData.light) {
          let color;
          
          if (isLanding && isTargetPad && !isCharging) {
            // Landing sequence: red
            color = child.userData.landingColor;
          } else if (isCharging) {
            // Charging: blue
            color = child.userData.chargingColor;
          } else {
            // Default: green
            color = child.userData.defaultColor;
          }
          
          // Update material color
          if (child.material) {
            child.material.color.setHex(color);
            child.material.emissive.setHex(color);
          }
          
          // Update point light color
          if (child.userData.light) {
            child.userData.light.color.setHex(color);
          }
        }
      });
      
      // Animate charging component if active
      if (pad.userData.chargingStation && pad.userData.chargingStation.isActive) {
        const light = pad.userData.chargingStation.light;
        // Pulse effect for charging light
        light.intensity = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
      }
    });
  }
  
  // Tampilkan notifikasi landing
  showLandingNotification() {
    this.showNotification('Memulai landing otomatis...', 'info');
  }
  
  // Tampilkan notifikasi charging
  showChargingNotification(batteryLevel) {
    this.showNotification(`Pengisian baterai dimulai (Level: ${batteryLevel.toFixed(1)}%)`, 'info');
  }
  
  // Tampilkan notifikasi charging selesai
  showChargingCompleteNotification() {
    this.showNotification('Pengisian baterai selesai! Drone siap terbang kembali.', 'success');
  }
  
  // Update UI battery jika ada
  updateBatteryUI(batteryLevel) {
    const batteryLevelElement = document.getElementById('battery-level');
    const batteryBarElement = document.getElementById('battery-bar');
    
    if (batteryLevelElement) {
      batteryLevelElement.textContent = batteryLevel.toFixed(1) + '%';
    }
    
    if (batteryBarElement) {
      batteryBarElement.style.width = batteryLevel + '%';
      
      // Update warna berdasarkan level
      if (batteryLevel > 50) {
        batteryBarElement.style.backgroundColor = '#4CAF50'; // Hijau
      } else if (batteryLevel > 20) {
        batteryBarElement.style.backgroundColor = '#FFC107'; // Kuning
      } else {
        batteryBarElement.style.backgroundColor = '#F44336'; // Merah
      }
    }
  }
  
  // Dapatkan objek drone dari scene
  getDroneFromScene() {
    let found = null;
    this.scene.traverse(object => {
      if (object.userData && (object.userData.type === 'drone' || object.name === 'drone')) {
        found = object;
      }
    });
    return found;
  }
  
  // Helper untuk menampilkan notifikasi
  showNotification(message, type = 'info') {
    // Cek apakah notifikasi container sudah ada
    let notifContainer = document.getElementById('notification-container');
    
    if (!notifContainer) {
      // Buat container untuk notifikasi
      notifContainer = document.createElement('div');
      notifContainer.id = 'notification-container';
      notifContainer.style.position = 'absolute';
      notifContainer.style.top = '80px';
      notifContainer.style.left = '50%';
      notifContainer.style.transform = 'translateX(-50%)';
      notifContainer.style.zIndex = '1000';
      document.body.appendChild(notifContainer);
    }
    
    // Buat notifikasi
    const notification = document.createElement('div');
    notification.className = 'notification ' + type;
    notification.style.backgroundColor = type === 'success' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(33, 150, 243, 0.9)';
    notification.style.color = 'white';
    notification.style.padding = '12px 20px';
    notification.style.marginBottom = '10px';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    notification.style.fontFamily = 'Arial, sans-serif';
    notification.style.fontSize = '14px';
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    notification.style.justifyContent = 'space-between';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    
    // Icon berdasarkan jenis
    const icon = type === 'success' ? '✓' : 'ℹ';
    
    // Content
    notification.innerHTML = `
      <span style="margin-right: 10px; font-weight: bold;">${icon}</span>
      <span style="flex-grow: 1;">${message}</span>
      <span style="margin-left: 10px; cursor: pointer;" onclick="this.parentNode.remove()">✕</span>
    `;
    
    // Tambahkan ke container
    notifContainer.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Auto remove setelah beberapa detik
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 5000);
  }
  
  // Inisiasi takeoff dari landing pad
  initiateTakeoff(targetHeight = 3.0) {
    if (!this.status.isLanding || this.status.landingPhase !== 'landed' || this.status.isCharging) {
      console.log(`[LandingSystem] Cannot takeoff - drone not landed or still charging`);
      return false;
    }
    
    console.log(`[LandingSystem] Initiating takeoff to height ${targetHeight}m`);
    
    // Get drone
    const drone = this.getDroneFromScene();
    if (!drone) return false;
    
    // Clear landing status
    this.status.isLanding = false;
    this.status.landingPhase = 'idle';
    
    // Apply upward force
    const flightDynamics = window.flightDynamics;
    if (flightDynamics) {
      flightDynamics.velocity.y = 0.05;
    }
    
    // Re-enable manual control
    if (window.droneState) {
      window.droneState.manualControlEnabled = true;
    }
    
    // Show notification
    this.showNotification('Takeoff initiated', 'success');
    
    return true;
  }
  
  // Clean up resources saat sistem tidak lagi digunakan
  dispose() {
    clearInterval(this.updateInterval);
    
    // Hapus landing pads dari scene
    this.landingPads.forEach(pad => {
      this.scene.remove(pad);
    });
    
    this.landingPads = [];
    this.chargingStations = [];
  }
} 
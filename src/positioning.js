import * as THREE from 'three';

// Class untuk mengelola sistem positioning drone di dalam kandang
export class PositioningSystem {
  constructor(scene) {
    this.scene = scene;
    this.anchors = [];
    this.markers = [];
    this.positionData = {
      x: 0,
      y: 0,
      z: 0,
      accuracy: 0,
      lastUpdate: Date.now()
    };
    
    // Konfigurasi sistem
    this.config = {
      useUWB: true,          // Gunakan UWB anchors
      useVisualMarkers: true, // Gunakan visual markers
      useOpticalFlow: true,   // Gunakan optical flow
      maxErrorUWB: 0.15,      // Error maksimum UWB dalam meter (15cm)
      maxErrorVisual: 0.05,   // Error maksimum visual dalam meter (5cm)
      updateRate: 20,         // Update rate dalam ms
      optimizationLevel: 'balanced', // 'performance', 'balanced', 'accuracy'
      enabledInSimulation: true // Aktifkan dalam simulasi
    };
    
    // Setup update loop
    this.updateInterval = setInterval(() => this.updatePosition(), this.config.updateRate);
    
    // Setup initial anchors and markers
    if (this.config.enabledInSimulation) {
      this.setupAnchors();
      this.setupVisualMarkers();
    }
  }
  
  // Setup UWB anchors di lokasi strategis kandang
  setupAnchors() {
    // Koordinat untuk 6 anchor di kandang
    const anchorPositions = [
      { x: -45, y: 9, z: -45 }, // Pojok depan kiri
      { x: 45, y: 9, z: -45 },  // Pojok depan kanan
      { x: 45, y: 9, z: 45 },   // Pojok belakang kanan
      { x: -45, y: 9, z: 45 },  // Pojok belakang kiri
      { x: 0, y: 9, z: -45 },   // Tengah depan
      { x: 0, y: 9, z: 45 }     // Tengah belakang
    ];
    
    // Buat anchor untuk UWB positioning
    anchorPositions.forEach((pos, index) => {
      // Buat visual untuk anchor hanya jika dalam simulasi
      if (this.config.enabledInSimulation) {
        const anchorGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const anchorMaterial = new THREE.MeshPhongMaterial({ 
          color: 0x00AAFF,
          emissive: 0x0044FF,
          emissiveIntensity: 0.5
        });
        
        const anchor = new THREE.Mesh(anchorGeometry, anchorMaterial);
        anchor.position.set(pos.x, pos.y, pos.z);
        anchor.userData = { 
          type: 'uwb_anchor', 
          id: `anchor_${index}`,
          range: 100, // Jangkauan dalam meter
          frequency: '6.5GHz',
          txPower: '0dBm'
        };
        
        this.anchors.push(anchor);
        this.scene.add(anchor);
        
        // Tambahkan label untuk anchor (debug)
        this.createAnchorLabel(anchor, index);
      }
    });
    
    console.log(`[Positioning] ${this.anchors.length} UWB anchors configured`);
  }
  
  // Buat label untuk anchor (untuk debugging)
  createAnchorLabel(anchor, index) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.font = '24px Arial';
    context.fillText(`Anchor ${index}`, 10, 30);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(0, 0.5, 0);
    sprite.scale.set(2, 1, 1);
    
    anchor.add(sprite);
  }
  
  // Setup visual markers di langit-langit
  setupVisualMarkers() {
    // Grid 5x5 markers di langit-langit
    const gridSize = 5;
    const spacing = 20;
    
    // Generate marker pattern dengan fiducial markers unik
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = (i - (gridSize-1)/2) * spacing;
        const z = (j - (gridSize-1)/2) * spacing;
        const y = 9.9; // Posisi langit-langit
        
        if (this.config.enabledInSimulation) {
          // Buat visual marker
          const markerGeometry = new THREE.PlaneGeometry(1, 1);
          const canvas = this.generateMarkerPattern(i * gridSize + j);
          const texture = new THREE.CanvasTexture(canvas);
          
          const markerMaterial = new THREE.MeshBasicMaterial({ 
            map: texture,
            side: THREE.DoubleSide
          });
          
          const marker = new THREE.Mesh(markerGeometry, markerMaterial);
          marker.rotation.x = Math.PI / 2; // Horizontal, facing down
          marker.position.set(x, y, z);
          marker.userData = { 
            type: 'visual_marker', 
            id: `marker_${i}_${j}`,
            pattern_id: i * gridSize + j
          };
          
          this.markers.push(marker);
          this.scene.add(marker);
        }
      }
    }
    
    console.log(`[Positioning] ${this.markers.length} visual markers configured`);
  }
  
  // Generate pola marker fiducial
  generateMarkerPattern(id) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Background putih
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 128, 128);
    
    // Border hitam
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 10);
    ctx.fillRect(0, 118, 128, 10);
    ctx.fillRect(0, 0, 10, 128);
    ctx.fillRect(118, 0, 10, 128);
    
    // Buat pola unik berdasarkan ID marker
    const bits = id.toString(2).padStart(16, '0');
    const squareSize = 20;
    const offsetX = 24;
    const offsetY = 24;
    
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const bitIndex = i * 4 + j;
        if (bits[bitIndex] === '1') {
          ctx.fillRect(
            offsetX + j * squareSize, 
            offsetY + i * squareSize, 
            squareSize, 
            squareSize
          );
        }
      }
    }
    
    return canvas;
  }
  
  // Hitung posisi berdasarkan UWB multilateration
  calculateUWBPosition(dronePosition) {
    // Dalam implementasi nyata, ini akan menghitung posisi dari data jarak ke setiap anchor
    // Untuk simulasi, kita tambahkan noise pada posisi sebenarnya
    
    if (!this.config.useUWB) return null;
    
    // Tambahkan noise berdasarkan akurasi UWB
    const noise = () => (Math.random() - 0.5) * 2 * this.config.maxErrorUWB;
    
    return {
      x: dronePosition.x + noise(),
      y: dronePosition.y + noise(),
      z: dronePosition.z + noise(),
      accuracy: Math.random() * this.config.maxErrorUWB,
      source: 'uwb'
    };
  }
  
  // Hitung posisi berdasarkan visual marker
  calculateVisualPosition(dronePosition, cameraPosition) {
    if (!this.config.useVisualMarkers) return null;
    
    // Dalam implementasi nyata, ini akan menganalisis gambar dari kamera
    // Untuk simulasi, kita cek apakah marker terlihat dari posisi drone
    
    // Identifikasi marker terdekat dari posisi drone
    let nearestMarker = null;
    let minDistance = Infinity;
    
    this.markers.forEach(marker => {
      const distance = Math.sqrt(
        Math.pow(dronePosition.x - marker.position.x, 2) +
        Math.pow(dronePosition.z - marker.position.z, 2)
      );
      
      // Cek apakah marker dalam jangkauan kamera atas
      const verticalDistance = marker.position.y - dronePosition.y;
      
      if (distance < minDistance && verticalDistance > 0 && verticalDistance < 10) {
        minDistance = distance;
        nearestMarker = marker;
      }
    });
    
    // Jika tidak ada marker terlihat, kembalikan null
    if (!nearestMarker || minDistance > 15) return null;
    
    // Tambahkan noise berdasarkan akurasi visual positioning
    const noise = () => (Math.random() - 0.5) * 2 * this.config.maxErrorVisual;
    
    return {
      x: dronePosition.x + noise(),
      y: dronePosition.y + noise(),
      z: dronePosition.z + noise(),
      accuracy: Math.random() * this.config.maxErrorVisual,
      source: 'visual',
      markerId: nearestMarker.userData.id
    };
  }
  
  // Update posisi menggunakan sensor fusion dari berbagai sumber
  updatePosition() {
    // Dalam implementasi nyata, ini akan mendapatkan data dari sensor sebenarnya
    // Dalam simulasi, kita gunakan posisi drone untuk simulasi pembacaan sensor
    
    // Dapatkan posisi drone dari simulasi
    const drone = this.getDroneFromScene();
    if (!drone) return;
    
    const dronePosition = {
      x: drone.position.x,
      y: drone.position.y,
      z: drone.position.z
    };
    
    // Dapatkan estimasi posisi dari berbagai sumber
    const uwbPosition = this.calculateUWBPosition(dronePosition);
    const visualPosition = this.calculateVisualPosition(dronePosition, window.camera.position);
    
    // Lakukan sensor fusion untuk mendapatkan estimasi posisi terbaik
    this.positionData = this.fusionAlgorithm(uwbPosition, visualPosition, dronePosition);
    this.positionData.lastUpdate = Date.now();
    
    // Update drone dengan data posisi jika tersedia
    if (drone.sensorData) {
      drone.sensorData.positionAccuracy = this.positionData.accuracy;
      if (this.positionData.source) {
        drone.sensorData.positionSource = this.positionData.source;
      }
    }
  }
  
  // Algoritma fusion untuk menggabungkan data dari berbagai sumber
  fusionAlgorithm(uwbPosition, visualPosition, fallbackPosition) {
    // Jika kedua sumber tersedia, gunakan weighted average berdasarkan akurasi
    if (uwbPosition && visualPosition) {
      // Hitung bobot berdasarkan akurasi (1/error), sehingga akurasi lebih tinggi mendapat bobot lebih besar
      const uwbWeight = 1 / uwbPosition.accuracy;
      const visualWeight = 1 / visualPosition.accuracy;
      const totalWeight = uwbWeight + visualWeight;
      
      return {
        x: (uwbPosition.x * uwbWeight + visualPosition.x * visualWeight) / totalWeight,
        y: (uwbPosition.y * uwbWeight + visualPosition.y * visualWeight) / totalWeight,
        z: (uwbPosition.z * uwbWeight + visualPosition.z * visualWeight) / totalWeight,
        accuracy: 1 / totalWeight, // Akurasi gabungan
        source: 'fusion'
      };
    }
    // Jika hanya UWB yang tersedia
    else if (uwbPosition) {
      return uwbPosition;
    }
    // Jika hanya visual yang tersedia
    else if (visualPosition) {
      return visualPosition;
    }
    // Jika tidak ada yang tersedia, gunakan fallback (IMU/dead reckoning)
    else {
      return {
        x: fallbackPosition.x,
        y: fallbackPosition.y,
        z: fallbackPosition.z,
        accuracy: 0.5, // Akurasi lebih rendah untuk dead reckoning
        source: 'imu'
      };
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
  
  // Mendapatkan data posisi terkini
  getPositionData() {
    return this.positionData;
  }
  
  // Clean up resources saat sistem tidak lagi digunakan
  dispose() {
    clearInterval(this.updateInterval);
    
    // Hapus anchors dan markers dari scene
    this.anchors.forEach(anchor => {
      this.scene.remove(anchor);
    });
    
    this.markers.forEach(marker => {
      this.scene.remove(marker);
    });
    
    this.anchors = [];
    this.markers = [];
  }
} 
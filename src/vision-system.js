import * as THREE from 'three';

// Class untuk mengelola sistem kamera dan analisis visual
export class VisionSystem {
  constructor(scene, drone) {
    this.scene = scene;
    this.drone = drone;
    this.cameras = [];
    this.analysisResults = {
      chickenCount: 0,
      chickenDistribution: {},
      detectedIssues: [],
      densityMap: null,
      lastAnalysis: Date.now(),
      processingStatus: 'idle' // 'idle', 'processing', 'complete'
    };
    
    // Konfigurasi sistem
    this.config = {
      enabled: true,
      camerasEnabled: {
        main: true,     // Kamera depan HD
        bottom: true,   // Kamera bawah untuk optical flow
        thermal: true,  // Kamera thermal
      },
      captureInterval: 500,   // Interval capture gambar (ms)
      analysisInterval: 5000,  // Interval analisis (ms)
      processingDelay: 300,    // Waktu yang dibutuhkan untuk processing (simulasi, ms)
      visualizeOverlay: true,  // Tampilkan overlay hasil analisis
      enabledInSimulation: true, // Aktifkan dalam simulasi
      showCameraFeeds: true      // Tampilkan feed kamera
    };
    
    // Deteksi performa rendah dan sesuaikan pengaturan
    this.detectPerformanceSettings();
    
    // Setup kamera
    this.setupCameras();
    
    // Buat batch sistem untuk mengelola interval
    this.createIntervals();
    
    // Setup camera views jika diaktifkan
    if (this.config.showCameraFeeds) {
      this.createCameraViews();
    }
    
    // Simpan timestamp terakhir untuk throttling
    this.lastRenderTime = 0;
    this.lastAnalysisTime = 0;
    this.frameSkipCount = 0;
  }
  
  // Deteksi pengaturan performa dari konfigurasi global
  detectPerformanceSettings() {
    // Periksa apakah objek PERFORMANCE ada
    const isLowPerf = window.PERFORMANCE && window.PERFORMANCE.lowPerfMode;
    
    if (isLowPerf) {
      // Kurangi interval dan kompleksitas untuk mode performa rendah
      this.config.captureInterval = Math.max(1000, this.config.captureInterval * 1.5);
      this.config.analysisInterval = Math.max(8000, this.config.analysisInterval * 1.5);
      
      // Nonaktifkan beberapa fitur pada perangkat rendah
      if (window.PERFORMANCE.deviceTier === 'low') {
        this.config.camerasEnabled.thermal = false;
        this.config.visualizeOverlay = false;
      }
    }
  }
  
  // Buat interval terkelola untuk capture dan analisis
  createIntervals() {
    // Gunakan requestAnimationFrame alih-alih interval jika tersedia
    // untuk menghindari callback yang tumpang tindih
    if (window.requestAnimationFrame && this.config.enabledInSimulation) {
      // Schedule next capture berdasarkan waktu
      this.scheduleNextCapture();
      this.scheduleNextAnalysis();
    } else {
      // Fallback ke interval tradisional jika tidak dalam simulasi
      this.captureInterval = setInterval(() => this.throttledCapture(), this.config.captureInterval);
      this.analysisInterval = setInterval(() => this.throttledAnalysis(), this.config.analysisInterval);
    }
  }
  
  // Schedule capture dengan requestAnimationFrame
  scheduleNextCapture() {
    const currentTime = performance.now();
    const elapsed = currentTime - this.lastRenderTime;
    
    if (elapsed >= this.config.captureInterval) {
      // Waktu untuk capture
      this.throttledCapture();
      this.lastRenderTime = currentTime;
    }
    
    // Schedule next check
    requestAnimationFrame(() => this.scheduleNextCapture());
  }
  
  // Schedule analisis dengan requestAnimationFrame
  scheduleNextAnalysis() {
    const currentTime = performance.now();
    const elapsed = currentTime - this.lastAnalysisTime;
    
    if (elapsed >= this.config.analysisInterval) {
      // Waktu untuk analisis
      this.throttledAnalysis();
      this.lastAnalysisTime = currentTime;
    }
    
    // Schedule next check
    requestAnimationFrame(() => this.scheduleNextAnalysis());
  }
  
  // Throttled capture untuk menghindari overhead
  throttledCapture() {
    // Skip frame jika tab tidak aktif
    if (document.hidden) return;
    
    // Skip beberapa frame pada perangkat rendah
    if (window.PERFORMANCE && window.PERFORMANCE.lowPerfMode) {
      this.frameSkipCount++;
      if (this.frameSkipCount % 2 !== 0) return; // Skip setiap frame kedua
    }
    
    // Lakukan capture
    this.captureImages();
  }
  
  // Throttled analisis untuk menghindari overhead
  throttledAnalysis() {
    // Skip jika tab tidak aktif
    if (document.hidden) return;
    
    // Skip jika CPU sudah di bawah tekanan
    if (window.PERFORMANCE && window.PERFORMANCE.currentLoad > 0.8) {
      console.warn("[VisionSystem] Skipping analysis due to high CPU load");
      return;
    }
    
    // Lakukan analisis
    this.analyzeImages();
  }
  
  // Setup kamera pada drone
  setupCameras() {
    if (!this.config.enabled) return;
    
    // Kamera utama (depan)
    if (this.config.camerasEnabled.main) {
      const mainCamera = this.createCamera({
        position: { x: 0, y: 0.1, z: 0.7 },
        rotation: { x: -0.5, y: 0, z: 0 },
        fov: 90,
        type: 'main',
        color: 0xAAAAAA,
        name: 'HD Camera'
      });
      this.cameras.push(mainCamera);
    }
    
    // Kamera bawah untuk optical flow
    if (this.config.camerasEnabled.bottom) {
      const bottomCamera = this.createCamera({
        position: { x: 0, y: -0.2, z: 0 },
        rotation: { x: Math.PI, y: 0, z: 0 },
        fov: 120,
        type: 'bottom',
        color: 0x888888,
        name: 'Flow Camera'
      });
      this.cameras.push(bottomCamera);
    }
    
    // Kamera thermal
    if (this.config.camerasEnabled.thermal) {
      const thermalCamera = this.createCamera({
        position: { x: 0.2, y: 0.1, z: 0.7 },
        rotation: { x: -0.5, y: 0.1, z: 0 },
        fov: 70,
        type: 'thermal',
        color: 0xDD7700,
        name: 'Thermal'
      });
      this.cameras.push(thermalCamera);
    }
    
    console.log(`[VisionSystem] ${this.cameras.length} cameras configured`);
  }
  
  // Helper untuk membuat kamera
  createCamera(options) {
    const { position, rotation, fov, type, color, name } = options;
    
    // Jika dalam simulasi, buat representasi visual kamera
    if (this.config.enabledInSimulation) {
      // Base kamera
      const cameraGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const cameraMaterial = new THREE.MeshPhongMaterial({ color });
      
      const cameraObj = new THREE.Mesh(cameraGeometry, cameraMaterial);
      cameraObj.position.set(position.x, position.y, position.z);
      cameraObj.rotation.set(rotation.x, rotation.y, rotation.z);
      
      // Tambahkan lens
      const lensGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 16);
      const lensMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x000088,
        transparent: true,
        opacity: 0.7,
        shininess: 100
      });
      
      const lens = new THREE.Mesh(lensGeometry, lensMaterial);
      lens.rotation.x = Math.PI/2;
      lens.position.z = 0.15;
      cameraObj.add(lens);
      
      // Tambahkan label
      if (name) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.font = '12px Arial';
        context.fillText(name, 10, 20);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(0, 0.15, 0);
        sprite.scale.set(0.5, 0.25, 1);
        
        cameraObj.add(sprite);
      }
      
      // Set user data
      cameraObj.userData = { 
        type: 'camera', 
        cameraType: type,
        fov: fov,
        resolution: type === 'main' ? '1920x1080' : '640x480',
        isCapturing: false
      };
      
      this.drone.add(cameraObj);
      
      return cameraObj;
    }
    
    // Jika tidak dalam simulasi, kembalikan objek data sederhana
    return {
      type: type,
      fov: fov,
      resolution: type === 'main' ? '1920x1080' : '640x480',
      position: { ...position },
      rotation: { ...rotation }
    };
  }
  
  // Capture gambar dari kamera
  captureImages() {
    if (!this.config.enabled) return;
    
    // Dalam implementasi nyata, ini akan mengambil gambar sebenarnya
    // Dalam simulasi, kita simulasikan proses pengambilan gambar
    
    this.cameras.forEach(camera => {
      // Simulate capture
      if (camera.userData) {
        camera.userData.isCapturing = true;
        
        // Update view untuk kamera jika tersedia
        if (this.config.showCameraFeeds && camera.userData.view) {
          // Dapatkan posisi dan rotasi terbaru
          const worldPos = new THREE.Vector3();
          camera.getWorldPosition(worldPos);
          
          const worldRot = new THREE.Quaternion();
          camera.getWorldQuaternion(worldRot);
          
          // Update kamera pandangan
          camera.userData.view.viewCamera.position.copy(worldPos);
          camera.userData.view.viewCamera.quaternion.copy(worldRot);
          
          // Render dengan efek flash
          if (camera.userData.cameraType === 'thermal') {
            camera.userData.view.canvas.style.filter = 'brightness(1.3) contrast(1.3) hue-rotate(5deg)';
          } else {
            camera.userData.view.canvas.style.filter = 'brightness(1.2) contrast(1.2)';
          }
          
          // Render frame
          this.updateCameraView(camera);
        }
        
        // Reset after brief flash effect
        setTimeout(() => {
          if (camera && camera.userData) {
            camera.userData.isCapturing = false;
            
            // Reset filter
            if (camera.userData.view && camera.userData.view.canvas) {
              camera.userData.view.canvas.style.filter = '';
            }
          }
        }, 150);
      }
    });
  }
  
  // Helper untuk update satu tampilan kamera
  updateCameraView(camera) {
    if (!camera.userData || !camera.userData.view) return;
    
    const view = camera.userData.view;
    
    // Render berdasarkan jenis kamera
    if (camera.userData.cameraType === 'thermal') {
      this.renderThermalView(camera, view);
    } else {
      // Kamera normal
      view.renderer.render(this.scene, view.viewCamera);
    }
  }
  
  // Render tampilan thermal
  renderThermalView(camera, view) {
    // Simpan material asli
    const originalMaterials = new Map();
    
    // Ubah material untuk tampilan thermal
    this.scene.traverse(object => {
      if (object.isMesh && object.material) {
        // Simpan material asli
        originalMaterials.set(object, object.material);
        
        // Tentukan warna thermal berdasarkan jenis objek
        if (object.userData && object.userData.type === 'chicken') {
          // Ayam tampak panas (merah-orange)
          object.material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(0xFF3300), 
            fog: false 
          });
        } else if (object.userData && object.userData.material === 'metal') {
          // Metal reflektif (biru dingin)
          object.material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(0x223366), 
            fog: false 
          });
        } else if (object.userData && object.userData.type === 'wall') {
          // Dinding menampilkan perbedaan suhu
          object.material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(0x002244), 
            fog: false 
          });
        } else {
          // Default (biru sangat gelap)
          object.material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(0x001122), 
            fog: false 
          });
        }
      }
    });
    
    // Render dengan material thermal
    view.renderer.setClearColor(0x000000);
    view.renderer.render(this.scene, view.viewCamera);
    
    // Kembalikan material asli
    originalMaterials.forEach((material, object) => {
      object.material = material;
    });
  }
  
  // Analisis gambar dari kamera
  analyzeImages() {
    if (!this.config.enabled) return;
    
    // Batasi analisis jika performa rendah
    const now = performance.now();
    if (now - this.analysisResults.lastAnalysis < this.config.analysisInterval * 0.9) {
      return; // Terlalu cepat untuk analisis baru
    }
    
    // Track start time untuk monitoring performa
    const startTime = performance.now();
    
    // Set status processing
    this.analysisResults.processingStatus = 'processing';
    
    // Simulasikan delay pemrosesan
    setTimeout(() => {
      try {
        // Dapatkan semua chicken dari scene (cache hasil jika memungkinkan)
        const chickens = this.findChickensInScene();
        
        // Hitung jumlah dan distribusi ayam
        this.analysisResults.chickenCount = chickens.length;
        
        // Mengurangi ukuran grid untuk performa rendah
        const isLowPerf = window.PERFORMANCE && window.PERFORMANCE.lowPerfMode;
        const gridSize = isLowPerf ? 5 : 10; // Lebih kecil untuk performa rendah
        
        // Buat density map dengan grid yang sesuai performa
        const densityMap = this.createDensityMap(chickens, gridSize);
        this.analysisResults.densityMap = densityMap;
        
        // Analisis distribusi (sector-based)
        const distribution = this.analyzeDistribution(densityMap);
        this.analysisResults.chickenDistribution = distribution;
        
        // Deteksi potential issues berdasarkan distribusi
        const issues = this.detectIssues(distribution, densityMap);
        this.analysisResults.detectedIssues = issues;
        
        // Update timestamp dan status
        this.analysisResults.lastAnalysis = now;
        this.analysisResults.processingStatus = 'complete';
        
        // Jika ada UI dan performa cukup, update UI
        if (!isLowPerf || Math.random() < 0.5) {
          this.updateAnalysisUI();
        }
        
        // Jika visualisasi enabled, update overlay
        // Tapi hanya jika performa memungkinkan
        if (this.config.visualizeOverlay && (!isLowPerf || this.frameSkipCount % 3 === 0)) {
          this.updateVisualization();
        }
        
        // Monitor execution time
        const executionTime = performance.now() - startTime;
        if (executionTime > 50) {
          console.warn(`[VisionSystem] Analysis took ${executionTime.toFixed(1)}ms to complete`);
        }
      } catch (error) {
        console.error("[VisionSystem] Error during analysis:", error);
        this.analysisResults.processingStatus = 'error';
      }
    }, this.config.processingDelay);
  }
  
  // Cari semua chicken di scene
  findChickensInScene() {
    const chickens = [];
    
    this.scene.traverse(object => {
      if (object.userData && object.userData.type === 'chicken') {
        chickens.push(object);
      }
    });
    
    return chickens;
  }
  
  // Buat density map untuk distribusi ayam
  createDensityMap(chickens, gridSize = 10) {
    // Ukuran kandang sekitar 90x90, kita buat grid berdasarkan parameter
    const cellSize = 90 / gridSize;
    
    // Initialize density map
    const densityMap = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
    
    // Hitung chickens per cell
    chickens.forEach(chicken => {
      // Convert world position to grid cell
      const x = Math.floor((chicken.position.x + 45) / cellSize);
      const z = Math.floor((chicken.position.z + 45) / cellSize);
      
      // Ensure within bounds
      if (x >= 0 && x < gridSize && z >= 0 && z < gridSize) {
        densityMap[z][x]++;
      }
    });
    
    return densityMap;
  }
  
  // Analisis distribusi berdasarkan density map
  analyzeDistribution(densityMap) {
    // Bagi kandang menjadi 4 sektor (NW, NE, SW, SE)
    const gridSize = densityMap.length;
    const halfGrid = Math.floor(gridSize / 2);
    
    // Hitung jumlah ayam per sektor
    const sectors = {
      NW: 0, // Northwest
      NE: 0, // Northeast
      SW: 0, // Southwest
      SE: 0  // Southeast
    };
    
    // Calculate sum for each sector
    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const count = densityMap[z][x];
        
        if (z < halfGrid && x < halfGrid) {
          sectors.NW += count;
        } else if (z < halfGrid && x >= halfGrid) {
          sectors.NE += count;
        } else if (z >= halfGrid && x < halfGrid) {
          sectors.SW += count;
        } else {
          sectors.SE += count;
        }
      }
    }
    
    // Calculate total and percentages
    const total = sectors.NW + sectors.NE + sectors.SW + sectors.SE;
    
    const distribution = {
      total: total,
      sectors: {
        NW: { count: sectors.NW, percentage: total > 0 ? (sectors.NW / total * 100) : 0 },
        NE: { count: sectors.NE, percentage: total > 0 ? (sectors.NE / total * 100) : 0 },
        SW: { count: sectors.SW, percentage: total > 0 ? (sectors.SW / total * 100) : 0 },
        SE: { count: sectors.SE, percentage: total > 0 ? (sectors.SE / total * 100) : 0 }
      },
      evenness: 0,
      hotspots: []
    };
    
    // Calculate distribution evenness (0-100, where 100 is perfectly even)
    const idealPercentage = 25; // 25% per sector for perfect distribution
    const deviations = [
      Math.abs(distribution.sectors.NW.percentage - idealPercentage),
      Math.abs(distribution.sectors.NE.percentage - idealPercentage),
      Math.abs(distribution.sectors.SW.percentage - idealPercentage),
      Math.abs(distribution.sectors.SE.percentage - idealPercentage)
    ];
    
    const avgDeviation = deviations.reduce((sum, val) => sum + val, 0) / 4;
    distribution.evenness = Math.max(0, 100 - avgDeviation);
    
    // Find hotspots (areas with high concentration)
    const avgDensity = total / (gridSize * gridSize);
    const hotspotThreshold = avgDensity * 2; // 2x average is a hotspot
    
    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        if (densityMap[z][x] > hotspotThreshold) {
          // Convert grid position to world coordinates
          const worldX = (x * (90/gridSize)) - 45 + (90/gridSize/2);
          const worldZ = (z * (90/gridSize)) - 45 + (90/gridSize/2);
          
          distribution.hotspots.push({
            position: { x: worldX, z: worldZ },
            count: densityMap[z][x],
            intensity: densityMap[z][x] / hotspotThreshold
          });
        }
      }
    }
    
    return distribution;
  }
  
  // Deteksi masalah berdasarkan distribusi
  detectIssues(distribution, densityMap) {
    const issues = [];
    
    // Check for uneven distribution
    if (distribution.evenness < 70) {
      issues.push({
        type: 'uneven_distribution',
        severity: (70 - distribution.evenness) / 70, // 0-1 scale
        description: `Distribusi ayam tidak merata (${distribution.evenness.toFixed(1)}% evenness)`,
        location: this.findProblemLocation(distribution)
      });
    }
    
    // Check for overcrowding
    if (distribution.hotspots.length > 0) {
      distribution.hotspots.forEach(hotspot => {
        issues.push({
          type: 'overcrowding',
          severity: Math.min(1, (hotspot.intensity - 1) / 3),
          description: `Kepadatan tinggi terdeteksi (${hotspot.count} ayam)`,
          location: { x: hotspot.position.x, z: hotspot.position.z }
        });
      });
    }
    
    // Check for empty areas (potential environmental issues)
    const emptyCount = this.countEmptyCells(densityMap);
    const totalCells = densityMap.length * densityMap[0].length;
    const emptyPercentage = (emptyCount / totalCells) * 100;
    
    if (emptyPercentage > 40) {
      issues.push({
        type: 'unused_space',
        severity: Math.min(1, (emptyPercentage - 40) / 60),
        description: `${emptyPercentage.toFixed(1)}% area kandang tidak digunakan`,
        location: this.findEmptyCenter(densityMap)
      });
    }
    
    return issues;
  }
  
  // Helper untuk menemukan lokasi masalah
  findProblemLocation(distribution) {
    // Find sector with lowest population
    let minSector = 'NW';
    let minPercentage = distribution.sectors.NW.percentage;
    
    Object.keys(distribution.sectors).forEach(sector => {
      if (distribution.sectors[sector].percentage < minPercentage) {
        minPercentage = distribution.sectors[sector].percentage;
        minSector = sector;
      }
    });
    
    // Convert sector to approximate position
    const positions = {
      NW: { x: -22.5, z: -22.5 },
      NE: { x: 22.5, z: -22.5 },
      SW: { x: -22.5, z: 22.5 },
      SE: { x: 22.5, z: 22.5 }
    };
    
    return positions[minSector];
  }
  
  // Helper untuk menghitung sel kosong
  countEmptyCells(densityMap) {
    let emptyCount = 0;
    
    for (let z = 0; z < densityMap.length; z++) {
      for (let x = 0; x < densityMap[z].length; x++) {
        if (densityMap[z][x] === 0) {
          emptyCount++;
        }
      }
    }
    
    return emptyCount;
  }
  
  // Helper untuk menemukan pusat area kosong
  findEmptyCenter(densityMap) {
    // Find largest contiguous empty area
    // Simplified: just return the center of the first empty cell
    for (let z = 0; z < densityMap.length; z++) {
      for (let x = 0; x < densityMap[z].length; x++) {
        if (densityMap[z][x] === 0) {
          // Convert to world coordinates
          const gridSize = densityMap.length;
          const worldX = (x * (90/gridSize)) - 45 + (90/gridSize/2);
          const worldZ = (z * (90/gridSize)) - 45 + (90/gridSize/2);
          
          return { x: worldX, z: worldZ };
        }
      }
    }
    
    // Default to center if no empty cells
    return { x: 0, z: 0 };
  }
  
  // Update UI dengan hasil analisis
  updateAnalysisUI() {
    // Skip jika tab tidak aktif
    if (document.hidden) return;
    
    // Find or create analysis UI
    let analysisPanel = document.getElementById('analysis-panel');
    
    if (!analysisPanel && this.config.enabledInSimulation) {
      // Create panel
      analysisPanel = document.createElement('div');
      analysisPanel.id = 'analysis-panel';
      analysisPanel.style.position = 'absolute';
      analysisPanel.style.bottom = '20px';
      analysisPanel.style.right = '20px';
      analysisPanel.style.width = '300px';
      analysisPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      analysisPanel.style.color = 'white';
      analysisPanel.style.padding = '15px';
      analysisPanel.style.borderRadius = '5px';
      analysisPanel.style.fontFamily = 'Arial, sans-serif';
      analysisPanel.style.fontSize = '14px';
      analysisPanel.style.zIndex = '1000';
      
      document.body.appendChild(analysisPanel);
    }
    
    if (analysisPanel) {
      // Throttle updates pada performa rendah
      if (window.PERFORMANCE && window.PERFORMANCE.lowPerfMode && Math.random() > 0.3) {
        // Hanya update 30% waktu pada mode performa rendah
        return;
      }
      
      // Update content
      const results = this.analysisResults;
      
      // Format distribution data
      const distribution = results.chickenDistribution;
      const sectors = distribution ? distribution.sectors : { NW: {}, NE: {}, SW: {}, SE: {} };
      
      // Format issues
      let issuesHtml = '';
      if (results.detectedIssues && results.detectedIssues.length > 0) {
        results.detectedIssues.forEach(issue => {
          const color = issue.severity > 0.7 ? '#FF5252' : (issue.severity > 0.3 ? '#FFC107' : '#8BC34A');
          issuesHtml += `<div style="margin-top: 5px; color: ${color};">• ${issue.description}</div>`;
        });
      } else {
        issuesHtml = '<div style="margin-top: 5px; color: #8BC34A;">• Tidak ada masalah terdeteksi</div>';
      }
      
      // Update HTML
      analysisPanel.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
          <h3 style="margin: 0; color: #44AAFF;">Analisis Visual</h3>
          <div style="text-align: right; font-size: 12px; color: #CCC;">
            ${results.processingStatus === 'processing' ? 'Memproses...' : 'Terakhir: ' + new Date(results.lastAnalysis).toLocaleTimeString()}
          </div>
        </div>
        
        <div style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
            <span>Jumlah Ayam Terdeteksi:</span>
            <span style="font-weight: bold;">${results.chickenCount}</span>
          </div>
          
          <div style="font-size: 12px; color: #CCC; margin-bottom: 5px;">Distribusi Sektor:</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; grid-gap: 5px; margin-bottom: 8px;">
            <div style="background-color: rgba(255,255,255,0.1); padding: 5px; text-align: center; border-radius: 3px;">
              NW: ${sectors.NW.count || 0} (${(sectors.NW.percentage || 0).toFixed(1)}%)
            </div>
            <div style="background-color: rgba(255,255,255,0.1); padding: 5px; text-align: center; border-radius: 3px;">
              NE: ${sectors.NE.count || 0} (${(sectors.NE.percentage || 0).toFixed(1)}%)
            </div>
            <div style="background-color: rgba(255,255,255,0.1); padding: 5px; text-align: center; border-radius: 3px;">
              SW: ${sectors.SW.count || 0} (${(sectors.SW.percentage || 0).toFixed(1)}%)
            </div>
            <div style="background-color: rgba(255,255,255,0.1); padding: 5px; text-align: center; border-radius: 3px;">
              SE: ${sectors.SE.count || 0} (${(sectors.SE.percentage || 0).toFixed(1)}%)
            </div>
          </div>
          
          <div style="font-size: 12px; color: #CCC; margin-bottom: 5px;">Distribusi Merata:</div>
          <div style="height: 10px; background-color: #333; border-radius: 5px; overflow: hidden; margin-bottom: 5px;">
            <div style="height: 100%; width: ${distribution ? distribution.evenness : 0}%; background-color: ${
            distribution && distribution.evenness > 80 ? '#4CAF50' : 
            (distribution && distribution.evenness > 60 ? '#FFC107' : '#F44336')
            };"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #AAA;">
            <span>0%</span>
            <span>${distribution ? distribution.evenness.toFixed(1) + '%' : '0%'}</span>
            <span>100%</span>
          </div>
        </div>
        
        <div>
          <div style="font-size: 12px; color: #CCC; margin-bottom: 5px;">Masalah Terdeteksi:</div>
          ${issuesHtml}
        </div>
      `;
    }
  }
  
  // Update visualisasi overlay
  updateVisualization() {
    // Remove existing visualization
    this.clearVisualization();
    
    if (!this.config.visualizeOverlay || !this.analysisResults.densityMap) return;
    
    // Create visualization container if not exists
    let visualizationContainer = this.scene.getObjectByName('density-visualization');
    
    if (!visualizationContainer) {
      visualizationContainer = new THREE.Group();
      visualizationContainer.name = 'density-visualization';
      this.scene.add(visualizationContainer);
    }
    
    // Create heatmap based on density
    const densityMap = this.analysisResults.densityMap;
    const gridSize = densityMap.length;
    const cellSize = 90 / gridSize;
    
    // Find max density for scaling
    let maxDensity = 0;
    densityMap.forEach(row => {
      row.forEach(cell => {
        maxDensity = Math.max(maxDensity, cell);
      });
    });
    
    // Create visualization for each cell
    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const density = densityMap[z][x];
        
        if (density > 0) {
          // Convert to world coordinates
          const worldX = (x * cellSize) - 45 + (cellSize/2);
          const worldZ = (z * cellSize) - 45 + (cellSize/2);
          
          // Create visualization element
          const intensity = density / maxDensity;
          const hue = 120 - (intensity * 120); // 120 (green) to 0 (red)
          const color = new THREE.Color(`hsl(${hue}, 100%, 50%)`);
          
          const size = Math.max(0.5, Math.min(3, intensity * 2 + 0.5));
          const height = Math.max(0.1, intensity * 0.5);
          
          const cellGeometry = new THREE.BoxGeometry(cellSize * 0.8, height, cellSize * 0.8);
          const cellMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6
          });
          
          const cell = new THREE.Mesh(cellGeometry, cellMaterial);
          cell.position.set(worldX, height/2, worldZ);
          
          visualizationContainer.add(cell);
        }
      }
    }
    
    // Add issue markers
    this.addIssueMarkers(visualizationContainer);
  }
  
  // Tambahkan marker untuk issue terdeteksi
  addIssueMarkers(container) {
    if (!this.analysisResults.detectedIssues) return;
    
    this.analysisResults.detectedIssues.forEach(issue => {
      if (!issue.location) return;
      
      // Create marker
      const markerGeometry = new THREE.ConeGeometry(0.5, 2, 8);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: issue.severity > 0.7 ? 0xFF0000 : (issue.severity > 0.3 ? 0xFFAA00 : 0xFFFF00),
        transparent: true,
        opacity: 0.8
      });
      
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(issue.location.x, 1, issue.location.z);
      
      // Add floating animation
      marker.userData = {
        animation: {
          baseY: 1,
          phase: Math.random() * Math.PI * 2,
          update: function(time) {
            marker.position.y = this.baseY + Math.sin(time * 0.002 + this.phase) * 0.3;
            marker.rotation.y += 0.01;
          }
        }
      };
      
      container.add(marker);
      
      // Add text label
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.font = '16px Arial';
      context.textAlign = 'center';
      context.fillText(issue.description, 128, 64);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true
      });
      
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(0, 2, 0);
      sprite.scale.set(5, 2.5, 1);
      
      marker.add(sprite);
    });
  }
  
  // Clear existing visualization
  clearVisualization() {
    const visualizationContainer = this.scene.getObjectByName('density-visualization');
    if (visualizationContainer) {
      this.scene.remove(visualizationContainer);
    }
  }
  
  // Membuat tampilan dari kamera drone
  createCameraViews() {
    if (!this.config.enabledInSimulation || !this.config.showCameraFeeds) return;
    
    // Container untuk semua tampilan kamera
    const cameraContainer = document.createElement('div');
    cameraContainer.id = 'vision-panel'; // Ganti ID untuk collapsible panel system
    cameraContainer.style.position = 'absolute';
    cameraContainer.style.bottom = '20px';
    cameraContainer.style.left = '350px';
    cameraContainer.style.display = 'flex';
    cameraContainer.style.flexDirection = 'column'; // Untuk header di atas konten
    cameraContainer.style.gap = '10px';
    cameraContainer.style.zIndex = '1000';
    cameraContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    cameraContainer.style.padding = '10px';
    cameraContainer.style.borderRadius = '5px';
    document.body.appendChild(cameraContainer);
    
    // Tambahkan header untuk panel
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.marginBottom = '10px';
    
    // Judul panel
    const headerTitle = document.createElement('h3');
    headerTitle.style.margin = '0';
    headerTitle.style.color = '#44AAFF';
    headerTitle.style.fontSize = '16px';
    headerTitle.innerText = 'Camera Feeds';
    headerDiv.appendChild(headerTitle);
    
    // Tambahkan header ke container
    cameraContainer.appendChild(headerDiv);
    
    // Buat container untuk konten kamera
    const feedsContainer = document.createElement('div');
    feedsContainer.style.display = 'flex';
    feedsContainer.style.gap = '10px';
    cameraContainer.appendChild(feedsContainer);
    
    // Buat tampilan untuk setiap kamera yang aktif
    const cameraTypes = [
      { id: 'main', label: 'HD Camera', color: '#FFF' },
      { id: 'thermal', label: 'Thermal', color: '#FF7700' },
      { id: 'bottom', label: 'Bottom', color: '#CCC' }
    ];
    
    // Buat renderer kamera
    cameraTypes.forEach(camType => {
      if (!this.config.camerasEnabled[camType.id]) return;
      
      // Buat div container untuk kamera
      const cameraView = document.createElement('div');
      cameraView.id = `camera-view-${camType.id}`;
      cameraView.style.position = 'relative';
      cameraView.style.width = camType.id === 'main' ? '320px' : '160px';
      cameraView.style.height = camType.id === 'main' ? '180px' : '120px';
      cameraView.style.border = '2px solid rgba(255, 255, 255, 0.3)';
      cameraView.style.borderRadius = '4px';
      cameraView.style.overflow = 'hidden';
      
      // Canvas untuk rendering kamera
      const canvas = document.createElement('canvas');
      canvas.width = camType.id === 'main' ? 320 : 160;
      canvas.height = camType.id === 'main' ? 180 : 120;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.backgroundColor = '#000';
      cameraView.appendChild(canvas);
      
      // Label kamera
      const label = document.createElement('div');
      label.style.position = 'absolute';
      label.style.top = '5px';
      label.style.left = '10px';
      label.style.color = camType.color;
      label.style.fontSize = '12px';
      label.style.textShadow = '1px 1px 1px rgba(0,0,0,0.5)';
      label.style.fontFamily = 'Arial, sans-serif';
      label.innerText = camType.label;
      cameraView.appendChild(label);
      
      // Red dot recording indicator
      const recordIndicator = document.createElement('div');
      recordIndicator.className = 'recording-indicator';
      recordIndicator.style.position = 'absolute';
      recordIndicator.style.top = '7px';
      recordIndicator.style.right = '10px';
      recordIndicator.style.width = '8px';
      recordIndicator.style.height = '8px';
      recordIndicator.style.borderRadius = '50%';
      recordIndicator.style.backgroundColor = '#FF0000';
      recordIndicator.style.animation = 'blink 1s infinite';
      cameraView.appendChild(recordIndicator);
      
      // Tambahkan ke container
      feedsContainer.appendChild(cameraView);
      
      // Buat renderer untuk kamera ini
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      renderer.setSize(canvas.width, canvas.height);
      
      // Buat kamera perspektif khusus untuk rendering
      const aspect = canvas.width / canvas.height;
      const fov = camType.id === 'thermal' ? 60 : (camType.id === 'bottom' ? 120 : 90);
      const viewCamera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
      
      // Save reference to this view
      this.cameras.forEach(cam => {
        if (cam.userData && cam.userData.cameraType === camType.id) {
          // Store render info in the userData
          cam.userData.view = {
            canvas,
            renderer,
            viewCamera,
            updatePosition: true
          };
        }
      });
    });
    
    // Add style for blinking recording indicator
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes blink {
        0% { opacity: 1; }
        50% { opacity: 0.3; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Update tampilan kamera berdasarkan posisi drone saat ini
  updateCameraViews() {
    if (!this.config.enabledInSimulation || !this.config.showCameraFeeds) return;
    
    // Skip jika tab tidak aktif
    if (document.hidden) return;
    
    // Throttle pada performa rendah
    if (window.PERFORMANCE && window.PERFORMANCE.lowPerfMode) {
      // Hanya render setiap frame ketiga dalam mode performa rendah
      if (this.frameSkipCount % 3 !== 0) return;
    }
    
    // Update setiap kamera dengan throttling
    let cameraUpdated = false;
    
    this.cameras.forEach(cam => {
      if (!cam.userData || !cam.userData.view) return;
      
      // Limit update to once per frame
      if (cameraUpdated && window.PERFORMANCE && window.PERFORMANCE.lowPerfMode) return;
      
      const view = cam.userData.view;
      
      // Dapatkan posisi dunia dari kamera drone
      const worldPos = new THREE.Vector3();
      cam.getWorldPosition(worldPos);
      
      // Dapatkan rotasi dunia dari kamera drone
      const worldRot = new THREE.Quaternion();
      cam.getWorldQuaternion(worldRot);
      
      // Update posisi dan rotasi kamera view
      view.viewCamera.position.copy(worldPos);
      view.viewCamera.quaternion.copy(worldRot);
      
      // Render scene dari sudut pandang kamera ini
      if (cam.userData.cameraType === 'thermal') {
        // Untuk kamera thermal, render dengan shader berbeda (simulasi)
        view.renderer.setClearColor(0x000000);
        
        // Simpan material asli objek sebelum diubah
        const originalMaterials = new Map();
        
        // Ubah semua material ke thermal view (hanya sementara)
        this.scene.traverse(object => {
          if (object.isMesh && object.material) {
            // Simpan material asli
            originalMaterials.set(object, object.material);
            
            // Buat material thermal sementara berdasarkan jenis objek
            if (object.userData && object.userData.type === 'chicken') {
              // Ayam tampak "panas" dalam thermal view
              object.material = new THREE.MeshBasicMaterial({ color: 0xFF3300 });
            } else if (object.userData && object.userData.material === 'metal') {
              // Metal reflektif dalam thermal
              object.material = new THREE.MeshBasicMaterial({ color: 0x223366 });
            } else {
              // Default thermal color - cool
              object.material = new THREE.MeshBasicMaterial({ color: 0x001133 });
            }
          }
        });
        
        // Render dengan material thermal
        view.renderer.render(this.scene, view.viewCamera);
        
        // Kembalikan material asli
        originalMaterials.forEach((material, object) => {
          object.material = material;
        });
      } else {
        // Untuk kamera normal, render scene biasa
        view.renderer.render(this.scene, view.viewCamera);
      }
      
      // Simulasi recording effect pada capture
      if (cam.userData.isCapturing) {
        view.canvas.style.filter = 'brightness(1.2) contrast(1.1)';
        setTimeout(() => {
          if (view.canvas) {
            view.canvas.style.filter = '';
          }
        }, 100);
      }
      
      // Mark as updated
      cameraUpdated = true;
    });
  }
  
  // Update animations for visualization with performance optimization
  updateAnimations(time) {
    // Skip jika tab tidak aktif atau performa rendah
    if (document.hidden) return;
    
    // Throttle pada perangkat berperforma rendah
    if (window.PERFORMANCE && window.PERFORMANCE.lowPerfMode) {
      if (this.frameSkipCount % 2 !== 0) {
        this.frameSkipCount++;
        return; // Skip every other frame
      }
    }
    
    this.frameSkipCount++;
    
    // Cek visualization container
    const visualizationContainer = this.scene.getObjectByName('density-visualization');
    if (visualizationContainer) {
      visualizationContainer.traverse(object => {
        if (object.userData && object.userData.animation) {
          object.userData.animation.update(time);
        }
      });
    }
    
    // Update camera views dengan throttling
    this.updateCameraViews();
  }
  
  // Clean up resources saat sistem tidak lagi digunakan
  dispose() {
    // Hapus interval jika menggunakan metode interval
    if (this.captureInterval) clearInterval(this.captureInterval);
    if (this.analysisInterval) clearInterval(this.analysisInterval);
    
    // Hapus kamera dari drone
    this.cameras.forEach(camera => {
      if (camera.parent) {
        camera.parent.remove(camera);
      }
      
      // Hapus renderer jika ada
      if (camera.userData && camera.userData.view) {
        const view = camera.userData.view;
        if (view.renderer) {
          view.renderer.dispose();
        }
      }
    });
    
    this.cameras = [];
    
    // Hapus visualisasi
    this.clearVisualization();
    
    // Hapus UI
    const analysisPanel = document.getElementById('analysis-panel');
    if (analysisPanel) {
      analysisPanel.remove();
    }
    
    // Hapus camera views
    const cameraViews = document.getElementById('vision-panel');
    if (cameraViews) {
      cameraViews.remove();
    }
  }
} 
import * as THREE from 'three';

// Class untuk mengelola sistem obstacle avoidance drone
export class ObstacleAvoidanceSystem {
  constructor(scene, drone) {
    this.scene = scene;
    this.drone = drone;
    this.obstacles = [];
    this.proximityThreshold = 2.0; // Jarak dalam meter untuk dianggap sebagai "dekat obstacle"
    this.criticalThreshold = 0.8;  // Jarak kritis dalam meter untuk penghindaran darurat
    this.sensors = [];
    
    // Konfigurasi sistem
    this.config = {
      enabled: true,              // Aktifkan obstacle avoidance
      visualizeSensors: true,      // Tampilkan visual sensor
      sensorCount: 6,             // Jumlah sensor proximity (depan, belakang, kiri, kanan, atas, bawah)
      sensorRange: 4.0,           // Jangkauan sensor dalam meter
      updateRate: 30,             // Update rate dalam ms
      avoidanceStrategy: 'vector', // 'simple', 'vector', atau 'predictive'
      enabledInSimulation: true,   // Aktifkan dalam simulasi
      influenceOnAutopilot: 0.8    // Pengaruh obstacle avoidance pada autopilot (0-1)
    };
    
    // Arah sensor relatif terhadap drone
    this.sensorDirections = [
      { x: 0, y: 0, z: 1, name: 'front' },   // Depan
      { x: 0, y: 0, z: -1, name: 'back' },   // Belakang
      { x: 1, y: 0, z: 0, name: 'right' },   // Kanan
      { x: -1, y: 0, z: 0, name: 'left' },   // Kiri
      { x: 0, y: 1, z: 0, name: 'up' },      // Atas
      { x: 0, y: -1, z: 0, name: 'down' }    // Bawah
    ];
    
    // Output dari sistem
    this.avoidanceOutput = {
      active: false,
      avoidanceVector: { x: 0, y: 0, z: 0 },
      nearestObstacle: null,
      nearestDistance: Infinity,
      sensorReadings: {},
      lastUpdate: Date.now()
    };
    
    // Setup sensor
    this.setupSensors();
    
    // Setup update loop
    this.updateInterval = setInterval(() => this.update(), this.config.updateRate);
  }
  
  // Setup sensor proximity
  setupSensors() {
    if (!this.config.enabled) return;
    
    // Buat sensor untuk setiap arah
    this.sensorDirections.forEach((direction, index) => {
      // Jika dalam simulasi, visualisasikan sensor
      if (this.config.enabledInSimulation && this.config.visualizeSensors) {
        // Buat geometri untuk visualisasi sensor
        const sensorGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8);
        const sensorMaterial = new THREE.MeshPhongMaterial({ 
          color: 0x00FF00,
          transparent: true,
          opacity: 0.7
        });
        
        const sensor = new THREE.Mesh(sensorGeometry, sensorMaterial);
        
        // Rotasi sensor agar mengarah ke arah yang benar
        if (direction.z === 1) {
          sensor.rotation.x = Math.PI / 2;
        } else if (direction.z === -1) {
          sensor.rotation.x = -Math.PI / 2;
        } else if (direction.x === 1) {
          sensor.rotation.z = -Math.PI / 2;
        } else if (direction.x === -1) {
          sensor.rotation.z = Math.PI / 2;
        } else if (direction.y === -1) {
          sensor.rotation.x = Math.PI;
        }
        
        // Posisikan sensor pada drone
        const offset = 0.8; // Offset dari pusat drone
        sensor.position.set(
          direction.x * offset, 
          direction.y * offset, 
          direction.z * offset
        );
        
        // Tambahkan helper untuk visualisasi beam sensor
        const origin = new THREE.Vector3(0, 0, 0);
        const length = this.config.sensorRange;
        const hex = 0x00FF00;
        const arrowHelper = new THREE.ArrowHelper(
          new THREE.Vector3(direction.x, direction.y, direction.z),
          origin,
          length,
          hex,
          0.2,
          0.1
        );
        
        sensor.add(arrowHelper);
        
        // Tambahkan sensor ke drone
        this.drone.add(sensor);
        
        // Simpan referensi sensor
        this.sensors.push({
          mesh: sensor,
          helper: arrowHelper,
          direction: { ...direction },
          index: index,
          reading: Infinity
        });
      } else {
        // Jika tidak divisualisasikan, tetap simpan informasi sensor
        this.sensors.push({
          mesh: null,
          helper: null,
          direction: { ...direction },
          index: index,
          reading: Infinity
        });
      }
      
      // Inisialisasi pembacaan sensor
      this.avoidanceOutput.sensorReadings[direction.name] = Infinity;
    });
    
    console.log(`[ObstacleAvoidance] ${this.sensors.length} proximity sensors configured`);
  }
  
  // Update sensor readings dan kalkulasi vektor avoidance
  update() {
    if (!this.config.enabled) return;
    
    // Reset data
    this.avoidanceOutput.nearestObstacle = null;
    this.avoidanceOutput.nearestDistance = Infinity;
    this.avoidanceOutput.active = false;
    this.avoidanceOutput.avoidanceVector = { x: 0, y: 0, z: 0 };
    
    // Dapatkan semua objek yang mungkin menjadi obstacle
    this.findObstaclesInScene();
    
    // Update semua sensor readings
    this.updateSensorReadings();
    
    // Kalkulasi vektor avoidance berdasarkan strategi yang dipilih
    this.calculateAvoidanceVector();
    
    // Update visual indicator berdasarkan readings
    this.updateSensorVisuals();
    
    // Update timestamp
    this.avoidanceOutput.lastUpdate = Date.now();
  }
  
  // Cari semua objek yang mungkin menjadi obstacle di scene
  findObstaclesInScene() {
    this.obstacles = [];
    
    this.scene.traverse(object => {
      // Skip objek yang bukan mesh atau yang ditandai bukan obstacle
      if (!object.isMesh || 
          (object.userData && object.userData.isNotObstacle) ||
          object === this.drone) {
        return;
      }
      
      // Tambahkan sebagai potential obstacle
      this.obstacles.push(object);
    });
  }
  
  // Update pembacaan sensor
  updateSensorReadings() {
    // Posisi drone
    const dronePosition = new THREE.Vector3();
    this.drone.getWorldPosition(dronePosition);
    
    // Update setiap sensor
    this.sensors.forEach(sensor => {
      // Arah sensor dalam koordinat dunia
      const sensorDirection = new THREE.Vector3(
        sensor.direction.x,
        sensor.direction.y,
        sensor.direction.z
      );
      
      // Transformasi ke koordinat dunia
      const worldDirection = sensorDirection.clone();
      worldDirection.applyQuaternion(this.drone.quaternion);
      worldDirection.normalize();
      
      // Siapkan raycaster
      const raycaster = new THREE.Raycaster(
        dronePosition,
        worldDirection,
        0,
        this.config.sensorRange
      );
      
      // Set camera property for the raycaster (required for Sprites)
      if (window.camera) {
        raycaster.camera = window.camera;
      }
      
      // Cast ray dan cek intersection dengan obstacles
      const intersects = raycaster.intersectObjects(this.obstacles);
      
      // Update reading berdasarkan interseksi terdekat
      if (intersects.length > 0) {
        const distance = intersects[0].distance;
        sensor.reading = distance;
        
        // Update nama arah sensor
        const dirName = sensor.direction.name;
        this.avoidanceOutput.sensorReadings[dirName] = distance;
        
        // Update nearest obstacle info
        if (distance < this.avoidanceOutput.nearestDistance) {
          this.avoidanceOutput.nearestDistance = distance;
          this.avoidanceOutput.nearestObstacle = intersects[0].object;
        }
      } else {
        // Tidak ada obstacle terdeteksi
        sensor.reading = Infinity;
        this.avoidanceOutput.sensorReadings[sensor.direction.name] = Infinity;
      }
    });
    
    // Set active flag jika obstacle terdekat dalam threshold
    this.avoidanceOutput.active = this.avoidanceOutput.nearestDistance < this.proximityThreshold;
  }
  
  // Kalkulasi vektor avoidance berdasarkan strategi yang dipilih
  calculateAvoidanceVector() {
    if (!this.avoidanceOutput.active) return;
    
    switch (this.config.avoidanceStrategy) {
      case 'simple':
        this.calculateSimpleAvoidance();
        break;
        
      case 'vector':
        this.calculateVectorAvoidance();
        break;
        
      case 'predictive':
        this.calculatePredictiveAvoidance();
        break;
        
      default:
        this.calculateSimpleAvoidance();
        break;
    }
  }
  
  // Strategi simple: hindari ke arah berlawanan dari obstacle terdekat
  calculateSimpleAvoidance() {
    // Temukan sensor dengan jarak terdekat
    let closestSensor = null;
    let minDistance = Infinity;
    
    this.sensors.forEach(sensor => {
      if (sensor.reading < minDistance) {
        minDistance = sensor.reading;
        closestSensor = sensor;
      }
    });
    
    if (closestSensor && minDistance < this.proximityThreshold) {
      // Vektor avoidance adalah kebalikan dari arah sensor
      const strength = 1 - (minDistance / this.proximityThreshold); // 0 hingga 1
      
      this.avoidanceOutput.avoidanceVector = {
        x: -closestSensor.direction.x * strength,
        y: -closestSensor.direction.y * strength,
        z: -closestSensor.direction.z * strength
      };
    }
  }
  
  // Strategi vector: gunakan semua sensor untuk menghitung repulsive vector
  calculateVectorAvoidance() {
    const avoidanceVector = { x: 0, y: 0, z: 0 };
    let hasContribution = false;
    
    // Kontribusi dari setiap sensor
    this.sensors.forEach(sensor => {
      if (sensor.reading < this.proximityThreshold) {
        // Hitung kekuatan repulsi berdasarkan jarak (semakin dekat, semakin kuat)
        const repulsionStrength = Math.pow(1 - (sensor.reading / this.proximityThreshold), 2);
        
        // Tambahkan kontribusi ke vektor avoidance (kebalikan arah sensor)
        avoidanceVector.x -= sensor.direction.x * repulsionStrength;
        avoidanceVector.y -= sensor.direction.y * repulsionStrength;
        avoidanceVector.z -= sensor.direction.z * repulsionStrength;
        
        hasContribution = true;
      }
    });
    
    if (hasContribution) {
      // Normalisasi vektor
      const magnitude = Math.sqrt(
        avoidanceVector.x * avoidanceVector.x +
        avoidanceVector.y * avoidanceVector.y +
        avoidanceVector.z * avoidanceVector.z
      );
      
      if (magnitude > 0) {
        avoidanceVector.x /= magnitude;
        avoidanceVector.y /= magnitude;
        avoidanceVector.z /= magnitude;
      }
      
      this.avoidanceOutput.avoidanceVector = avoidanceVector;
    }
  }
  
  // Strategi predictive: prediksi collision berdasarkan velocity drone
  calculatePredictiveAvoidance() {
    // Dapatkan velocity drone
    const flightDynamics = window.flightDynamics;
    if (!flightDynamics) {
      this.calculateVectorAvoidance(); // Fallback ke vector avoidance
      return;
    }
    
    const velocity = flightDynamics.velocity;
    const speed = Math.sqrt(
      velocity.x * velocity.x +
      velocity.y * velocity.y +
      velocity.z * velocity.z
    );
    
    // Jika drone bergerak sangat lambat, gunakan vector avoidance biasa
    if (speed < 0.001) {
      this.calculateVectorAvoidance();
      return;
    }
    
    // Normalisasi vektor velocity
    const direction = {
      x: velocity.x / speed,
      y: velocity.y / speed,
      z: velocity.z / speed
    };
    
    // Check collision pada arah pergerakan
    const dronePosition = new THREE.Vector3();
    this.drone.getWorldPosition(dronePosition);
    
    const raycaster = new THREE.Raycaster(
      dronePosition,
      new THREE.Vector3(direction.x, direction.y, direction.z),
      0,
      this.proximityThreshold + speed * 1.5 // Look ahead distance berdasarkan kecepatan
    );
    
    // Set camera property for the raycaster (required for Sprites)
    if (window.camera) {
      raycaster.camera = window.camera;
    }
    
    const intersects = raycaster.intersectObjects(this.obstacles);
    
    if (intersects.length > 0) {
      // Prediksi collision, hitung vektor untuk menghindar
      const collision = intersects[0];
      const collisionNormal = collision.face.normal.clone();
      
      // Transform normal ke world space
      collisionNormal.transformDirection(collision.object.matrixWorld);
      
      // Hitung arah avoidance (refleksi arah gerak)
      const dotProduct = 
        direction.x * collisionNormal.x +
        direction.y * collisionNormal.y +
        direction.z * collisionNormal.z;
      
      const reflectionVector = {
        x: direction.x - 2 * dotProduct * collisionNormal.x,
        y: direction.y - 2 * dotProduct * collisionNormal.y,
        z: direction.z - 2 * dotProduct * collisionNormal.z
      };
      
      // Gunakan vektor refleksi sebagai vektor avoidance
      const strength = 1 - (collision.distance / (this.proximityThreshold + speed));
      this.avoidanceOutput.avoidanceVector = {
        x: reflectionVector.x * strength,
        y: reflectionVector.y * strength,
        z: reflectionVector.z * strength
      };
      
      // Tambahkan komponen dari strategi vector untuk menghindari situasi sulit
      const vectorAvoidance = { x: 0, y: 0, z: 0 };
      this.calculateVectorAvoidance();
      
      // Gabungkan dengan bobot
      const reflectionWeight = 0.7;
      const vectorWeight = 0.3;
      
      this.avoidanceOutput.avoidanceVector = {
        x: reflectionVector.x * reflectionWeight * strength + 
           this.avoidanceOutput.avoidanceVector.x * vectorWeight,
        y: reflectionVector.y * reflectionWeight * strength + 
           this.avoidanceOutput.avoidanceVector.y * vectorWeight,
        z: reflectionVector.z * reflectionWeight * strength + 
           this.avoidanceOutput.avoidanceVector.z * vectorWeight
      };
    } else {
      // Tidak ada prediksi collision, gunakan vector avoidance biasa
      this.calculateVectorAvoidance();
    }
  }
  
  // Update visualisasi sensor berdasarkan readings
  updateSensorVisuals() {
    if (!this.config.enabledInSimulation || !this.config.visualizeSensors) return;
    
    this.sensors.forEach(sensor => {
      if (!sensor.helper) return;
      
      // Update warna dan panjang sensor berdasarkan reading
      if (sensor.reading < this.criticalThreshold) {
        // Merah untuk jarak kritis
        sensor.helper.setColor(new THREE.Color(0xFF0000));
      } else if (sensor.reading < this.proximityThreshold) {
        // Kuning untuk jarak dekat
        sensor.helper.setColor(new THREE.Color(0xFFFF00));
      } else {
        // Hijau untuk aman
        sensor.helper.setColor(new THREE.Color(0x00FF00));
      }
      
      // Update panjang untuk merefleksikan reading (hanya jika terdeteksi)
      if (sensor.reading < Infinity && sensor.reading < this.config.sensorRange) {
        sensor.helper.setLength(sensor.reading);
      } else {
        sensor.helper.setLength(this.config.sensorRange);
      }
    });
  }
  
  // Aplikasikan force avoidance ke flight dynamics
  applyAvoidanceForce(flightDynamics) {
    if (!this.config.enabled || !this.avoidanceOutput.active) return false;
    
    const avoidanceVector = this.avoidanceOutput.avoidanceVector;
    const strength = this.config.influenceOnAutopilot * 0.01;
    
    // Aplikasikan ke flight dynamics
    flightDynamics.velocity.x += avoidanceVector.x * strength;
    flightDynamics.velocity.y += avoidanceVector.y * strength;
    flightDynamics.velocity.z += avoidanceVector.z * strength;
    
    return true;
  }
  
  // Mendapatkan data avoidance terkini
  getAvoidanceData() {
    return this.avoidanceOutput;
  }
  
  // Clean up resources saat sistem tidak lagi digunakan
  dispose() {
    clearInterval(this.updateInterval);
    
    // Hapus sensor visualization dari drone
    this.sensors.forEach(sensor => {
      if (sensor.mesh) {
        this.drone.remove(sensor.mesh);
      }
    });
    
    this.sensors = [];
  }
} 
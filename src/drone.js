import * as THREE from 'three';

export function createDrone() {
  // Group untuk menyimpan semua komponen drone
  const droneGroup = new THREE.Group();
  
  // Material untuk badan drone
  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x333333,
    specular: 0x111111,
    shininess: 30 
  });
  
  // Material untuk arm drone
  const armMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x888888,
    specular: 0x222222,
    shininess: 20 
  });
  
  // Material untuk propeller
  const propellerMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x222222,
    specular: 0x333333,
    shininess: 10 
  });
  
  // Material untuk motor (untuk menandai arah putaran)
  const motorCWMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xCC0000, // Merah untuk putaran clockwise
    specular: 0x333333,
    shininess: 30 
  });
  
  const motorCCWMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x0000CC, // Biru untuk putaran counter-clockwise
    specular: 0x333333,
    shininess: 30 
  });

  // Badan utama drone
  const bodyGeometry = new THREE.BoxGeometry(1.5, 0.2, 1.5);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  droneGroup.add(body);
  
  // Tambahkan elemen elektronik di tengah (flight controller)
  const electronicBoxGeometry = new THREE.BoxGeometry(0.6, 0.1, 0.6);
  const electronicBox = new THREE.Mesh(electronicBoxGeometry, new THREE.MeshPhongMaterial({
    color: 0x00AA00,
    specular: 0x333333,
    shininess: 30
  }));
  electronicBox.position.set(0, 0.15, 0);
  electronicBox.castShadow = true;
  droneGroup.add(electronicBox);
  
  // Tambahkan baterai di bagian bawah
  const batteryGeometry = new THREE.BoxGeometry(0.8, 0.15, 0.4);
  const battery = new THREE.Mesh(batteryGeometry, new THREE.MeshPhongMaterial({
    color: 0x111111,
    specular: 0x222222,
    shininess: 20
  }));
  battery.position.set(0, -0.1, 0);
  battery.castShadow = true;
  droneGroup.add(battery);
  
  // Membuat arm dan propeller
  droneGroup.propellers = []; // Menyimpan propeller untuk animasi
  droneGroup.motorSpeed = [0, 0, 0, 0]; // Kecepatan masing-masing motor untuk data sensor
  
  // Saat membuat propeller, kita harus menentukan arah putaran yang benar
  // Pada drone quadcopter, propeller diagonal berputar dalam arah yang sama.
  // Ini adalah konfigurasi "X" standar:
  // - Depan kiri (FL) dan belakang kanan (BR) berputar Counter-Clockwise (CCW)
  // - Depan kanan (FR) dan belakang kiri (BL) berputar Clockwise (CW)
  
  const createArm = (x, z, isCW, motorIndex) => {
    // Arm
    const armGeometry = new THREE.BoxGeometry(0.2, 0.1, 1);
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.set(x, 0, z);
    arm.castShadow = true;
    
    // Rotasi arm untuk mengarah ke sudut yang benar
    const angle = Math.atan2(z, x);
    arm.rotation.y = angle;
    
    droneGroup.add(arm);
    
    // Posisi motor di ujung arm
    const motorX = x > 0 ? x + 0.2 : x - 0.2;
    const motorZ = z > 0 ? z + 0.2 : z - 0.2;
    
    // Motor mount
    const motorMountGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
    const motorMount = new THREE.Mesh(motorMountGeometry, isCW ? motorCWMaterial : motorCCWMaterial);
    motorMount.position.set(x, 0.05, z);
    motorMount.castShadow = true;
    droneGroup.add(motorMount);
    
    // Propeller hub
    const hubGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
    const hub = new THREE.Mesh(hubGeometry, propellerMaterial);
    hub.position.set(x, 0.12, z);
    hub.castShadow = true;
    droneGroup.add(hub);
    
    // Propeller
    const propellerGroup = new THREE.Group();
    
    // Buat 2 blade propeller
    for (let i = 0; i < 2; i++) {
      const bladeGeometry = new THREE.BoxGeometry(0.6, 0.02, 0.1);
      const blade = new THREE.Mesh(bladeGeometry, propellerMaterial);
      blade.position.set(0, 0, 0);
      blade.rotation.y = i * Math.PI;
      blade.castShadow = true;
      propellerGroup.add(blade);
    }
    
    propellerGroup.position.set(x, 0.15, z);
    droneGroup.add(propellerGroup);
    
    // Simpan arah putaran propeller untuk animasi
    propellerGroup.userData = { isCW: isCW, motorIndex: motorIndex };
    droneGroup.propellers.push(propellerGroup);
    
    // Tambahkan label warna untuk arah
    const indicatorGeometry = new THREE.TorusGeometry(0.17, 0.02, 8, 16);
    const indicator = new THREE.Mesh(indicatorGeometry, isCW ? motorCWMaterial : motorCCWMaterial);
    indicator.position.set(x, 0.16, z);
    indicator.rotation.x = Math.PI / 2;
    indicator.castShadow = true;
    droneGroup.add(indicator);
    
    // Tambahkan tanda arah panah untuk menunjukkan arah putaran
    const arrowLength = 0.15;
    const arrowGroup = new THREE.Group();
    
    for (let i = 0; i < 4; i++) {
      const arrowGeometry = new THREE.BoxGeometry(0.02, 0.01, arrowLength);
      const arrow = new THREE.Mesh(arrowGeometry, isCW ? motorCWMaterial : motorCCWMaterial);
      
      // Rotasi untuk membentuk panah melingkar
      const arrowAngle = i * (Math.PI / 2);
      
      // Arah putaran berbeda untuk CW dan CCW
      const radius = 0.17;
      const directionFactor = isCW ? 1 : -1;
      
      arrow.position.x = radius * Math.cos(arrowAngle);
      arrow.position.z = radius * Math.sin(arrowAngle) * directionFactor;
      
      arrow.rotation.y = arrowAngle + (isCW ? Math.PI / 4 : -Math.PI / 4);
      arrowGroup.add(arrow);
    }
    
    arrowGroup.position.set(x, 0.17, z);
    droneGroup.add(arrowGroup);
  };
  
  // Buat 4 arm dan propeller dengan arah putaran yang benar
  // Diagonal berlawanan memiliki arah putaran yang sama
  createArm(0.65, 0.65, true, 0);     // Depan kanan (FR) - CW - Motor 1
  createArm(-0.65, 0.65, false, 1);   // Depan kiri (FL) - CCW - Motor 2
  createArm(0.65, -0.65, false, 2);   // Belakang kanan (BR) - CCW - Motor 3
  createArm(-0.65, -0.65, true, 3);   // Belakang kiri (BL) - CW - Motor 4
  
  // Tambahkan penanda arah depan drone
  const directionMarkerGeometry = new THREE.ConeGeometry(0.15, 0.3, 4);
  const directionMarkerMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xFF0000, 
    emissive: 0xFF0000,
    emissiveIntensity: 0.5
  });
  const directionMarker = new THREE.Mesh(directionMarkerGeometry, directionMarkerMaterial);
  directionMarker.rotation.x = Math.PI / 2;
  directionMarker.position.set(0, 0, 0.9);
  directionMarker.castShadow = true;
  droneGroup.add(directionMarker);
  
  // Tambahkan lampu depan
  const frontLightGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.1);
  const frontLightMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xFF0000, 
    emissive: 0xFF0000,
    emissiveIntensity: 0.5
  });
  const frontLight = new THREE.Mesh(frontLightGeometry, frontLightMaterial);
  frontLight.position.set(0, 0, 0.7);
  droneGroup.add(frontLight);
  
  // Tambahkan lampu belakang
  const backLightGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.1);
  const backLightMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x00FF00, 
    emissive: 0x00FF00,
    emissiveIntensity: 0.5
  });
  const backLight = new THREE.Mesh(backLightGeometry, backLightMaterial);
  backLight.position.set(0, 0, -0.7);
  droneGroup.add(backLight);
  
  // Tambahkan antena untuk sistem radio
  const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.01, 0.4, 8);
  const antenna = new THREE.Mesh(antennaGeometry, new THREE.MeshPhongMaterial({
    color: 0x000000
  }));
  antenna.rotation.x = Math.PI / 4;
  antenna.position.set(0.2, 0.2, -0.2);
  droneGroup.add(antenna);
  
  // Sensor-sensor drone
  // Sensor Temperature & Humidity di bagian bawah (suhu & kelembaban)
  const tempHumiditySensorGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.1);
  const tempHumiditySensor = new THREE.Mesh(tempHumiditySensorGeometry, new THREE.MeshPhongMaterial({
    color: 0xFFFF00
  }));
  tempHumiditySensor.position.set(0.3, -0.15, 0);
  droneGroup.add(tempHumiditySensor);
  
  // Sensor CO2 di bagian depan
  const co2SensorGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.1);
  const co2Sensor = new THREE.Mesh(co2SensorGeometry, new THREE.MeshPhongMaterial({
    color: 0x00FFFF
  }));
  co2Sensor.position.set(0, -0.15, 0.5);
  droneGroup.add(co2Sensor);
  
  // Sensor Particulate Matter (PM) di bagian bawah
  const pmSensorGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.1);
  const pmSensor = new THREE.Mesh(pmSensorGeometry, new THREE.MeshPhongMaterial({
    color: 0xFF00FF
  }));
  pmSensor.position.set(-0.3, -0.15, 0);
  droneGroup.add(pmSensor);
  
  // Sensor Ammonia di bagian belakang
  const ammoniaSensorGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.1);
  const ammoniaSensor = new THREE.Mesh(ammoniaSensorGeometry, new THREE.MeshPhongMaterial({
    color: 0xFFAA00
  }));
  ammoniaSensor.position.set(0, -0.15, -0.5);
  droneGroup.add(ammoniaSensor);
  
  // Sensor data untuk drone yang dapat diakses dari luar
  droneGroup.sensorData = {
    temperature: 25,  // Suhu dalam Celsius
    humidity: 60,     // Kelembaban dalam %
    co2: 800,         // CO2 dalam ppm
    pm25: 35,         // PM2.5 dalam μg/m³
    ammonia: 15,      // Ammonia dalam ppm
    altitude: 2,      // Ketinggian dalam meter
    battery: 85,      // Battery dalam %
    signalStrength: 95, // Kekuatan sinyal dalam %
    flightTime: 0,    // Waktu terbang dalam detik
    orientation: {    // Orientasi dalam derajat
      roll: 0,
      pitch: 0,
      yaw: 0
    }
  };
  
  // Kaki pendaratan
  const legMaterial = new THREE.MeshPhongMaterial({
    color: 0x444444
  });
  
  // Kaki depan
  const frontLegGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8);
  const frontLeg = new THREE.Mesh(frontLegGeometry, legMaterial);
  frontLeg.rotation.x = Math.PI / 2;
  frontLeg.position.set(0, -0.3, 0.5);
  droneGroup.add(frontLeg);
  
  // Kaki belakang
  const backLegGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8);
  const backLeg = new THREE.Mesh(backLegGeometry, legMaterial);
  backLeg.rotation.x = Math.PI / 2;
  backLeg.position.set(0, -0.3, -0.5);
  droneGroup.add(backLeg);
  
  // Kamera untuk pengambilan gambar dan video
  const cameraGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.2);
  const cameraMesh = new THREE.Mesh(cameraGeometry, new THREE.MeshPhongMaterial({
    color: 0x333333
  }));
  cameraMesh.position.set(0, -0.2, 0.3);
  droneGroup.add(cameraMesh);
  
  // Lensa kamera
  const lensGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16);
  const lens = new THREE.Mesh(lensGeometry, new THREE.MeshPhongMaterial({
    color: 0x111111,
    specular: 0xFFFFFF,
    shininess: 100
  }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, -0.2, 0.4);
  droneGroup.add(lens);
  
  // Posisi awal drone
  droneGroup.position.y = 2;
  
  // Fungsi untuk memperbarui data sensor berdasarkan posisi dan gerakan drone
  droneGroup.updateSensorData = function(elapsedTime) {
    // Simulator quadcopter fisika realistis
    const noise = (min, max) => Math.random() * (max - min) + min;
    const posY = this.position.y;
    
    // Konstanta fisika drone yang lebih lengkap
    const dronePhysics = {
      // Spesifikasi teknis drone
      maxRPM: 7500,               // RPM maksimum motor brushless standar drone
      hoverRPM: 4200,             // RPM untuk melayang stabil (hover)
      motorKV: 920,               // KV rating untuk motor (rpm per volt)
      propellerDiameter: 0.2,     // 8 inch dalam meter
      propellerPitch: 0.1,        // 4 inch pitch dalam meter
      propellerThrust: 0.18,      // kg thrust per 1000 RPM
      motorResponseTime: 0.08,    // waktu respons motor dalam detik
      
      // Spesifikasi baterai
      batteryCapacity: 2200,      // mAh
      batteryVoltage: 11.1,       // 3S LiPo (3.7V x 3)
      batteryCells: 3,            // jumlah sel
      batteryDischargeRate: 25,   // C-rating untuk discharge
      batteryCurrentDraw: 0,      // Ampere
      
      // Karakteristik fisik
      mass: 0.5,                  // kg (drone + payload)
      massDistribution: {         // pengaruh terhadap momen inersia
        center: 0.25,             // kg di tengah
        arms: 0.05                // kg per arm (0.05 x 4 = 0.2)
      },
      armLength: 0.15,            // m
      maxTiltAngle: 35,           // derajat
      
      // Efek environmental
      airDensity: 1.225,          // kg/m³ pada permukaan laut
      altitudeDensityFactor: 0.0001, // pengaruh ketinggian terhadap densitas udara
      windEffect: noise(-0.3, 0.3)  // faktor angin
    };
    
    // Altitude terbaru
    this.sensorData.altitude = posY.toFixed(2);
    
    // Update orientasi drone dengan presisi derajat
    this.sensorData.orientation.roll = (this.rotation.z * (180 / Math.PI)).toFixed(1);
    this.sensorData.orientation.pitch = (this.rotation.x * (180 / Math.PI)).toFixed(1);
    this.sensorData.orientation.yaw = (this.rotation.y * (180 / Math.PI)).toFixed(1);
    
    // Perbarui waktu terbang
    this.sensorData.flightTime += 0.016; // ~60 fps
    
    // Akses window.flightDynamics jika tersedia, atau gunakan objek kosong sebagai fallback
    const flightDynamics = window.flightDynamics || {
      velocity: { x: 0, y: 0, z: 0 },
      rotationVelocity: { x: 0, y: 0, z: 0 }
    };
    
    // Hitung kebutuhan daya berdasarkan orientasi dan gerakan
    // Fungsi ini mensimulasikan overhead power untuk menjaga stabilitas
    const calculatePowerNeed = () => {
      // Daya dasar untuk hover
      let basePower = 1.0;
      
      // Tambahan daya untuk gerakan/manuver
      const pitchFactor = Math.abs(this.rotation.x) * 5; // Pitch membutuhkan daya lebih
      const rollFactor = Math.abs(this.rotation.z) * 5;  // Roll membutuhkan daya lebih
      const yawRate = Math.abs(flightDynamics.rotationVelocity.y || 0) * 10; // Yaw cepat membutuhkan daya lebih
      const verticalSpeed = Math.abs(flightDynamics.velocity.y || 0) * 5; // Vertikal cepat membutuhkan daya lebih
      const horizontalSpeed = 
        Math.sqrt(
          Math.pow(flightDynamics.velocity.x || 0, 2) + 
          Math.pow(flightDynamics.velocity.z || 0, 2)
        ) * 3; // Kecepatan horizontal membutuhkan daya lebih
      
      // Faktor ketinggian - semakin tinggi, semakin banyak daya yang dibutuhkan
      const altitudeFactor = 1 + (posY * dronePhysics.altitudeDensityFactor);
      
      // Total multiplier daya
      return basePower + pitchFactor + rollFactor + yawRate + verticalSpeed + horizontalSpeed * altitudeFactor;
    };
    
    // Simulasi pengosongan baterai berdasarkan beban motor dan waktu
    const powerNeed = calculatePowerNeed();
    // Konversi powerNeed ke ampere dengan faktor skala yang lebih realistis
    const currentDraw = powerNeed * 3.5; // Ampere, 3.5A perkiraan saat hover
    
    // Hitung penggunaan baterai (mAh), faktor koreksi yang lebih besar agar lebih terlihat deplesi baterai
    const drainFactor = 5; // Faktor untuk mempercepat drain baterai dalam simulasi
    const mAhUsed = (currentDraw * 0.016 * drainFactor) / 3.6; // konversi ke mAh untuk 16ms frame
    
    // Voltage drop simulasi sesuai dengan pemakaian
    const remainingCapacity = this.sensorData.battery / 100 * dronePhysics.batteryCapacity;
    const voltage = Math.max(
      dronePhysics.batteryVoltage * 0.8, // batas minimum 80% dari nominal voltage
      dronePhysics.batteryVoltage * (0.95 - 0.15 * (1 - remainingCapacity / dronePhysics.batteryCapacity))
    );
    
    // Pastikan properti battery sudah terinisialisasi, jika tidak set ke nilai default
    if (typeof this.sensorData.battery === 'undefined' || isNaN(this.sensorData.battery)) {
      this.sensorData.battery = 85; // Default 85%
    }
    
    // Update battery status dengan drainRate yang lebih tinggi
    this.sensorData.battery = Math.max(0, this.sensorData.battery - (mAhUsed / dronePhysics.batteryCapacity * 100));
    
    // Debug log untuk battery drain
    if (this.sensorData.flightTime % 5 < 0.02) { // Log setiap ~5 detik
      console.log(`Battery: ${this.sensorData.battery.toFixed(2)}%, Current: ${currentDraw.toFixed(2)}A, Used: ${mAhUsed.toFixed(4)}mAh`);
    }
    
    // Kekuatan sinyal menurun dengan ketinggian dan jarak dari pusat
    const distanceFromCenter = Math.sqrt(this.position.x * this.position.x + this.position.z * this.position.z);
    const heightFactor = posY > 20 ? (posY - 20) * 0.2 : 0;
    const obstacleFactor = 0; // akan diimplementasikan nanti untuk simulasi halangan/dinding
    this.sensorData.signalStrength = Math.max(0, Math.min(100, 95 - (distanceFromCenter * 0.2) - heightFactor - obstacleFactor + noise(-0.5, 0.5)));
    
    // Simulasi kecepatan motor berdasarkan flight dynamics
    const simulateMotorRPM = () => {
      // RPM dasar hover
      const baseRPM = dronePhysics.hoverRPM;
      
      // Faktor densitas udara berdasarkan ketinggian
      const airDensityFactor = 1 - (posY * dronePhysics.altitudeDensityFactor);
      
      // Daya tambahan untuk ketinggian
      const altitudeCompensation = 1 + (posY * 0.01);
      
      // Efek voltage pada RPM (KV rating)
      const voltageRPMFactor = voltage / dronePhysics.batteryVoltage;
      
      // Gaya yang dibutuhkan per motor (thrust needed)
      // Total lift harus sama dengan massa + gaya untuk maneuver
      const gravityForce = dronePhysics.mass * 9.81; // N
      const totalLiftNeeded = gravityForce * 1.2; // 20% buffer
      
      // Thrust per motor dalam keadaan ideal
      const thrustPerMotorIdeal = totalLiftNeeded / 4; // N
      
      // Simulasi RPM untuk masing-masing motor
      const motorRPM = [];
      
      for (let i = 0; i < 4; i++) {
        // RPM dasar yang dibutuhkan untuk menghasilkan thrust
        let rpm = baseRPM * altitudeCompensation / airDensityFactor;
        
        // Adjustments based on orientation
        // Motor depan kanan (0) dan belakang kanan (2)
        if (i === 0 || i === 2) {
          rpm += this.rotation.z * 1800; // Roll adjustment
        } 
        // Motor depan kiri (1) dan belakang kiri (3)
        else {
          rpm -= this.rotation.z * 1800; // Roll adjustment
        }
        
        // Motor depan (0, 1)
        if (i === 0 || i === 1) {
          rpm += this.rotation.x * 1800; // Pitch adjustment
        } 
        // Motor belakang (2, 3)
        else {
          rpm -= this.rotation.x * 1800; // Pitch adjustment
        }
        
        // Motor diagonal berlawanan berputar bersamaan untuk kontrol yaw
        if ((i === 0 || i === 3) && window.keys && window.keys.d) {
          rpm += 600; // Yaw right
        }
        if ((i === 1 || i === 2) && window.keys && window.keys.a) {
          rpm += 600; // Yaw left
        }
        
        // Vertical movement
        if (window.keys && window.keys.w) {
          rpm += 500; // Ascend
        }
        if (window.keys && window.keys.s) {
          rpm -= 300; // Descend (less reduction to maintain stability)
        }
        
        // Efek battery voltage
        rpm *= voltageRPMFactor;
        
        // Tambahkan efek angin dan turbulence
        rpm += noise(-100, 100) * (1 + Math.abs(dronePhysics.windEffect));
        
        // Batasi RPM berdasarkan batas fisik dan voltage
        // Batas bawah lebih tinggi untuk menjaga stabilitas
        const minRPM = 2000 * voltageRPMFactor;
        const maxRPM = dronePhysics.maxRPM * voltageRPMFactor;
        
        rpm = Math.max(minRPM, Math.min(maxRPM, rpm));
        
        // Tambahkan latency/responsiveness motor
        const currentRPM = this.motorSpeed[i] || rpm;
        const responsiveness = 0.2; // 0-1, higher = more responsive
        rpm = currentRPM + (rpm - currentRPM) * responsiveness;
        
        motorRPM.push(Math.round(rpm));
      }
      
      return motorRPM;
    };
    
    // Update motor speed
    this.motorSpeed = simulateMotorRPM();
    
    // Update data thrust untuk simulasi fisika
    for (let i = 0; i < 4; i++) {
      // Hitung thrust aktual berdasarkan RPM dan efisiensi
      // Formula: Thrust (kg) = RPM² × Konstanta × Diameter⁴ × Pitch
      const thrustConstant = 0.000000011; // konstanta empiris
      const rpm = this.motorSpeed[i];
      const diameter = dronePhysics.propellerDiameter;
      const pitch = dronePhysics.propellerPitch;
      
      // Thrust dalam kg
      this.physics.thrust.current[i] = 
        (rpm * rpm) * thrustConstant * Math.pow(diameter, 4) * pitch;
    }
    
    // Update battery telemetry
    this.physics.battery.voltage = voltage.toFixed(1);
    this.physics.battery.currentDraw = currentDraw.toFixed(1);
    
    // Update data penuh drone
    this.physics.status = {
      throttle: powerNeed.toFixed(2),
      voltage: voltage.toFixed(1),
      current: currentDraw.toFixed(1),
      power: (voltage * currentDraw).toFixed(1), // Watt
      remainingCapacity: (this.sensorData.battery / 100 * dronePhysics.batteryCapacity).toFixed(0),
      estimatedFlightTime: Math.max(0, (this.sensorData.battery / 100 * dronePhysics.batteryCapacity / currentDraw * 60)).toFixed(0) // menit
    };
  };
  
  // Tambah properti fisika drone yang lebih detail
  droneGroup.physics = {
    mass: 0.5,                   // kg
    dimensions: {
      width: 0.25,               // m
      length: 0.25,              // m
      height: 0.1                // m
    },
    thrust: {
      max: 0.7,                  // kg per motor
      current: [0, 0, 0, 0]      // thrust saat ini per motor dalam kg
    },
    inertia: {
      pitch: 0.005,              // kg*m²
      roll: 0.005,               // kg*m²
      yaw: 0.009                 // kg*m²
    },
    drag: {
      linear: 0.1,               // coefisien hambatan linear
      angular: 0.05              // coefisien hambatan rotasi
    },
    flightCharacteristics: {
      maxSpeed: 10,              // m/s
      maxClimbRate: 5,           // m/s
      maxDescentRate: 3,         // m/s
      maxYawRate: 200,           // derajat/s
      maxTiltAngle: 35           // derajat
    },
    battery: {
      capacity: 2200,            // mAh
      voltage: 11.1,             // V (3S LiPo)
      currentDraw: 0             // A
    },
    status: {
      throttle: 0,               // 0-100%
      voltage: 11.1,             // V
      current: 0,                // A
      power: 0,                  // W
      remainingCapacity: 2200,   // mAh
      estimatedFlightTime: 0     // menit
    }
  };
  
  return droneGroup;
}
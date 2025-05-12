// Controls for the drone simulation
export function setupControls(drone, droneState) {
  // Definisi key mappings
  const keys = {
    ArrowUp: false,    // Maju
    ArrowDown: false,  // Mundur
    ArrowLeft: false,  // Ke kiri
    ArrowRight: false, // Ke kanan
    w: false,          // Naik
    s: false,          // Turun
    a: false,          // Putar kiri
    d: false,          // Putar kanan
    Shift: false,      // Percepatan
  };
  
  // Variabel untuk inertia dan momentum
  const flightDynamics = {
    velocity: { x: 0, y: 0, z: 0 },
    rotationVelocity: { x: 0, y: 0, z: 0 },
    maxVelocity: 0.1,
    maxRotVelocity: 0.02,
    acceleration: 0.003,
    deceleration: 0.98,
    gravity: 0.001,
    lift: 0.0011,
    groundEffect: 1.5,
    groundEffectHeight: 2,
    windFactor: { x: 0, y: 0, z: 0 },
    lastTime: Date.now(),
    controlSource: 'manual' // 'manual', 'autopilot', 'obstacle_avoidance', 'landing'
  };
  
  // Ekspos flightDynamics ke window sehingga dapat diakses dari drone.js
  window.flightDynamics = flightDynamics;
  
  // Secara random update faktor angin setiap 5 detik
  setInterval(() => {
    flightDynamics.windFactor = {
      x: (Math.random() - 0.5) * 0.0002,
      y: (Math.random() - 0.5) * 0.0001,
      z: (Math.random() - 0.5) * 0.0002
    };
  }, 5000);
  
  // Export obyek keys ke global untuk diakses oleh drone.js
  window.keys = keys;
  
  // Event listener untuk key down
  window.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key)) {
      keys[event.key] = true;
      event.preventDefault();
    }
  });
  
  // Event listener untuk key up
  window.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key)) {
      keys[event.key] = false;
      event.preventDefault();
    }
  });
  
  // Tambahkan info kontrol ke layar
  addControlsInfo();
  
  // Perbarui posisi dan rotasi pada frame animasi
  function updateDronePosition() {
    const currentTime = Date.now();
    const deltaTime = (currentTime - flightDynamics.lastTime) / 16.67; // Normalisasi ke 60fps
    flightDynamics.lastTime = currentTime;
    
    // Terapkan gravitasi (drone akan jatuh jika tidak ada input vertical)
    flightDynamics.velocity.y -= flightDynamics.gravity * deltaTime;
    
    // Ground effect - gaya angkat lebih besar dekat tanah
    if (drone.position.y < flightDynamics.groundEffectHeight) {
      const groundEffectMultiplier = 1 + ((flightDynamics.groundEffectHeight - drone.position.y) / 
                                         flightDynamics.groundEffectHeight * flightDynamics.groundEffect);
      flightDynamics.velocity.y += flightDynamics.lift * groundEffectMultiplier * deltaTime;
    } else {
      // Gaya angkat normal
      flightDynamics.velocity.y += flightDynamics.lift * deltaTime;
    }
    
    // Cek apakah kontrol manual diaktifkan
    if (droneState.manualControlEnabled) {
      // Set control source
      flightDynamics.controlSource = 'manual';
      
      // Tambah kecepatan jika shift ditekan
      const speedMultiplier = keys.Shift ? 1.3 : 1;
      const currentSpeed = droneState.speed * speedMultiplier;
      const currentRotationSpeed = droneState.rotationSpeed;
      
      // Maju/mundur (sumbu Z) - percepat secara bertahap
      if (keys.ArrowUp) {
        // Menyesuaikan arah berdasarkan rotasi drone
        flightDynamics.velocity.x += Math.sin(drone.rotation.y) * flightDynamics.acceleration * deltaTime;
        flightDynamics.velocity.z -= Math.cos(drone.rotation.y) * flightDynamics.acceleration * deltaTime;
        // Menambahkan pitch saat bergerak maju
        flightDynamics.rotationVelocity.x = -0.02 * speedMultiplier;
      } else if (keys.ArrowDown) {
        flightDynamics.velocity.x -= Math.sin(drone.rotation.y) * flightDynamics.acceleration * deltaTime;
        flightDynamics.velocity.z += Math.cos(drone.rotation.y) * flightDynamics.acceleration * deltaTime;
        // Menambahkan pitch saat bergerak mundur
        flightDynamics.rotationVelocity.x = 0.02 * speedMultiplier;
      } else {
        // Kembalikan pitch ke normal secara perlahan
        flightDynamics.rotationVelocity.x *= 0.9;
      }
      
      // Kiri/kanan (sumbu X) - percepat secara bertahap
      if (keys.ArrowLeft) {
        flightDynamics.velocity.x -= Math.cos(drone.rotation.y) * flightDynamics.acceleration * deltaTime;
        flightDynamics.velocity.z -= Math.sin(drone.rotation.y) * flightDynamics.acceleration * deltaTime;
        // Menambahkan roll saat bergerak ke kiri
        flightDynamics.rotationVelocity.z = 0.02 * speedMultiplier;
      } else if (keys.ArrowRight) {
        flightDynamics.velocity.x += Math.cos(drone.rotation.y) * flightDynamics.acceleration * deltaTime;
        flightDynamics.velocity.z += Math.sin(drone.rotation.y) * flightDynamics.acceleration * deltaTime;
        // Menambahkan roll saat bergerak ke kanan
        flightDynamics.rotationVelocity.z = -0.02 * speedMultiplier;
      } else {
        // Kembalikan roll ke normal secara perlahan
        flightDynamics.rotationVelocity.z *= 0.9;
      }
      
      // Naik/turun (sumbu Y) - lebih responsif daripada gerakan horizontal
      if (keys.w) {
        flightDynamics.velocity.y += flightDynamics.acceleration * 1.2 * deltaTime;
      } else if (keys.s) {
        flightDynamics.velocity.y -= flightDynamics.acceleration * 1.2 * deltaTime;
      }
      
      // Rotasi (putar kiri/kanan)
      if (keys.a) {
        flightDynamics.rotationVelocity.y += currentRotationSpeed * 0.3 * deltaTime;
      } else if (keys.d) {
        flightDynamics.rotationVelocity.y -= currentRotationSpeed * 0.3 * deltaTime;
      } else {
        // Perlambat rotasi yaw secara bertahap
        flightDynamics.rotationVelocity.y *= 0.95;
      }
    } else {
      // Jika kontrol manual dinonaktifkan, biarkan flight dynamics dikendalikan oleh sistem lain
      // (misal: autopilot, obstacle avoidance, landing system)
      // Jangan reset velocity di sini untuk memungkinkan sistem lain mengontrol drone
    }
    
    // Batasi kecepatan maksimum
    const maxVelocity = flightDynamics.maxVelocity * (keys.Shift && droneState.manualControlEnabled ? 1.3 : 1);
    flightDynamics.velocity.x = clamp(flightDynamics.velocity.x, -maxVelocity, maxVelocity);
    flightDynamics.velocity.y = clamp(flightDynamics.velocity.y, -maxVelocity, maxVelocity);
    flightDynamics.velocity.z = clamp(flightDynamics.velocity.z, -maxVelocity, maxVelocity);
    
    // Batasi kecepatan rotasi maksimum
    flightDynamics.rotationVelocity.x = clamp(flightDynamics.rotationVelocity.x, -flightDynamics.maxRotVelocity, flightDynamics.maxRotVelocity);
    flightDynamics.rotationVelocity.y = clamp(flightDynamics.rotationVelocity.y, -flightDynamics.maxRotVelocity, flightDynamics.maxRotVelocity);
    flightDynamics.rotationVelocity.z = clamp(flightDynamics.rotationVelocity.z, -flightDynamics.maxRotVelocity, flightDynamics.maxRotVelocity);
    
    // Terapkan faktor angin acak
    flightDynamics.velocity.x += flightDynamics.windFactor.x * deltaTime;
    flightDynamics.velocity.y += flightDynamics.windFactor.y * deltaTime;
    flightDynamics.velocity.z += flightDynamics.windFactor.z * deltaTime;
    
    // Terapkan momentum dan perlambatan natural
    flightDynamics.velocity.x *= flightDynamics.deceleration;
    flightDynamics.velocity.y *= flightDynamics.deceleration;
    flightDynamics.velocity.z *= flightDynamics.deceleration;
    
    // Perbarui posisi drone berdasarkan kecepatan
    drone.position.x += flightDynamics.velocity.x * deltaTime;
    drone.position.y += flightDynamics.velocity.y * deltaTime;
    drone.position.z += flightDynamics.velocity.z * deltaTime;
    
    // Perbarui rotasi drone berdasarkan kecepatan rotasi
    drone.rotation.x += flightDynamics.rotationVelocity.x * deltaTime;
    drone.rotation.y += flightDynamics.rotationVelocity.y * deltaTime;
    drone.rotation.z += flightDynamics.rotationVelocity.z * deltaTime;
    
    // Pastikan drone tidak jatuh ke tanah
    if (drone.position.y < 0.5) {
      drone.position.y = 0.5;
      flightDynamics.velocity.y = 0;
    }
    
    // Tambah sedikit efek melayang (hover effect)
    const hoverNoise = Math.sin(currentTime * 0.001) * 0.001;
    drone.position.y += hoverNoise;
    
    // Batasi batas ketinggian maksimum di dalam kandang (10m)
    if (drone.position.y > 10) {
      drone.position.y = 10;
      flightDynamics.velocity.y = 0;
    }
    
    // Batasi area pergerakan drone di dalam kandang (45m x 45m)
    const bounds = 45;
    if (Math.abs(drone.position.x) > bounds) {
      drone.position.x = Math.sign(drone.position.x) * bounds;
      flightDynamics.velocity.x = 0;
    }
    if (Math.abs(drone.position.z) > bounds) {
      drone.position.z = Math.sign(drone.position.z) * bounds;
      flightDynamics.velocity.z = 0;
    }
    
    // Update drone's sensor data if available
    if (drone.updateSensorData) {
      drone.updateSensorData();
    }
    
    // Rekursi untuk frame berikutnya
    requestAnimationFrame(updateDronePosition);
  }
  
  // Fungsi untuk membatasi nilai dalam rentang
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  
  // Mulai update posisi drone
  updateDronePosition();
}

// Tambahkan info kontrol ke layar
function addControlsInfo() {
  const controlsInfo = document.createElement('div');
  controlsInfo.style.position = 'absolute';
  controlsInfo.style.top = '20px';
  controlsInfo.style.left = '20px';
  controlsInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  controlsInfo.style.color = 'white';
  controlsInfo.style.padding = '15px';
  controlsInfo.style.borderRadius = '5px';
  controlsInfo.style.fontFamily = 'Arial, sans-serif';
  controlsInfo.style.fontSize = '14px';
  controlsInfo.style.lineHeight = '1.5';
  controlsInfo.style.zIndex = '1000';
  
  controlsInfo.innerHTML = `
    <h3 style="margin-top: 0; color: #44AAFF;">Kontrol Drone Simulator</h3>
    <ul style="padding-left: 20px; margin-bottom: 0;">
      <li>Panah Atas / Bawah: Maju / Mundur</li>
      <li>Panah Kiri / Kanan: Bergerak Ke Kiri / Kanan</li>
      <li>W / S: Naik / Turun</li>
      <li>A / D: Putar Kiri / Kanan</li>
      <li>Shift: Kecepatan Lebih Cepat</li>
      <li>Mouse: Geser untuk Menggerakkan Kamera</li>
      <li>Scroll Mouse: Zoom In / Out</li>
    </ul>
  `;
  
  document.body.appendChild(controlsInfo);
} 
import * as THREE from 'three';

// Helper function to add userData type to objects for LOD optimization
function tagObjectForLOD(object, type) {
  if (object.isGroup) {
    object.userData.type = type;
    object.children.forEach(child => {
      tagObjectForLOD(child, type);
    });
  } else if (object.isMesh) {
    object.userData.type = type;
  }
  return object;
}

export function createEnvironment(scene) {
  // Pencahayaan ini akan diganti dengan pencahayaan dari Sky
  // Tetapi tetap sediakan fallback ambient light untuk area yang gelap
  const ambientLight = new THREE.AmbientLight(0xfffbe5, 0.35); // Warna hangat untuk ambient light
  scene.add(ambientLight);
  
  // Kita tidak perlu tambahkan directional light disini lagi karena sudah ada
  // dari Sky di main.js, tapi tetap biarkan fill light untuk area dalam bayangan
  
  // Tambahkan fill light untuk area yang gelap dengan warna yang lebih hangat
  const fillLight = new THREE.DirectionalLight(0xffd580, 0.25); // Warna oranye hangat
  fillLight.position.set(-50, 40, -30);
  fillLight.castShadow = false; // Fill light tidak perlu cast shadow
  scene.add(fillLight);
  
  // Tambahkan subtle hemisphere light untuk ambient occlusion alami
  const hemiLight = new THREE.HemisphereLight(0xffd580, 0x334455, 0.2);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);
  
  // Buat kandang ayam dengan material PBR
  createChickenCoop(scene, null);
  
  // Tambahkan peralatan dan elemen kandang
  const coopEquipment = createCoopEquipment(null);
  scene.add(coopEquipment);
  
  // Tambahkan beberapa ayam dan tanaman sayur
  const chickensAndVegetables = createChickensAndVegetables(null);
  scene.add(chickensAndVegetables);
  
  // Tambahkan area luar kandang
  const outsideArea = createOutsideArea(null);
  scene.add(outsideArea);
  
  // Tambahkan sistem ventilasi
  const ventilationSystem = createVentilationSystem(100, 100, 3, null);
  scene.add(ventilationSystem);
  
  // Tambahkan efek partikel (debu dan bulu)
  const particles = createParticles(scene, 100, 100);
  scene.add(particles);
  
  // Tambahkan fog untuk kedalaman yang lebih realistis
  scene.fog = new THREE.FogExp2(0xaabbcc, 0.004);
}

// Helper untuk material PBR dengan tekstur
function createPBRMaterial(textureLoader, baseColor, roughness, metalness, textureOptions = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: roughness,
    metalness: metalness
  });
  
  // Add textures if provided in options
  if (textureOptions.map) {
    try {
      material.map = textureLoader.load(textureOptions.map);
      if (textureOptions.mapRepeat) {
        material.map.repeat.set(...textureOptions.mapRepeat);
        material.map.wrapS = material.map.wrapT = THREE.RepeatWrapping;
      }
    } catch (e) {
      console.warn(`Failed to load texture: ${textureOptions.map}`, e);
    }
  }
  
  if (textureOptions.normalMap) {
    try {
      material.normalMap = textureLoader.load(textureOptions.normalMap);
      if (textureOptions.mapRepeat) {
        material.normalMap.repeat.set(...textureOptions.mapRepeat);
        material.normalMap.wrapS = material.normalMap.wrapT = THREE.RepeatWrapping;
      }
    } catch (e) {
      console.warn(`Failed to load normal map: ${textureOptions.normalMap}`, e);
    }
  }
  
  if (textureOptions.roughnessMap) {
    try {
      material.roughnessMap = textureLoader.load(textureOptions.roughnessMap);
      if (textureOptions.mapRepeat) {
        material.roughnessMap.repeat.set(...textureOptions.mapRepeat);
        material.roughnessMap.wrapS = material.roughnessMap.wrapT = THREE.RepeatWrapping;
      }
    } catch (e) {
      console.warn(`Failed to load roughness map: ${textureOptions.roughnessMap}`, e);
    }
  }
  
  return material;
}

function addRoomLights(scene) {
  // Lampu utama dari langit-langit
  const mainLight = new THREE.PointLight(0xFFFFFF, 1.5, 20);
  mainLight.position.set(0, 5, 0);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 1024;
  mainLight.shadow.mapSize.height = 1024;
  scene.add(mainLight);
  
  // Tambahkan beberapa lampu dinding
  const wallLight1 = new THREE.PointLight(0xFFDCAA, 0.8, 10);
  wallLight1.position.set(-9, 3, 0);
  wallLight1.castShadow = true;
  scene.add(wallLight1);
  
  const wallLight2 = new THREE.PointLight(0xFFDCAA, 0.8, 10);
  wallLight2.position.set(9, 3, 0);
  wallLight2.castShadow = true;
  scene.add(wallLight2);
  
  const wallLight3 = new THREE.PointLight(0xFFDCAA, 0.8, 10);
  wallLight3.position.set(0, 3, -9);
  wallLight3.castShadow = true;
  scene.add(wallLight3);
  
  const wallLight4 = new THREE.PointLight(0xFFDCAA, 0.8, 10);
  wallLight4.position.set(0, 3, 9);
  wallLight4.castShadow = true;
  scene.add(wallLight4);
  
  // Helper object untuk menunjukkan posisi lampu
  const createLightHelper = (x, y, z) => {
    const lightBulbGeometry = new THREE.SphereGeometry(0.1, 16, 8);
    const lightBulbMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xFFFF00,
      emissive: 0xFFFF00,
      emissiveIntensity: 1
    });
    const lightBulb = new THREE.Mesh(lightBulbGeometry, lightBulbMaterial);
    lightBulb.position.set(x, y, z);
    return lightBulb;
  };
  
  scene.add(createLightHelper(0, 5, 0));
  scene.add(createLightHelper(-9, 3, 0));
  scene.add(createLightHelper(9, 3, 0));
  scene.add(createLightHelper(0, 3, -9));
  scene.add(createLightHelper(0, 3, 9));
}

function createRoom(scene) {
  // Material untuk lantai
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x665544,
    roughness: 0.8,
    metalness: 0.2,
  });
  
  // Material untuk dinding
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xEEEEEE,
    roughness: 0.95,
    metalness: 0.05,
  });
  
  // Material untuk langit-langit
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness: 0.95,
    metalness: 0.05,
  });
  
  // Lantai
  const floorGeometry = new THREE.BoxGeometry(20, 0.2, 20);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);
  
  // Langit-langit
  const ceilingGeometry = new THREE.BoxGeometry(20, 0.2, 20);
  const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
  ceiling.position.y = 6;
  ceiling.receiveShadow = true;
  scene.add(ceiling);
  
  // Dinding-dinding
  const wallGeometry = new THREE.BoxGeometry(20, 6, 0.2);
  
  // Dinding belakang
  const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
  backWall.position.set(0, 3, -10);
  backWall.receiveShadow = true;
  scene.add(backWall);
  
  // Dinding depan (dengan pintu)
  const frontWallLeft = new THREE.BoxGeometry(8, 6, 0.2);
  const frontWallLeftMesh = new THREE.Mesh(frontWallLeft, wallMaterial);
  frontWallLeftMesh.position.set(-6, 3, 10);
  frontWallLeftMesh.receiveShadow = true;
  scene.add(frontWallLeftMesh);
  
  const frontWallRight = new THREE.BoxGeometry(8, 6, 0.2);
  const frontWallRightMesh = new THREE.Mesh(frontWallRight, wallMaterial);
  frontWallRightMesh.position.set(6, 3, 10);
  frontWallRightMesh.receiveShadow = true;
  scene.add(frontWallRightMesh);
  
  const frontWallTop = new THREE.BoxGeometry(4, 2, 0.2);
  const frontWallTopMesh = new THREE.Mesh(frontWallTop, wallMaterial);
  frontWallTopMesh.position.set(0, 5, 10);
  frontWallTopMesh.receiveShadow = true;
  scene.add(frontWallTopMesh);
  
  // Dinding kiri
  const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
  leftWall.position.set(-10, 3, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  scene.add(leftWall);
  
  // Dinding kanan (dengan jendela)
  const rightWallBottom = new THREE.BoxGeometry(20, 2, 0.2);
  const rightWallBottomMesh = new THREE.Mesh(rightWallBottom, wallMaterial);
  rightWallBottomMesh.position.set(10, 1, 0);
  rightWallBottomMesh.rotation.y = Math.PI / 2;
  rightWallBottomMesh.receiveShadow = true;
  scene.add(rightWallBottomMesh);
  
  const rightWallTop = new THREE.BoxGeometry(20, 2, 0.2);
  const rightWallTopMesh = new THREE.Mesh(rightWallTop, wallMaterial);
  rightWallTopMesh.position.set(10, 5, 0);
  rightWallTopMesh.rotation.y = Math.PI / 2;
  rightWallTopMesh.receiveShadow = true;
  scene.add(rightWallTopMesh);
  
  const rightWallLeft = new THREE.BoxGeometry(2, 2, 0.2);
  const rightWallLeftMesh = new THREE.Mesh(rightWallLeft, wallMaterial);
  rightWallLeftMesh.position.set(10, 3, -9);
  rightWallLeftMesh.rotation.y = Math.PI / 2;
  rightWallLeftMesh.receiveShadow = true;
  scene.add(rightWallLeftMesh);
  
  const rightWallRight = new THREE.BoxGeometry(2, 2, 0.2);
  const rightWallRightMesh = new THREE.Mesh(rightWallRight, wallMaterial);
  rightWallRightMesh.position.set(10, 3, 9);
  rightWallRightMesh.rotation.y = Math.PI / 2;
  rightWallRightMesh.receiveShadow = true;
  scene.add(rightWallRightMesh);
  
  const rightWallMiddle = new THREE.BoxGeometry(10, 2, 0.2);
  const rightWallMiddleMesh = new THREE.Mesh(rightWallMiddle, wallMaterial);
  rightWallMiddleMesh.position.set(10, 3, 0);
  rightWallMiddleMesh.rotation.y = Math.PI / 2;
  rightWallMiddleMesh.receiveShadow = true;
  scene.add(rightWallMiddleMesh);
  
  // Buat jendela
  const windowGeometry = new THREE.PlaneGeometry(4, 2);
  const windowMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xAACCFF,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.7,
    transmission: 0.5
  });
  
  const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
  window1.position.set(10.1, 3, -5);
  window1.rotation.y = Math.PI / 2;
  scene.add(window1);
  
  const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
  window2.position.set(10.1, 3, 5);
  window2.rotation.y = Math.PI / 2;
  scene.add(window2);
  
  // Pintu
  const doorGeometry = new THREE.BoxGeometry(4, 4, 0.1);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.8,
    metalness: 0.2
  });
  const door = new THREE.Mesh(doorGeometry, doorMaterial);
  door.position.set(0, 2, 10);
  scene.add(door);
  
  // Gagang pintu
  const doorknobGeometry = new THREE.SphereGeometry(0.1, 16, 8);
  const doorknobMaterial = new THREE.MeshStandardMaterial({
    color: 0xBBBB44,
    roughness: 0.3,
    metalness: 0.8
  });
  const doorknob = new THREE.Mesh(doorknobGeometry, doorknobMaterial);
  doorknob.position.set(1.5, 2, 10.1);
  scene.add(doorknob);
}

function createFurniture() {
  const furnitureGroup = new THREE.Group();
  
  // Material untuk furnitur kayu
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.8,
    metalness: 0.2
  });
  
  // Material untuk sofa
  const sofaMaterial = new THREE.MeshStandardMaterial({
    color: 0x3366AA,
    roughness: 0.9,
    metalness: 0.1
  });
  
  // Material untuk meja
  const tableMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.7,
    metalness: 0.3
  });
  
  // Material untuk layar TV
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.5,
    metalness: 0.8,
    emissive: 0x222222,
    emissiveIntensity: 0.5
  });
  
  // Sofa
  const sofaBase = new THREE.BoxGeometry(5, 0.8, 2);
  const sofaBaseMesh = new THREE.Mesh(sofaBase, sofaMaterial);
  sofaBaseMesh.position.set(0, 0.4, -8);
  sofaBaseMesh.castShadow = true;
  furnitureGroup.add(sofaBaseMesh);
  
  const sofaBack = new THREE.BoxGeometry(5, 1.5, 0.6);
  const sofaBackMesh = new THREE.Mesh(sofaBack, sofaMaterial);
  sofaBackMesh.position.set(0, 1.35, -8.7);
  sofaBackMesh.castShadow = true;
  furnitureGroup.add(sofaBackMesh);
  
  const sofaArmLeft = new THREE.BoxGeometry(0.6, 1.2, 2);
  const sofaArmLeftMesh = new THREE.Mesh(sofaArmLeft, sofaMaterial);
  sofaArmLeftMesh.position.set(-2.7, 1, -8);
  sofaArmLeftMesh.castShadow = true;
  furnitureGroup.add(sofaArmLeftMesh);
  
  const sofaArmRight = new THREE.BoxGeometry(0.6, 1.2, 2);
  const sofaArmRightMesh = new THREE.Mesh(sofaArmRight, sofaMaterial);
  sofaArmRightMesh.position.set(2.7, 1, -8);
  sofaArmRightMesh.castShadow = true;
  furnitureGroup.add(sofaArmRightMesh);
  
  // Meja tengah
  const tableTop = new THREE.BoxGeometry(3, 0.2, 1.5);
  const tableTopMesh = new THREE.Mesh(tableTop, tableMaterial);
  tableTopMesh.position.set(0, 0.6, -5);
  tableTopMesh.castShadow = true;
  tableTopMesh.receiveShadow = true;
  furnitureGroup.add(tableTopMesh);
  
  const tableLegGeometry = new THREE.BoxGeometry(0.2, 0.6, 0.2);
  const createTableLeg = (x, z) => {
    const tableLeg = new THREE.Mesh(tableLegGeometry, tableMaterial);
    tableLeg.position.set(x, 0.3, z);
    tableLeg.castShadow = true;
    furnitureGroup.add(tableLeg);
  };
  
  createTableLeg(1.4, -4.25);
  createTableLeg(-1.4, -4.25);
  createTableLeg(1.4, -5.75);
  createTableLeg(-1.4, -5.75);
  
  // TV dan unit TV
  const tvStandGeometry = new THREE.BoxGeometry(4, 0.8, 1.5);
  const tvStand = new THREE.Mesh(tvStandGeometry, woodMaterial);
  tvStand.position.set(0, 0.4, -1);
  tvStand.castShadow = true;
  tvStand.receiveShadow = true;
  furnitureGroup.add(tvStand);
  
  const tvFrameGeometry = new THREE.BoxGeometry(3.5, 2, 0.2);
  const tvFrame = new THREE.Mesh(tvFrameGeometry, woodMaterial);
  tvFrame.position.set(0, 2, -1);
  tvFrame.castShadow = true;
  furnitureGroup.add(tvFrame);
  
  const tvScreenGeometry = new THREE.PlaneGeometry(3.2, 1.8);
  const tvScreen = new THREE.Mesh(tvScreenGeometry, screenMaterial);
  tvScreen.position.set(0, 2, -0.9);
  furnitureGroup.add(tvScreen);
  
  // Rak buku
  const bookshelfGeometry = new THREE.BoxGeometry(3, 4, 1);
  const bookshelf = new THREE.Mesh(bookshelfGeometry, woodMaterial);
  bookshelf.position.set(-8, 2, -8);
  bookshelf.castShadow = true;
  furnitureGroup.add(bookshelf);
  
  // Beberapa buku di rak
  const bookColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF, 0xFFFFFF];
  const bookGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.6);
  
  for (let i = 0; i < 12; i++) {
    const bookMaterial = new THREE.MeshStandardMaterial({
      color: bookColors[i % bookColors.length],
      roughness: 0.9,
      metalness: 0.1
    });
    
    const book = new THREE.Mesh(bookGeometry, bookMaterial);
    const shelfLevel = Math.floor(i / 4);
    const bookPosition = (i % 4) - 1.5;
    
    book.position.set(-8 + bookPosition * 0.6, 0.5 + shelfLevel * 1.2, -8);
    book.castShadow = true;
    furnitureGroup.add(book);
  }
  
  // Meja kerja
  const deskGeometry = new THREE.BoxGeometry(4, 0.1, 2);
  const desk = new THREE.Mesh(deskGeometry, woodMaterial);
  desk.position.set(7, 1.5, -8);
  desk.castShadow = true;
  desk.receiveShadow = true;
  furnitureGroup.add(desk);
  
  const deskLegGeometry = new THREE.BoxGeometry(0.2, 1.5, 0.2);
  
  for (let x = -1.9; x <= 1.9; x += 3.8) {
    for (let z = -0.9; z <= 0.9; z += 1.8) {
      const deskLeg = new THREE.Mesh(deskLegGeometry, woodMaterial);
      deskLeg.position.set(7 + x, 0.75, -8 + z);
      deskLeg.castShadow = true;
      furnitureGroup.add(deskLeg);
    }
  }
  
  // Kursi untuk meja kerja
  const chairSeatGeometry = new THREE.BoxGeometry(1, 0.1, 1);
  const chairSeat = new THREE.Mesh(chairSeatGeometry, woodMaterial);
  chairSeat.position.set(7, 0.8, -6.5);
  chairSeat.castShadow = true;
  furnitureGroup.add(chairSeat);
  
  const chairLegGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.1);
  
  for (let x = -0.4; x <= 0.4; x += 0.8) {
    for (let z = -0.4; z <= 0.4; z += 0.8) {
      const chairLeg = new THREE.Mesh(chairLegGeometry, woodMaterial);
      chairLeg.position.set(7 + x, 0.4, -6.5 + z);
      chairLeg.castShadow = true;
      furnitureGroup.add(chairLeg);
    }
  }
  
  const chairBackGeometry = new THREE.BoxGeometry(1, 1, 0.1);
  const chairBack = new THREE.Mesh(chairBackGeometry, woodMaterial);
  chairBack.position.set(7, 1.35, -7);
  chairBack.castShadow = true;
  furnitureGroup.add(chairBack);
  
  return furnitureGroup;
}

function createDecorations() {
  const decorations = new THREE.Group();
  
  // Karpet
  const carpetGeometry = new THREE.CircleGeometry(3, 32);
  const carpetMaterial = new THREE.MeshStandardMaterial({
    color: 0xCC3333,
    roughness: 1.0,
    metalness: 0.0
  });
  const carpet = new THREE.Mesh(carpetGeometry, carpetMaterial);
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.01, -5);
  decorations.add(carpet);
  
  // Tanaman dalam pot
  const potGeometry = new THREE.CylinderGeometry(0.4, 0.3, 0.6, 16);
  const potMaterial = new THREE.MeshStandardMaterial({
    color: 0xCC6644,
    roughness: 0.9,
    metalness: 0.1
  });
  
  const plantPot1 = new THREE.Mesh(potGeometry, potMaterial);
  plantPot1.position.set(-8, 0.3, 8);
  plantPot1.castShadow = true;
  decorations.add(plantPot1);
  
  const plantPot2 = new THREE.Mesh(potGeometry, potMaterial);
  plantPot2.position.set(8, 0.3, 8);
  plantPot2.castShadow = true;
  decorations.add(plantPot2);
  
  // Tambahkan tanaman
  const stemGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8);
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x556633,
    roughness: 0.9,
    metalness: 0.1
  });
  
  const leavesGeometry = new THREE.SphereGeometry(0.5, 16, 8);
  const leavesMaterial = new THREE.MeshStandardMaterial({
    color: 0x33CC33,
    roughness: 0.9,
    metalness: 0.1
  });
  
  // Tanaman 1
  const stem1 = new THREE.Mesh(stemGeometry, stemMaterial);
  stem1.position.set(-8, 1.15, 8);
  stem1.castShadow = true;
  decorations.add(stem1);
  
  const leaves1 = new THREE.Mesh(leavesGeometry, leavesMaterial);
  leaves1.position.set(-8, 1.9, 8);
  leaves1.castShadow = true;
  decorations.add(leaves1);
  
  // Tanaman 2
  const stem2 = new THREE.Mesh(stemGeometry, stemMaterial);
  stem2.position.set(8, 1.15, 8);
  stem2.castShadow = true;
  decorations.add(stem2);
  
  const leaves2 = new THREE.Mesh(leavesGeometry, leavesMaterial);
  leaves2.position.set(8, 1.9, 8);
  leaves2.castShadow = true;
  decorations.add(leaves2);
  
  // Lukisan dinding
  const frameGeometry = new THREE.BoxGeometry(2, 1.5, 0.1);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0xDDDD55,
    roughness: 0.6,
    metalness: 0.4
  });
  
  const paintingGeometry = new THREE.PlaneGeometry(1.8, 1.3);
  const paintingMaterial1 = new THREE.MeshStandardMaterial({
    color: 0x3399CC,
    roughness: 0.9,
    metalness: 0.1
  });
  
  const paintingMaterial2 = new THREE.MeshStandardMaterial({
    color: 0xCC5533,
    roughness: 0.9,
    metalness: 0.1
  });
  
  // Lukisan 1
  const paintingFrame1 = new THREE.Mesh(frameGeometry, frameMaterial);
  paintingFrame1.position.set(-5, 3, -9.9);
  paintingFrame1.castShadow = true;
  decorations.add(paintingFrame1);
  
  const painting1 = new THREE.Mesh(paintingGeometry, paintingMaterial1);
  painting1.position.set(-5, 3, -9.85);
  decorations.add(painting1);
  
  // Lukisan 2
  const paintingFrame2 = new THREE.Mesh(frameGeometry, frameMaterial);
  paintingFrame2.position.set(5, 3, -9.9);
  paintingFrame2.castShadow = true;
  decorations.add(paintingFrame2);
  
  const painting2 = new THREE.Mesh(paintingGeometry, paintingMaterial2);
  painting2.position.set(5, 3, -9.85);
  decorations.add(painting2);
  
  // Jam dinding
  const clockFrameGeometry = new THREE.CircleGeometry(0.6, 32);
  const clockFrameMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness: 0.5,
    metalness: 0.5
  });
  
  const clockFace = new THREE.Mesh(clockFrameGeometry, clockFrameMaterial);
  clockFace.position.set(0, 4, -9.9);
  decorations.add(clockFace);
  
  // Jarum jam
  const hourHandGeometry = new THREE.BoxGeometry(0.05, 0.3, 0.01);
  const hourHand = new THREE.Mesh(hourHandGeometry, new THREE.MeshBasicMaterial({ color: 0x000000 }));
  hourHand.position.set(0, 4, -9.85);
  hourHand.rotation.z = Math.PI / 3; // Posisi jam
  decorations.add(hourHand);
  
  const minuteHandGeometry = new THREE.BoxGeometry(0.03, 0.45, 0.01);
  const minuteHand = new THREE.Mesh(minuteHandGeometry, new THREE.MeshBasicMaterial({ color: 0x000000 }));
  minuteHand.position.set(0, 4, -9.85);
  minuteHand.rotation.z = Math.PI / 6; // Posisi menit
  decorations.add(minuteHand);
  
  // Tag all decorations for LOD optimization
  return tagObjectForLOD(decorations, 'decoration');
}

function createChickenCoop(scene, textureLoader) {
  // Material untuk tanah kandang
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0xC2B280, // Warna sekam atau serbuk kayu
    roughness: 1.0,
    metalness: 0.0,
  });
  
  // Material untuk dinding dan struktur kandang (beton/semen)
  const concreteMaterial = new THREE.MeshStandardMaterial({
    color: 0xCCCCCC, // Warna beton
    roughness: 0.9,
    metalness: 0.1,
  });
  
  // Material untuk atap kandang
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: 0x777777, // Warna atap
    roughness: 0.9,
    metalness: 0.3,
  });
  
  // Material untuk jendela biru
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x87CEEB, // Warna biru langit
    roughness: 0.3,
    metalness: 0.2,
    transparent: true,
    opacity: 0.7
  });
  
  // Ukuran kandang (100x100 meter)
  const coopWidth = 100;
  const coopDepth = 100;
  const wallHeight = 3; // Tinggi kandang 3 meter
  const numRows = 8; // Jumlah baris tempat makan
  const numCols = 16; // Jumlah kolom tempat makan
  
  // Lantai kandang (tanah dengan sekam/serbuk kayu)
  const groundGeometry = new THREE.BoxGeometry(coopWidth, 0.2, coopDepth);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Struktur bangunan kandang
  createCoopBuilding(scene, concreteMaterial, roofMaterial, windowMaterial, coopWidth, coopDepth, wallHeight);
  
  // Sistem pemberi pakan dan minum otomatis
  createFeedingSystem(scene, numRows, numCols, coopWidth, coopDepth);
  
  // Tambahkan banyak ayam di dalam kandang
  createManyChickens(scene, 500, coopWidth, coopDepth); // 500 ayam
  
  return;
}

function createCoopBuilding(scene, concreteMaterial, roofMaterial, windowMaterial, width, depth, height) {
  // Membuat pilar-pilar beton
  const pillarSize = 0.8;
  const pillarGeometry = new THREE.BoxGeometry(pillarSize, height, pillarSize);
  const numPillarsWidth = Math.floor(width / 20); // Kurangi jumlah tiang (sebelumnya / 10)
  const numPillarsDepth = Math.floor(depth / 20); // Kurangi jumlah tiang (sebelumnya / 10)
  
  // Array untuk menyimpan posisi pilar agar bisa menghubungkannya dengan balok nanti
  const pillarPositions = [];
  
  // Membuat pilar-pilar
  for (let x = 0; x < numPillarsWidth; x++) {
    for (let z = 0; z < numPillarsDepth; z++) {
      // Hanya buat pilar di tepi atau di sudut saja
      if (x === 0 || z === 0 || x === numPillarsWidth - 1 || z === numPillarsDepth - 1) {
        // Hanya buat pilar pada interval lebih besar untuk mengurangi jumlah tiang
        if ((x === 0 || x === numPillarsWidth - 1) && z % 2 === 0) {
          // Pilar di tepi kiri dan kanan dengan interval 2
          const pillarX = (x * (width / (numPillarsWidth - 1))) - width / 2;
          const pillarZ = (z * (depth / (numPillarsDepth - 1))) - depth / 2;
          
          const pillar = new THREE.Mesh(pillarGeometry, concreteMaterial);
          pillar.position.set(pillarX, height / 2, pillarZ);
          pillar.castShadow = true;
          pillar.receiveShadow = true;
          scene.add(pillar);
          
          // Simpan posisi pilar
          pillarPositions.push({ x: pillarX, z: pillarZ });
        } else if ((z === 0 || z === numPillarsDepth - 1) && x % 2 === 0) {
          // Pilar di tepi depan dan belakang dengan interval 2
          const pillarX = (x * (width / (numPillarsWidth - 1))) - width / 2;
          const pillarZ = (z * (depth / (numPillarsDepth - 1))) - depth / 2;
          
          const pillar = new THREE.Mesh(pillarGeometry, concreteMaterial);
          pillar.position.set(pillarX, height / 2, pillarZ);
          pillar.castShadow = true;
          pillar.receiveShadow = true;
          scene.add(pillar);
          
          // Simpan posisi pilar
          pillarPositions.push({ x: pillarX, z: pillarZ });
        }
      }
    }
  }
  
  // Buat balok penghubung horizontal di sepanjang tepi kandang untuk menyatukan pilar-pilar
  // Tepi depan (z = -depth/2)
  const frontPillars = pillarPositions.filter(p => Math.abs(p.z + depth/2) < 0.1);
  frontPillars.sort((a, b) => a.x - b.x);
  
  // Tepi belakang (z = depth/2)
  const backPillars = pillarPositions.filter(p => Math.abs(p.z - depth/2) < 0.1);
  backPillars.sort((a, b) => a.x - b.x);
  
  // Tepi kiri (x = -width/2)
  const leftPillars = pillarPositions.filter(p => Math.abs(p.x + width/2) < 0.1);
  leftPillars.sort((a, b) => a.z - b.z);
  
  // Tepi kanan (x = width/2)
  const rightPillars = pillarPositions.filter(p => Math.abs(p.x - width/2) < 0.1);
  rightPillars.sort((a, b) => a.z - b.z);
  
  // Fungsi bantuan untuk membuat balok penghubung antar pilar
  const createConnectingBeam = (startX, startZ, endX, endZ) => {
    const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endZ - startZ, 2));
    const beamGeometry = new THREE.BoxGeometry(length, 0.5, 0.5);
    const beam = new THREE.Mesh(beamGeometry, concreteMaterial);
    
    // Posisikan di tengah antara dua pilar
    beam.position.set((startX + endX) / 2, height, (startZ + endZ) / 2);
    
    // Rotasi untuk mengarahkan balok
    const angle = Math.atan2(endZ - startZ, endX - startX);
    beam.rotation.y = angle;
    
    beam.castShadow = true;
    scene.add(beam);
  };
  
  // Buat balok penghubung di depan
  for (let i = 0; i < frontPillars.length - 1; i++) {
    createConnectingBeam(
      frontPillars[i].x, frontPillars[i].z,
      frontPillars[i+1].x, frontPillars[i+1].z
    );
  }
  
  // Buat balok penghubung di belakang
  for (let i = 0; i < backPillars.length - 1; i++) {
    createConnectingBeam(
      backPillars[i].x, backPillars[i].z,
      backPillars[i+1].x, backPillars[i+1].z
    );
  }
  
  // Buat balok penghubung di kiri
  for (let i = 0; i < leftPillars.length - 1; i++) {
    createConnectingBeam(
      leftPillars[i].x, leftPillars[i].z,
      leftPillars[i+1].x, leftPillars[i+1].z
    );
  }
  
  // Buat balok penghubung di kanan
  for (let i = 0; i < rightPillars.length - 1; i++) {
    createConnectingBeam(
      rightPillars[i].x, rightPillars[i].z,
      rightPillars[i+1].x, rightPillars[i+1].z
    );
  }
  
  // Balok struktur atap melintang di tengah (dari depan ke belakang)
  const middleBeams = 5; // Jumlah balok struktur tengah
  const beamSpacing = width / (middleBeams + 1);
  
  for (let i = 1; i <= middleBeams; i++) {
    const beamX = -width/2 + i * beamSpacing;
    
    const beamGeometry = new THREE.BoxGeometry(0.5, 0.5, depth);
    const beam = new THREE.Mesh(beamGeometry, concreteMaterial);
    beam.position.set(beamX, height, 0);
    beam.castShadow = true;
    scene.add(beam);
  }
  
  // Atap
  const roofGeometry = new THREE.BoxGeometry(width + 5, 0.3, depth + 5);
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.set(0, height + 0.4, 0); // Posisikan lebih dekat ke balok
  roof.castShadow = true;
  scene.add(roof);
  
  // Tambahkan jendela di sepanjang dinding
  createWindows(scene, windowMaterial, width, depth, height);
}

function createWindows(scene, windowMaterial, width, depth, height) {
  const windowWidth = 5;
  const windowHeight = 1.5;
  const windowGeometry = new THREE.PlaneGeometry(windowWidth, windowHeight);
  const windowYPos = height - windowHeight/2 - 0.5;
  
  // Jendela di sisi depan dan belakang
  const numWindowsFront = Math.floor(width / (windowWidth + 1));
  for (let i = 0; i < numWindowsFront; i++) {
    const xPos = -width/2 + (i + 0.5) * (width / numWindowsFront);
    
    // Jendela depan
    const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    frontWindow.position.set(xPos, windowYPos, depth/2 + 0.1);
    scene.add(frontWindow);
    
    // Jendela belakang
    const backWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    backWindow.position.set(xPos, windowYPos, -depth/2 - 0.1);
    backWindow.rotation.y = Math.PI;
    scene.add(backWindow);
  }
  
  // Jendela di sisi kiri dan kanan
  const numWindowsSide = Math.floor(depth / (windowWidth + 1));
  for (let i = 0; i < numWindowsSide; i++) {
    const zPos = -depth/2 + (i + 0.5) * (depth / numWindowsSide);
    
    // Jendela kiri
    const leftWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    leftWindow.position.set(-width/2 - 0.1, windowYPos, zPos);
    leftWindow.rotation.y = Math.PI / 2;
    scene.add(leftWindow);
    
    // Jendela kanan
    const rightWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    rightWindow.position.set(width/2 + 0.1, windowYPos, zPos);
    rightWindow.rotation.y = -Math.PI / 2;
    scene.add(rightWindow);
  }
}

function createFeedingSystem(scene, numRows, numCols, width, depth) {
  // Material untuk tempat pakan (merah dan kuning seperti di referensi)
  const redFeederMaterial = new THREE.MeshStandardMaterial({
    color: 0xFF4500, // Merah-oranye
    roughness: 0.5,
    metalness: 0.2
  });
  
  const yellowFeederMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFD700, // Kuning emas
    roughness: 0.5,
    metalness: 0.2
  });
  
  // Material untuk pipa air/pakan
  const pipeMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF, // Putih
    roughness: 0.7,
    metalness: 0.3
  });
  
  // Material untuk batang kayu penghubung
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513, // Coklat kayu
    roughness: 0.9,
    metalness: 0.1
  });
  
  // Ukuran area yang tersedia
  const usableWidth = width * 0.9;
  const usableDepth = depth * 0.9;
  const spacingX = usableWidth / numCols;
  const spacingZ = usableDepth / numRows;
  const startX = -usableWidth / 2 + spacingX / 2;
  const startZ = -usableDepth / 2 + spacingZ / 2;
  
  // Untuk menandai posisi pilar terdekat
  const pillarPositions = [];
  const numPillarsWidth = Math.floor(width / 20);
  const numPillarsDepth = Math.floor(depth / 20);
  
  // Hitung posisi pilar yang ada untuk referensi
  for (let x = 0; x < numPillarsWidth; x++) {
    for (let z = 0; z < numPillarsDepth; z++) {
      if (x === 0 || z === 0 || x === numPillarsWidth - 1 || z === numPillarsDepth - 1) {
        if ((x === 0 || x === numPillarsWidth - 1) && z % 2 === 0) {
          const pillarX = (x * (width / (numPillarsWidth - 1))) - width / 2;
          const pillarZ = (z * (depth / (numPillarsDepth - 1))) - depth / 2;
          pillarPositions.push({ x: pillarX, z: pillarZ });
        } else if ((z === 0 || z === numPillarsDepth - 1) && x % 2 === 0) {
          const pillarX = (x * (width / (numPillarsWidth - 1))) - width / 2;
          const pillarZ = (z * (depth / (numPillarsDepth - 1))) - depth / 2;
          pillarPositions.push({ x: pillarX, z: pillarZ });
        }
      }
    }
  }
  
  // Fungsi untuk mencari pilar terdekat dari posisi feeder
  const findNearestPillar = (x, z) => {
    let nearest = null;
    let minDistance = Infinity;
    
    for (const pillar of pillarPositions) {
      const distance = Math.sqrt(Math.pow(pillar.x - x, 2) + Math.pow(pillar.z - z, 2));
      if (distance < minDistance) {
        minDistance = distance;
        nearest = pillar;
      }
    }
    
    return nearest;
  };
  
  // Buat tempat pakan dan minum
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const x = startX + col * spacingX;
      const z = startZ + row * spacingZ;
      
      // Alternating red and yellow feeders
      const material = (row + col) % 2 === 0 ? redFeederMaterial : yellowFeederMaterial;
      
      // Tempat pakan (bentuk mangkuk)
      const feederGeometry = new THREE.CylinderGeometry(1, 1.5, 1, 16);
      const feeder = new THREE.Mesh(feederGeometry, material);
      feeder.position.set(x, 0.5, z);
      feeder.castShadow = true;
      feeder.receiveShadow = true;
      scene.add(feeder);
      
      // Bagian dalam tempat pakan (pakan)
      const feedGeometry = new THREE.CylinderGeometry(0.8, 1.3, 0.2, 16);
      const feedMaterial = new THREE.MeshStandardMaterial({
        color: 0xD2B48C, // Warna pakan/makanan
        roughness: 1.0,
        metalness: 0.0
      });
      const feed = new THREE.Mesh(feedGeometry, feedMaterial);
      feed.position.set(x, 0.7, z);
      scene.add(feed);
      
      // Pipa pemberi pakan (vertikal)
      const pipeGeometry = new THREE.CylinderGeometry(0.1, 0.1, 6, 8);
      const pipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
      pipe.position.set(x, 3.5, z);
      pipe.castShadow = true;
      scene.add(pipe);
      
      // Mini valve/connector
      const valveGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const valve = new THREE.Mesh(valveGeometry, redFeederMaterial);
      valve.position.set(x, 1.3, z);
      valve.castShadow = true;
      scene.add(valve);
      
      // Mencari pilar terdekat
      const nearestPillar = findNearestPillar(x, z);
      if (nearestPillar) {
        // Membuat balok kayu horizontal yang menghubungkan pilar dengan pipa tempat pakan
        // Hanya buat penghubung jika jaraknya tidak terlalu jauh (kurang dari 20 unit)
        const distance = Math.sqrt(Math.pow(nearestPillar.x - x, 2) + Math.pow(nearestPillar.z - z, 2));
        if (distance < 20) {
          // Posisi tengah antara pilar dan pipa
          const midX = (nearestPillar.x + x) / 2;
          const midZ = (nearestPillar.z + z) / 2;
          
          // Panjang balok kayu
          const beamLength = distance;
          
          // Buat balok kayu horizontal (di ketinggian 2m)
          const horizontalBeamGeometry = new THREE.BoxGeometry(beamLength, 0.3, 0.3);
          const horizontalBeam = new THREE.Mesh(horizontalBeamGeometry, woodMaterial);
          
          // Posisi dan rotasi balok kayu
          horizontalBeam.position.set(midX, 2, midZ);
          const angle = Math.atan2(z - nearestPillar.z, x - nearestPillar.x);
          horizontalBeam.rotation.y = angle;
          
          horizontalBeam.castShadow = true;
          scene.add(horizontalBeam);
          
          // Buat tiang kayu vertikal pendukung di sisi feeder
          const verticalSupportGeometry = new THREE.CylinderGeometry(0.15, 0.15, 2, 8);
          const verticalSupport = new THREE.Mesh(verticalSupportGeometry, woodMaterial);
          verticalSupport.position.set(x, 1, z);
          verticalSupport.castShadow = true;
          scene.add(verticalSupport);
        }
      }
    }
  }
  
  // Pipa utama yang menghubungkan sistem (horizontal, sepanjang baris)
  for (let row = 0; row < numRows; row++) {
    const z = startZ + row * spacingZ;
    const mainPipeGeometry = new THREE.CylinderGeometry(0.15, 0.15, usableWidth, 8);
    mainPipeGeometry.rotateZ(Math.PI / 2); // Rotasi untuk membuat pipa horizontal
    
    const mainPipe = new THREE.Mesh(mainPipeGeometry, pipeMaterial);
    mainPipe.position.set(0, 6, z);
    mainPipe.castShadow = true;
    scene.add(mainPipe);
  }
}

function createManyChickens(scene, count, width, depth) {
  // Reduce chicken count for better performance
  const originalCount = count;
  count = Math.min(count, 30); // Cap at 30 chickens for performance
  
  console.log(`Optimizing chickens: Creating ${count} detailed chickens instead of ${originalCount}`);
  
  // Create a template chicken to clone
  const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
  const beakMaterial = new THREE.MeshPhongMaterial({ color: 0xFFA500 });
  const templateChicken = createOneChicken(bodyMaterial, beakMaterial);
  
  // Create chickens with random positions
  for (let i = 0; i < count; i++) {
    // Random position within the coop area
    const x = (Math.random() - 0.5) * (width * 0.8);
    const z = (Math.random() - 0.5) * (depth * 0.8);
    const rotation = Math.random() * Math.PI * 2;
    
    // Clone the template chicken for better performance
    const chicken = templateChicken.clone();
    
    // Position and rotate the chicken
    chicken.position.set(x, 0, z);
    chicken.rotation.y = rotation;
    
    // Random scale variation (90%-110%)
    const scale = 0.9 + Math.random() * 0.2;
    chicken.scale.set(scale, scale, scale);
    
    // Tag for LOD optimization
    tagObjectForLOD(chicken, 'chicken');
    
    scene.add(chicken);
  }
}

function createOneChicken(bodyMaterial, beakMaterial) {
  const chicken = new THREE.Group();
  
  // Badan ayam
  const bodyGeometry = new THREE.SphereGeometry(1, 16, 16);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.scale.set(1, 0.8, 1.2);
  body.castShadow = true;
  chicken.add(body);
  
  // Kepala ayam
  const headGeometry = new THREE.SphereGeometry(0.6, 16, 16);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.set(0, 0.7, 0.8);
  head.castShadow = true;
  chicken.add(head);
  
  // Paruh
  const beakGeometry = new THREE.ConeGeometry(0.2, 0.5, 8);
  const beak = new THREE.Mesh(beakGeometry, beakMaterial);
  beak.position.set(0, 0.6, 1.3);
  beak.rotation.x = Math.PI / 2;
  beak.castShadow = true;
  chicken.add(beak);
  
  // Jengger (merah)
  const combGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.4);
  const combMaterial = new THREE.MeshStandardMaterial({
    color: 0xFF0000,
    roughness: 0.9,
    metalness: 0.0
  });
  const comb = new THREE.Mesh(combGeometry, combMaterial);
  comb.position.set(0, 1, 0.7);
  comb.castShadow = true;
  chicken.add(comb);
  
  // Ekor
  const tailGeometry = new THREE.ConeGeometry(0.4, 0.8, 8);
  const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
  tail.position.set(0, 0.4, -1);
  tail.rotation.x = -Math.PI / 3;
  tail.castShadow = true;
  chicken.add(tail);
  
  // Sayap
  const wingGeometry = new THREE.SphereGeometry(0.7, 16, 16, 0, Math.PI);
  const leftWing = new THREE.Mesh(wingGeometry, bodyMaterial);
  leftWing.position.set(0.8, 0, 0);
  leftWing.rotation.y = -Math.PI / 2;
  leftWing.castShadow = true;
  chicken.add(leftWing);
  
  const rightWing = new THREE.Mesh(wingGeometry, bodyMaterial);
  rightWing.position.set(-0.8, 0, 0);
  rightWing.rotation.y = Math.PI / 2;
  rightWing.castShadow = true;
  chicken.add(rightWing);
  
  // Kaki
  const legGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8);
  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFF00, // Kuning
    roughness: 0.9,
    metalness: 0.0
  });
  
  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(0.3, -0.7, 0);
  leftLeg.castShadow = true;
  chicken.add(leftLeg);
  
  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(-0.3, -0.7, 0);
  rightLeg.castShadow = true;
  chicken.add(rightLeg);
  
  // Skala seluruh ayam
  chicken.scale.set(0.3, 0.3, 0.3);
  
  return chicken;
}

function createCoopEquipment(textureLoader) {
  const equipmentGroup = new THREE.Group();
  
  // Material untuk peralatan kandang
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.5,
    metalness: 0.8
  });
  
  const plasticMaterial = new THREE.MeshStandardMaterial({
    color: 0xCC4444,
    roughness: 0.9,
    metalness: 0.1
  });
  
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B6914,
    roughness: 0.9,
    metalness: 0.1
  });
  
  // Tempat pakan ayam
  const feederBase = new THREE.BoxGeometry(3, 0.1, 1);
  const feederBaseObj = new THREE.Mesh(feederBase, plasticMaterial);
  feederBaseObj.position.set(-3.5, 0.05, -3.5);
  feederBaseObj.castShadow = true;
  equipmentGroup.add(feederBaseObj);
  
  const feederSideGeometry = new THREE.BoxGeometry(3, 0.3, 0.1);
  
  // Sisi depan
  const feederFront = new THREE.Mesh(feederSideGeometry, plasticMaterial);
  feederFront.position.set(-3.5, 0.15, -3.05);
  feederFront.castShadow = true;
  equipmentGroup.add(feederFront);
  
  // Sisi belakang
  const feederBack = new THREE.Mesh(feederSideGeometry, plasticMaterial);
  feederBack.position.set(-3.5, 0.15, -3.95);
  feederBack.castShadow = true;
  equipmentGroup.add(feederBack);
  
  // Sisi kiri
  const feederSideLeftGeometry = new THREE.BoxGeometry(0.1, 0.3, 1);
  const feederLeft = new THREE.Mesh(feederSideLeftGeometry, plasticMaterial);
  feederLeft.position.set(-4.95, 0.15, -3.5);
  feederLeft.castShadow = true;
  equipmentGroup.add(feederLeft);
  
  // Sisi kanan
  const feederRight = new THREE.Mesh(feederSideLeftGeometry, plasticMaterial);
  feederRight.position.set(-2.05, 0.15, -3.5);
  feederRight.castShadow = true;
  equipmentGroup.add(feederRight);
  
  // Tambahkan pakan
  const feedGeometry = new THREE.BoxGeometry(2.8, 0.05, 0.8);
  const feedMaterial = new THREE.MeshStandardMaterial({
    color: 0xEECC88,
    roughness: 1.0,
    metalness: 0.0
  });
  const feed = new THREE.Mesh(feedGeometry, feedMaterial);
  feed.position.set(-3.5, 0.13, -3.5);
  equipmentGroup.add(feed);
  
  // Tempat minum ayam
  const waterContainerGeometry = new THREE.CylinderGeometry(1, 0.8, 0.5, 16);
  const waterContainer = new THREE.Mesh(waterContainerGeometry, plasticMaterial);
  waterContainer.position.set(3.5, 0.25, -3.5);
  waterContainer.castShadow = true;
  equipmentGroup.add(waterContainer);
  
  // Air di tempat minum
  const waterGeometry = new THREE.CylinderGeometry(0.9, 0.7, 0.2, 16);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x3399FF,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.8
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.set(3.5, 0.35, -3.5);
  equipmentGroup.add(water);
  
  // Tempat tidur ayam (kotak jerami)
  const nestBoxBase = new THREE.BoxGeometry(4, 0.2, 2.5);
  const nestBoxBaseObj = new THREE.Mesh(nestBoxBase, woodMaterial);
  nestBoxBaseObj.position.set(3, 0.1, 3.5);
  nestBoxBaseObj.castShadow = true;
  equipmentGroup.add(nestBoxBaseObj);
  
  // Sisi-sisi kotak jerami
  const nestBoxSideGeometryLong = new THREE.BoxGeometry(4, 0.5, 0.2);
  const nestBoxFront = new THREE.Mesh(nestBoxSideGeometryLong, woodMaterial);
  nestBoxFront.position.set(3, 0.35, 4.65);
  nestBoxFront.castShadow = true;
  equipmentGroup.add(nestBoxFront);
  
  const nestBoxBack = new THREE.Mesh(nestBoxSideGeometryLong, woodMaterial);
  nestBoxBack.position.set(3, 0.35, 2.35);
  nestBoxBack.castShadow = true;
  equipmentGroup.add(nestBoxBack);
  
  const nestBoxSideGeometryShort = new THREE.BoxGeometry(0.2, 0.5, 2.5);
  const nestBoxLeft = new THREE.Mesh(nestBoxSideGeometryShort, woodMaterial);
  nestBoxLeft.position.set(1.1, 0.35, 3.5);
  nestBoxLeft.castShadow = true;
  equipmentGroup.add(nestBoxLeft);
  
  const nestBoxRight = new THREE.Mesh(nestBoxSideGeometryShort, woodMaterial);
  nestBoxRight.position.set(4.9, 0.35, 3.5);
  nestBoxRight.castShadow = true;
  equipmentGroup.add(nestBoxRight);
  
  // Jerami di dalam kotak
  const strawGeometry = new THREE.BoxGeometry(3.6, 0.2, 2.1);
  const strawMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFF66,
    roughness: 1.0,
    metalness: 0.0
  });
  const straw = new THREE.Mesh(strawGeometry, strawMaterial);
  straw.position.set(3, 0.3, 3.5);
  equipmentGroup.add(straw);
  
  // Beberapa telur di jerami
  const eggGeometry = new THREE.SphereGeometry(0.15, 16, 16);
  const eggMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness: 0.3,
    metalness: 0.0
  });
  
  const createEgg = (x, z, rotation) => {
    const egg = new THREE.Mesh(eggGeometry, eggMaterial);
    egg.position.set(x, 0.45, z);
    egg.rotation.x = rotation;
    egg.castShadow = true;
    equipmentGroup.add(egg);
  };
  
  createEgg(2.5, 3.8, 0);
  createEgg(3.2, 3.3, Math.PI / 6);
  createEgg(3.8, 3.7, -Math.PI / 8);
  
  // Alat untuk menyimpan pakan (karung)
  const sackGeometry = new THREE.CylinderGeometry(0.8, 0.8, 1.5, 8);
  const sackMaterial = new THREE.MeshStandardMaterial({
    color: 0xBBBB66,
    roughness: 1.0,
    metalness: 0.0
  });
  const sack = new THREE.Mesh(sackGeometry, sackMaterial);
  sack.position.set(-3.5, 0.75, 3.5);
  sack.castShadow = true;
  equipmentGroup.add(sack);
  
  // Bagian atas karung yang terlipat
  const sackTopGeometry = new THREE.TorusGeometry(0.8, 0.2, 8, 16);
  const sackTop = new THREE.Mesh(sackTopGeometry, sackMaterial);
  sackTop.position.set(-3.5, 1.5, 3.5);
  sackTop.rotation.x = Math.PI / 2;
  sackTop.castShadow = true;
  equipmentGroup.add(sackTop);
  
  // Tambahkan sekop
  const shovelHandleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8);
  const shovelHandleMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.9,
    metalness: 0.0
  });
  const shovelHandle = new THREE.Mesh(shovelHandleGeometry, shovelHandleMaterial);
  shovelHandle.position.set(-2, 1, 3.5);
  shovelHandle.rotation.z = Math.PI / 4;
  shovelHandle.castShadow = true;
  equipmentGroup.add(shovelHandle);
  
  const shovelHeadGeometry = new THREE.BoxGeometry(0.4, 0.05, 0.3);
  const shovelHeadMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    roughness: 0.6,
    metalness: 0.8
  });
  const shovelHead = new THREE.Mesh(shovelHeadGeometry, shovelHeadMaterial);
  shovelHead.position.set(-1.3, 0.5, 3.5);
  shovelHead.rotation.z = Math.PI / 4;
  shovelHead.castShadow = true;
  equipmentGroup.add(shovelHead);
  
  return equipmentGroup;
}

function createChickensAndVegetables(textureLoader) {
  const group = new THREE.Group();
  
  // Buat beberapa ayam tersebar di seluruh kandang
  const chickens = createChickens(textureLoader);
  group.add(chickens);
  
  // Buat beberapa tanaman sayur di satu sisi kandang
  const vegetables = createVegetables(textureLoader);
  group.add(vegetables);
  
  return group;
}

function createChickens(textureLoader) {
  const chickensGroup = new THREE.Group();
  
  // Material untuk ayam
  const chickenBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFCC,
    roughness: 0.9,
    metalness: 0.0
  });
  
  const chickenBeakMaterial = new THREE.MeshStandardMaterial({
    color: 0xFF6600,
    roughness: 0.8,
    metalness: 0.1
  });
  
  const chickenCombMaterial = new THREE.MeshStandardMaterial({
    color: 0xFF3333,
    roughness: 0.9,
    metalness: 0.0
  });
  
  const chickenLegMaterial = new THREE.MeshStandardMaterial({
    color: 0xFF9900,
    roughness: 0.9,
    metalness: 0.0
  });
  
  // Fungsi untuk membuat satu ayam
  const createChicken = (x, z, rotation) => {
    const chicken = new THREE.Group();
    
    // Badan ayam
    const bodyGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const body = new THREE.Mesh(bodyGeometry, chickenBodyMaterial);
    body.position.y = 0.3;
    body.scale.set(1, 0.8, 1.2);
    body.castShadow = true;
    chicken.add(body);
    
    // Kepala ayam
    const headGeometry = new THREE.SphereGeometry(0.18, 16, 16);
    const head = new THREE.Mesh(headGeometry, chickenBodyMaterial);
    head.position.set(0, 0.6, 0.25);
    head.castShadow = true;
    chicken.add(head);
    
    // Paruh
    const beakGeometry = new THREE.ConeGeometry(0.05, 0.15, 8);
    const beak = new THREE.Mesh(beakGeometry, chickenBeakMaterial);
    beak.position.set(0, 0.57, 0.4);
    beak.rotation.x = Math.PI / 2;
    beak.castShadow = true;
    chicken.add(beak);
    
    // Jengger
    const combGeometry = new THREE.BoxGeometry(0.05, 0.1, 0.15);
    const comb = new THREE.Mesh(combGeometry, chickenCombMaterial);
    comb.position.set(0, 0.72, 0.2);
    comb.castShadow = true;
    chicken.add(comb);
    
    // Ekor
    const tailGeometry = new THREE.ConeGeometry(0.15, 0.25, 8);
    const tail = new THREE.Mesh(tailGeometry, chickenBodyMaterial);
    tail.position.set(0, 0.4, -0.3);
    tail.rotation.x = -Math.PI / 3;
    tail.castShadow = true;
    chicken.add(tail);
    
    // Sayap kiri
    const wingGeometry = new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI);
    const leftWing = new THREE.Mesh(wingGeometry, chickenBodyMaterial);
    leftWing.position.set(0.25, 0.3, 0);
    leftWing.rotation.y = -Math.PI / 2;
    leftWing.castShadow = true;
    chicken.add(leftWing);
    
    // Sayap kanan
    const rightWing = new THREE.Mesh(wingGeometry, chickenBodyMaterial);
    rightWing.position.set(-0.25, 0.3, 0);
    rightWing.rotation.y = Math.PI / 2;
    rightWing.castShadow = true;
    chicken.add(rightWing);
    
    // Kaki kiri
    const legGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8);
    const leftLeg = new THREE.Mesh(legGeometry, chickenLegMaterial);
    leftLeg.position.set(0.1, 0.12, 0);
    leftLeg.castShadow = true;
    chicken.add(leftLeg);
    
    // Kaki kanan
    const rightLeg = new THREE.Mesh(legGeometry, chickenLegMaterial);
    rightLeg.position.set(-0.1, 0.12, 0);
    rightLeg.castShadow = true;
    chicken.add(rightLeg);
    
    // Posisikan ayam
    chicken.position.set(x, 0, z);
    chicken.rotation.y = rotation;
    
    return chicken;
  };
  
  // Buat 12 ayam tersebar di seluruh kandang
  const chickenPositions = [
    { x: 0, z: 0, rotation: Math.PI / 4 },
    { x: -2, z: -1, rotation: -Math.PI / 3 },
    { x: 1, z: -2.5, rotation: Math.PI },
    { x: 2.5, z: 1, rotation: Math.PI / 2 },
    { x: -2, z: 2, rotation: -Math.PI / 6 },
    { x: 1.5, z: 2.5, rotation: Math.PI / 5 },
    { x: -1, z: -3, rotation: 0 },
    { x: -2.5, z: 1.5, rotation: Math.PI / 7 },
    { x: 3, z: -3, rotation: Math.PI / 3 },
    { x: -3.5, z: 0, rotation: -Math.PI / 2 },
    { x: 0, z: 2.5, rotation: 0 },
    { x: -1.5, z: -2, rotation: Math.PI * 1.5 }
  ];
  
  chickenPositions.forEach(pos => {
    const chicken = createChicken(pos.x, pos.z, pos.rotation);
    chickensGroup.add(chicken);
  });
  
  return chickensGroup;
}

function createVegetables(textureLoader) {
  const vegetablesGroup = new THREE.Group();
  
  // Area tanam sayuran (kotak tanah) di satu sisi kandang
  const plantingAreaGeometry = new THREE.BoxGeometry(8, 0.2, 3);
  const soilMaterial = new THREE.MeshStandardMaterial({
    color: 0x4A2F0C,
    roughness: 1.0,
    metalness: 0.0
  });
  const plantingArea = new THREE.Mesh(plantingAreaGeometry, soilMaterial);
  plantingArea.position.set(0, 0.1, -3);
  plantingArea.receiveShadow = true;
  vegetablesGroup.add(plantingArea);
  
  // Buat beberapa tanaman sayur
  const createVegetablePlant = (type, x, z) => {
    const plant = new THREE.Group();
    
    // Batang
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: 0x228B22,
      roughness: 0.9,
      metalness: 0.0
    });
    
    const stemGeometry = new THREE.CylinderGeometry(0.02, 0.03, 0.3, 8);
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.y = 0.25;
    stem.castShadow = true;
    plant.add(stem);
    
    // Daun
    const leafGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x32CD32,
      roughness: 0.9,
      metalness: 0.0
    });
    
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
      leaf.position.set(
        0.1 * Math.cos(i * Math.PI * 2 / 3),
        0.25 + i * 0.05,
        0.1 * Math.sin(i * Math.PI * 2 / 3)
      );
      leaf.scale.set(1, 0.3, 1);
      leaf.castShadow = true;
      plant.add(leaf);
    }
    
    // Tambahkan sayuran berdasarkan tipe
    if (type === 'tomato') {
      const tomatoGeometry = new THREE.SphereGeometry(0.08, 16, 16);
      const tomatoMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF3333,
        roughness: 0.8,
        metalness: 0.1
      });
      
      for (let i = 0; i < 2; i++) {
        const tomato = new THREE.Mesh(tomatoGeometry, tomatoMaterial);
        tomato.position.set(
          0.08 * Math.cos(i * Math.PI),
          0.35,
          0.08 * Math.sin(i * Math.PI)
        );
        tomato.castShadow = true;
        plant.add(tomato);
      }
    } else if (type === 'carrot') {
      const carrotGeometry = new THREE.ConeGeometry(0.05, 0.15, 8);
      const carrotMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF7F00,
        roughness: 0.8,
        metalness: 0.0
      });
      
      const carrot = new THREE.Mesh(carrotGeometry, carrotMaterial);
      carrot.position.set(0, 0.16, 0);
      carrot.rotation.x = Math.PI;
      carrot.castShadow = true;
      plant.add(carrot);
    } else if (type === 'cabbage') {
      const cabbageGeometry = new THREE.SphereGeometry(0.12, 16, 16);
      const cabbageMaterial = new THREE.MeshStandardMaterial({
        color: 0x9ACD32,
        roughness: 0.9,
        metalness: 0.0
      });
      
      const cabbage = new THREE.Mesh(cabbageGeometry, cabbageMaterial);
      cabbage.position.set(0, 0.22, 0);
      cabbage.castShadow = true;
      plant.add(cabbage);
    }
    
    plant.position.set(x, 0, z);
    return plant;
  };
  
  // Buat beberapa baris tanaman sayur
  // Tomat (baris pertama)
  for (let x = -3.5; x <= 3.5; x += 1) {
    const tomato = createVegetablePlant('tomato', x, -4);
    vegetablesGroup.add(tomato);
  }
  
  // Wortel (baris kedua)
  for (let x = -3.5; x <= 3.5; x += 1) {
    const carrot = createVegetablePlant('carrot', x, -3);
    vegetablesGroup.add(carrot);
  }
  
  // Kubis (baris ketiga)
  for (let x = -3.5; x <= 3.5; x += 1) {
    const cabbage = createVegetablePlant('cabbage', x, -2);
    vegetablesGroup.add(cabbage);
  }
  
  return vegetablesGroup;
}

function createOutsideArea(textureLoader) {
  const outsideGroup = new THREE.Group();
  
  // Tanah luar kandang
  const groundGeometry = new THREE.PlaneGeometry(50, 50);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x7CFC00, // Warna rumput
    roughness: 0.9,
    metalness: 0.0
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.15;
  ground.receiveShadow = true;
  outsideGroup.add(ground);
  
  // Pagar kandang
  const fenceGroup = createFence(textureLoader);
  outsideGroup.add(fenceGroup);
  
  // Tidak menambahkan pohon lagi
  
  return outsideGroup;
}

function createFence(textureLoader) {
  const fenceGroup = new THREE.Group();
  
  // Material untuk pagar
  const fenceMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.9,
    metalness: 0.1
  });
  
  // Kandang berukuran 10x10 meter
  const coopWidth = 10;
  const coopDepth = 10;
  const fenceOffset = 1; // Jarak pagar dari kandang
  const fenceWidth = coopWidth + (fenceOffset * 2);
  const fenceDepth = coopDepth + (fenceOffset * 2);
  
  // Buat pagar sekeliling kandang
  const fencePostGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
  const fenceBeamGeometry = new THREE.BoxGeometry(2.05, 0.08, 0.08);
  
  // Buat tiang pagar
  const createFencePost = (x, z) => {
    const post = new THREE.Mesh(fencePostGeometry, fenceMaterial);
    post.position.set(x, 0.6, z);
    post.castShadow = true;
    fenceGroup.add(post);
  };
  
  // Buat balok horizontal pagar
  const createFenceBeam = (x, z, rotation) => {
    for (let i = 0; i < 3; i++) {
      const beam = new THREE.Mesh(fenceBeamGeometry, fenceMaterial);
      beam.position.set(x, 0.3 + i * 0.3, z);
      beam.rotation.y = rotation;
      beam.castShadow = true;
      fenceGroup.add(beam);
    }
  };
  
  // Ukuran half untuk posisi
  const halfWidth = fenceWidth / 2;
  const halfDepth = fenceDepth / 2;
  
  // Pagar sisi depan (Z+) - kecuali bagian pintu
  for (let x = -halfWidth; x <= halfWidth; x += 2) {
    if (x < -1 || x > 1) { // Biarkan ruang untuk pintu masuk
      createFencePost(x, halfDepth);
      if (x < halfWidth - 1) {
        createFenceBeam(x + 1, halfDepth, 0);
      }
    }
  }
  
  // Pagar sisi belakang (Z-)
  for (let x = -halfWidth; x <= halfWidth; x += 2) {
    createFencePost(x, -halfDepth);
    if (x < halfWidth - 1) {
      createFenceBeam(x + 1, -halfDepth, 0);
    }
  }
  
  // Pagar sisi kanan (X+)
  for (let z = -halfDepth; z <= halfDepth; z += 2) {
    createFencePost(halfWidth, z);
    if (z < halfDepth - 1) {
      createFenceBeam(halfWidth, z + 1, Math.PI / 2);
    }
  }
  
  // Pagar sisi kiri (X-)
  for (let z = -halfDepth; z <= halfDepth; z += 2) {
    createFencePost(-halfWidth, z);
    if (z < halfDepth - 1) {
      createFenceBeam(-halfWidth, z + 1, Math.PI / 2);
    }
  }
  
  // Pintu pagar
  const gateGeometry = new THREE.BoxGeometry(2, 1, 0.05);
  const gate = new THREE.Mesh(gateGeometry, fenceMaterial);
  gate.position.set(0, 0.5, halfDepth);
  gate.castShadow = true;
  fenceGroup.add(gate);
  
  // Engsel pintu pagar
  const hingeGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8);
  const hingeMaterial = new THREE.MeshStandardMaterial({
    color: 0x3A3A3A,
    roughness: 0.5,
    metalness: 0.8
  });
  
  const hingeTop = new THREE.Mesh(hingeGeometry, hingeMaterial);
  hingeTop.position.set(-1, 0.9, halfDepth);
  hingeTop.rotation.x = Math.PI / 2;
  fenceGroup.add(hingeTop);
  
  const hingeBottom = new THREE.Mesh(hingeGeometry, hingeMaterial);
  hingeBottom.position.set(-1, 0.1, halfDepth);
  hingeBottom.rotation.x = Math.PI / 2;
  fenceGroup.add(hingeBottom);
  
  return fenceGroup;
}

function createTrees() {
  // Mengembalikan grup kosong karena tidak ingin ada pohon
  return new THREE.Group();
}

// Fungsi untuk membuat sistem ventilasi
function createVentilationSystem(width, depth, height, textureLoader) {
  const ventilationGroup = new THREE.Group();
  
  // Material untuk fan dan peralatan ventilasi
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.5,
    metalness: 0.8
  });
  
  const fanBladeMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.3,
    metalness: 0.7
  });
  
  const inletMaterial = new THREE.MeshStandardMaterial({
    color: 0xCCCCCC,
    roughness: 0.7,
    metalness: 0.3
  });
  
  // Buat exhaust fan di bagian belakang
  const createExhaustFan = (x, z) => {
    const fanGroup = new THREE.Group();
    
    // Frame fan
    const frameGeometry = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 16);
    const frame = new THREE.Mesh(frameGeometry, metalMaterial);
    frame.rotation.x = Math.PI / 2;
    frame.castShadow = true;
    fanGroup.add(frame);
    
    // Blade fan
    const createBlade = () => {
      const bladeGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.05);
      const blade = new THREE.Mesh(bladeGeometry, fanBladeMaterial);
      blade.castShadow = true;
      return blade;
    };
    
    const fanBlades = new THREE.Group();
    // Simpan blades di properti untuk animasi nanti
    fanGroup.blades = fanBlades;
    
    for (let i = 0; i < 6; i++) {
      const blade = createBlade();
      blade.position.set(0, 0, 0.1);
      blade.rotation.z = (i * Math.PI) / 3;
      fanBlades.add(blade);
    }
    
    fanGroup.add(fanBlades);
    
    // Cover grid protector
    const gridGeometry = new THREE.TorusGeometry(1, 0.05, 8, 24);
    const grid = new THREE.Mesh(gridGeometry, metalMaterial);
    grid.position.z = 0.2;
    grid.castShadow = true;
    fanGroup.add(grid);
    
    // Tambah garis grid horizontal dan vertikal
    for (let i = 0; i < 4; i++) {
      const lineGeometry = new THREE.BoxGeometry(2, 0.05, 0.05);
      const line = new THREE.Mesh(lineGeometry, metalMaterial);
      line.position.z = 0.2;
      line.rotation.z = (i * Math.PI) / 4;
      grid.add(line);
    }
    
    fanGroup.position.set(x, height * 0.7, z);
    fanGroup.rotation.y = Math.atan2(x, z); // Arahkan ke luar
    
    return fanGroup;
  };
  
  // Buat inlet di sepanjang sisi
  const createInlet = (x, z, rotationY) => {
    const inletGroup = new THREE.Group();
    
    // Frame inlet
    const frameGeometry = new THREE.BoxGeometry(1.5, 0.3, 0.1);
    const frame = new THREE.Mesh(frameGeometry, metalMaterial);
    frame.castShadow = true;
    inletGroup.add(frame);
    
    // Flap inlet (dapat dibuka/ditutup)
    const flapGeometry = new THREE.BoxGeometry(1.3, 0.25, 0.05);
    const flap = new THREE.Mesh(flapGeometry, inletMaterial);
    flap.position.z = 0.07;
    // Simpan flap untuk animasi 
    inletGroup.flap = flap;
    // Acak posisi bukaan inlet
    flap.rotation.x = -Math.random() * Math.PI / 3; 
    flap.castShadow = true;
    inletGroup.add(flap);
    
    inletGroup.position.set(x, height * 0.7, z);
    inletGroup.rotation.y = rotationY;
    
    return inletGroup;
  };
  
  // Pasang exhaust fan di sisi belakang
  const numFans = 5;
  for (let i = 0; i < numFans; i++) {
    const xPos = (i - (numFans - 1) / 2) * (width / numFans) * 0.6;
    const fan = createExhaustFan(xPos, -depth/2 - 0.2);
    ventilationGroup.add(fan);
  }
  
  // Pasang inlet di sepanjang sisi depan dan samping
  // Sisi depan
  const numInletsFront = 10;
  for (let i = 0; i < numInletsFront; i++) {
    const xPos = (i - (numInletsFront - 1) / 2) * (width / numInletsFront) * 0.7;
    const inlet = createInlet(xPos, depth/2 + 0.1, Math.PI);
    ventilationGroup.add(inlet);
  }
  
  // Sisi kiri
  const numInletsSide = 8;
  for (let i = 0; i < numInletsSide; i++) {
    const zPos = (i - (numInletsSide - 1) / 2) * (depth / numInletsSide) * 0.7;
    const inlet = createInlet(-width/2 - 0.1, zPos, Math.PI / 2);
    ventilationGroup.add(inlet);
  }
  
  // Sisi kanan
  for (let i = 0; i < numInletsSide; i++) {
    const zPos = (i - (numInletsSide - 1) / 2) * (depth / numInletsSide) * 0.7;
    const inlet = createInlet(width/2 + 0.1, zPos, -Math.PI / 2);
    ventilationGroup.add(inlet);
  }
  
  // Cooling pad di sisi inlet utama (depan)
  const coolingPadGeometry = new THREE.BoxGeometry(width * 0.7, height * 0.6, 0.3);
  const coolingPadMaterial = new THREE.MeshStandardMaterial({
    color: 0x7070A0,
    roughness: 0.9,
    metalness: 0.1,
    transparent: true,
    opacity: 0.7
  });
  const coolingPad = new THREE.Mesh(coolingPadGeometry, coolingPadMaterial);
  coolingPad.position.set(0, height * 0.4, depth/2 - 1);
  ventilationGroup.add(coolingPad);
  
  // Tambahkan pipa air untuk cooling pad
  const pipeMaterial = new THREE.MeshStandardMaterial({
    color: 0x3333CC,
    roughness: 0.5,
    metalness: 0.5
  });
  
  const pipeGeometry = new THREE.CylinderGeometry(0.1, 0.1, width * 0.72, 8);
  pipeGeometry.rotateZ(Math.PI / 2);
  const pipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
  pipe.position.set(0, height * 0.7, depth/2 - 1);
  ventilationGroup.add(pipe);
  
  return ventilationGroup;
}

// Fungsi untuk membuat partikel debu dan bulu
function createParticles(scene, width, depth) {
  const particlesGroup = new THREE.Group();
  
  // Material untuk partikel debu
  const dustMaterial = new THREE.MeshStandardMaterial({
    color: 0xCCCCAA,
    roughness: 0.9,
    metalness: 0.1,
    transparent: true,
    opacity: 0.4
  });
  
  // Material untuk bulu ayam
  const featherMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFEE,
    roughness: 0.9,
    metalness: 0.0
  });
  
  // Geometri untuk partikel debu kecil
  const dustGeometry = new THREE.SphereGeometry(0.05, 4, 4);
  
  // Buat partikel debu
  const numDustParticles = 100;
  const dustParticles = [];
  
  for (let i = 0; i < numDustParticles; i++) {
    const dust = new THREE.Mesh(dustGeometry, dustMaterial);
    
    // Posisi acak di dalam kandang
    dust.position.set(
      (Math.random() - 0.5) * width * 0.8,
      Math.random() * 2, // ketinggian maksimal 2 meter
      (Math.random() - 0.5) * depth * 0.8
    );
    
    // Simpan kecepatan dan properti simulasi
    dust.userData = {
      velocity: {
        x: (Math.random() - 0.5) * 0.01,
        y: -0.002 - Math.random() * 0.005, // gravitasi kecil ke bawah
        z: (Math.random() - 0.5) * 0.01
      },
      spin: {
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02
      },
      size: 0.03 + Math.random() * 0.07,
      lifetime: Math.random() * 100 + 50
    };
    
    dust.scale.set(
      dust.userData.size,
      dust.userData.size,
      dust.userData.size
    );
    
    particlesGroup.add(dust);
    dustParticles.push(dust);
  }
  
  // Buat bulu ayam
  const numFeathers = 30;
  const feathers = [];
  
  // Geometri untuk bulu ayam (bentuk sederhana)
  const featherGeometry = new THREE.BoxGeometry(0.05, 0.01, 0.2);
  
  for (let i = 0; i < numFeathers; i++) {
    const feather = new THREE.Mesh(featherGeometry, featherMaterial);
    
    // Posisi acak di dalam kandang
    feather.position.set(
      (Math.random() - 0.5) * width * 0.8,
      0.1 + Math.random() * 0.5, // rendah di dekat lantai
      (Math.random() - 0.5) * depth * 0.8
    );
    
    // Rotasi acak
    feather.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    
    // Simpan kecepatan dan properti simulasi
    feather.userData = {
      velocity: {
        x: (Math.random() - 0.5) * 0.01,
        y: -0.003 - Math.random() * 0.002, // lebih lambat turun dari debu
        z: (Math.random() - 0.5) * 0.01
      },
      spin: {
        x: (Math.random() - 0.5) * 0.01,
        y: (Math.random() - 0.5) * 0.01,
        z: (Math.random() - 0.5) * 0.01
      },
      lifetime: Math.random() * 150 + 100
    };
    
    particlesGroup.add(feather);
    feathers.push(feather);
  }
  
  // Fungsi untuk update posisi partikel (akan ditambahkan ke animation loop)
  const updateParticles = () => {
    // Update debu
    for (const dust of dustParticles) {
      // Pergerakan berdasarkan kecepatan
      dust.position.x += dust.userData.velocity.x;
      dust.position.y += dust.userData.velocity.y;
      dust.position.z += dust.userData.velocity.z;
      
      // Rotasi
      dust.rotation.x += dust.userData.spin.x;
      dust.rotation.y += dust.userData.spin.y;
      dust.rotation.z += dust.userData.spin.z;
      
      // Reset jika mencapai lantai
      if (dust.position.y < 0.05) {
        dust.position.y = Math.random() * 2;
        dust.position.x = (Math.random() - 0.5) * width * 0.8;
        dust.position.z = (Math.random() - 0.5) * depth * 0.8;
      }
      
      // Kurangi lifetime
      dust.userData.lifetime -= 1;
      
      // Reset jika habis umurnya
      if (dust.userData.lifetime <= 0) {
        dust.position.y = Math.random() * 2;
        dust.position.x = (Math.random() - 0.5) * width * 0.8;
        dust.position.z = (Math.random() - 0.5) * depth * 0.8;
        dust.userData.lifetime = Math.random() * 100 + 50;
      }
    }
    
    // Update bulu
    for (const feather of feathers) {
      // Pergerakan berdasarkan kecepatan
      feather.position.x += feather.userData.velocity.x;
      feather.position.y += feather.userData.velocity.y;
      feather.position.z += feather.userData.velocity.z;
      
      // Rotasi
      feather.rotation.x += feather.userData.spin.x;
      feather.rotation.y += feather.userData.spin.y;
      feather.rotation.z += feather.userData.spin.z;
      
      // Reset jika mencapai lantai
      if (feather.position.y < 0.05) {
        // Biarkan di lantai untuk beberapa saat
        feather.userData.velocity.x = 0;
        feather.userData.velocity.z = 0;
        feather.userData.spin.x = 0;
        feather.userData.spin.y = 0;
        feather.userData.spin.z = 0;
      }
      
      // Kurangi lifetime
      feather.userData.lifetime -= 1;
      
      // Reset jika habis umurnya
      if (feather.userData.lifetime <= 0) {
        feather.position.y = 0.1 + Math.random() * 0.5;
        feather.position.x = (Math.random() - 0.5) * width * 0.8;
        feather.position.z = (Math.random() - 0.5) * depth * 0.8;
        feather.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        feather.userData.velocity = {
          x: (Math.random() - 0.5) * 0.01,
          y: -0.003 - Math.random() * 0.002,
          z: (Math.random() - 0.5) * 0.01
        };
        feather.userData.spin = {
          x: (Math.random() - 0.5) * 0.01,
          y: (Math.random() - 0.5) * 0.01,
          z: (Math.random() - 0.5) * 0.01
        };
        feather.userData.lifetime = Math.random() * 150 + 100;
      }
    }
  };
  
  // Ekspos fungsi update
  particlesGroup.updateParticles = updateParticles;
  
  return particlesGroup;
}

// Particle system
export const particleSystem = {
  particles: null,
  ventilationSystem: null,
  lastUpdateTime: 0,
  updateInterval: 100, // ms between updates
  
  initAnimation: function(particlesGroup, ventilation) {
    this.particles = particlesGroup;
    this.ventilationSystem = ventilation;
    
    // Reduce number of particles for better performance
    if (this.particles && this.particles.children) {
      // Keep only half the particles for better performance
      const particlesToRemove = Math.floor(this.particles.children.length / 2);
      for (let i = 0; i < particlesToRemove; i++) {
        this.particles.children.pop();
      }
    }
  },
  
  updateAnimation: function() {
    const currentTime = Date.now();
    
    // Only update particles periodically
    if (currentTime - this.lastUpdateTime < this.updateInterval) {
      return;
    }
    this.lastUpdateTime = currentTime;
    
    // Check if visible to camera before updating
    const cameraPosition = new THREE.Vector3();
    if (window.camera) {
      window.camera.getWorldPosition(cameraPosition);
      
      // Check if too far from camera (optimization)
      if (this.particles && this.particles.position) {
        const particlePosition = new THREE.Vector3();
        this.particles.getWorldPosition(particlePosition);
        const distance = cameraPosition.distanceTo(particlePosition);
        
        // Skip update if too far (over 50 units)
        if (distance > 50) {
          return;
        }
      }
    }
    
    // Continue with normal update logic
    if (this.ventilationSystem) {
      // Animate ventilation
      this.ventilationSystem.children.forEach(child => {
        if (child.blades) {
          child.blades.rotation.z += 0.01;
        }
        if (child.flap) {
          // Simple oscillation for flap
          child.flap.rotation.x = Math.sin(Date.now() * 0.001) * 0.2;
        }
      });
    }
    
    // Update particles
    if (this.particles && this.particles.updateParticles) {
      this.particles.updateParticles();
    }
  }
};
import { LandingSystem } from './landing-system.js';
import { ObstacleAvoidanceSystem } from './obstacle-avoidance.js';
import { PositioningSystem } from './positioning.js';
import { VisionSystem } from './vision-system.js';

// Kelas untuk mengelola dan mengintegrasikan semua sistem drone
export class IntegratedSystems {
  constructor(scene) {
    this.scene = scene;
    this.drone = null;
    this.systems = {};
    this.isInitialized = false;
    
    // Management dan logging
    this.statusInterval = null;
    this.statusData = {
      systemsActive: 0,
      lastUpdate: Date.now(),
      memoryUsage: 0,
      cpuUsage: 0
    };
    
    // Data integrasi
    this.integratedData = {
      positionAccuracy: 0,
      avoidanceActive: false,
      warnings: [],
      errors: [],
      batteryStatus: 'normal', // 'normal', 'low', 'critical'
    };
    
    // Konfigurasi sistem keseluruhan
    this.config = {
      systemsEnabled: {
        positioning: true,
        obstacleAvoidance: true,
        landing: true,
        vision: true,
        dataCollection: true
      },
      dataSyncInterval: 100,  // ms
      statusUpdateInterval: 1000, // ms
      optimizationLevel: 'balanced', // 'performance', 'balanced', 'accuracy'
      enabledInSimulation: true,
      debugMode: false
    };
  }
  
  // Inisialisasi semua sistem
  initialize(drone) {
    if (this.isInitialized) return false;
    
    this.drone = drone;
    if (!this.drone) {
      console.error("[IntegratedSystems] No drone provided for initialization");
      return false;
    }
    
    // Tambahkan userData ke drone untuk identifikasi
    this.drone.userData = {
      ...this.drone.userData,
      type: 'drone',
      name: 'Inspection Drone',
      systems: [],
      essential: true
    };
    
    try {
      // Initialize positioning system
      if (this.config.systemsEnabled.positioning) {
        this.systems.positioning = new PositioningSystem(this.scene);
        this.drone.userData.systems.push('positioning');
      }
      
      // Initialize obstacle avoidance
      if (this.config.systemsEnabled.obstacleAvoidance) {
        this.systems.obstacleAvoidance = new ObstacleAvoidanceSystem(this.scene, this.drone);
        this.drone.userData.systems.push('obstacleAvoidance');
      }
      
      // Initialize landing system
      if (this.config.systemsEnabled.landing) {
        this.systems.landing = new LandingSystem(this.scene);
        this.drone.userData.systems.push('landing');
      }
      
      // Initialize vision system
      if (this.config.systemsEnabled.vision) {
        this.systems.vision = new VisionSystem(this.scene, this.drone);
        this.drone.userData.systems.push('vision');
      }
      
      // Deteksi performa rendah dari window jika ada
      const isLowPerf = window.PERFORMANCE && window.PERFORMANCE.lowPerfMode;
      
      // Setup data synchronization interval (dengan interval yang lebih panjang untuk low perf mode)
      const dataSyncInterval = isLowPerf ? this.config.dataSyncInterval * 2 : this.config.dataSyncInterval;
      this.syncInterval = setInterval(() => this.syncData(), dataSyncInterval);
      
      // Setup status update interval (dengan interval yang lebih panjang untuk low perf mode)
      const statusUpdateInterval = isLowPerf ? this.config.statusUpdateInterval * 2 : this.config.statusUpdateInterval;
      this.statusInterval = setInterval(() => this.optimizedStatusUpdate(), statusUpdateInterval);
      
      // Setup UI
      if (this.config.enabledInSimulation) {
        this.setupUI();
      }
      
      this.isInitialized = true;
      console.log(`[IntegratedSystems] All systems initialized successfully`);
      
      return true;
    } catch (error) {
      console.error(`[IntegratedSystems] Error initializing systems: ${error.message}`);
      this.integratedData.errors.push({
        time: Date.now(),
        source: 'initialization',
        message: error.message
      });
      
      return false;
    }
  }
  
  // Sync data antar sistem
  syncData() {
    if (!this.isInitialized) return;
    
    try {
      // Get sensor data from drone
      const droneData = this.drone.sensorData || {};
      
      // Sync positioning data
      if (this.systems.positioning) {
        const posData = this.systems.positioning.getPositionData();
        this.integratedData.positionAccuracy = posData.accuracy;
        
        // Update drone data
        if (droneData) {
          droneData.positionSource = posData.source;
          droneData.positionAccuracy = posData.accuracy;
        }
      }
      
      // Sync obstacle avoidance data
      if (this.systems.obstacleAvoidance) {
        const avoidanceData = this.systems.obstacleAvoidance.getAvoidanceData();
        this.integratedData.avoidanceActive = avoidanceData.active;
        
        // Apply avoidance forces to flight dynamics if active
        const flightDynamics = window.flightDynamics;
        if (flightDynamics && avoidanceData.active) {
          this.systems.obstacleAvoidance.applyAvoidanceForce(flightDynamics);
        }
        
        // Add warnings if obstacle detected
        if (avoidanceData.active && avoidanceData.nearestDistance < 1.0) {
          this.addWarning('obstacle_proximity', `Obstacle detected ${avoidanceData.nearestDistance.toFixed(2)}m away`);
        }
      }
      
      // Update battery status
      if (droneData && typeof droneData.battery === 'number') {
        if (droneData.battery < 10) {
          this.integratedData.batteryStatus = 'critical';
          this.addWarning('battery_critical', `Battery level critical: ${droneData.battery.toFixed(1)}%`);
          
          // Auto-land if battery critical and landing system available
          if (this.systems.landing && droneData.battery < 5) {
            // Trigger autoland only once
            if (this.integratedData.batteryStatus !== 'autoland') {
              this.integratedData.batteryStatus = 'autoland';
              const nearestPad = this.systems.landing.findNearestLandingPad(this.drone.position);
              if (nearestPad) {
                this.systems.landing.initiateAutomaticLanding(this.drone, nearestPad);
                
                // Show critical notification
                this.showCriticalNotification("BATTERY CRITICAL - Initiating emergency landing");
              }
            }
          }
        } else if (droneData.battery < 20) {
          this.integratedData.batteryStatus = 'low';
          this.addWarning('battery_low', `Battery level low: ${droneData.battery.toFixed(1)}%`);
        } else {
          this.integratedData.batteryStatus = 'normal';
        }
      }
      
      // Update vision animations if needed
      if (this.systems.vision) {
        this.systems.vision.updateAnimations(Date.now());
      }
      
    } catch (error) {
      console.error(`[IntegratedSystems] Error syncing data: ${error.message}`);
      this.integratedData.errors.push({
        time: Date.now(),
        source: 'data_sync',
        message: error.message
      });
    }
  }
  
  // Fungsi optimasi untuk update status
  optimizedStatusUpdate() {
    try {
      if (!this.isInitialized) return;
      
      // Melakukan update status secara batch untuk menghindari reflow
      const updateStart = performance.now();
      
      // Persiapkan data
      // Count active systems
      this.statusData.systemsActive = Object.keys(this.systems).length;
      
      // Simulate CPU/Memory usage
      this.statusData.cpuUsage = 15 + Math.random() * 10;
      this.statusData.memoryUsage = 120 + Math.random() * 30;
      
      // Update timestamp
      this.statusData.lastUpdate = Date.now();
      
      // Expire old warnings (operasi ringan)
      this.expireWarnings();
      
      // Batasi update UI jika tab tidak aktif
      if (document.hidden) return;
      
      // Batasi update UI pada perangkat low-end
      const isLowPerf = window.PERFORMANCE && window.PERFORMANCE.lowPerfMode;
      
      // Update UI jika diaktifkan dan performa OK
      if (this.config.enabledInSimulation && (!isLowPerf || Math.random() < 0.5)) {
        this.updateStatusUI();
      }
      
      // Batasi waktu eksekusi, jika melebihi 20ms, log warning
      const executionTime = performance.now() - updateStart;
      if (executionTime > 20) {
        console.warn(`[IntegratedSystems] Status update took ${executionTime.toFixed(1)}ms`);
      }
    } catch (error) {
      console.error(`[IntegratedSystems] Status update error: ${error.message}`);
    }
  }
  
  // Add warning dengan ID unik untuk mencegah duplikasi
  addWarning(id, message, expireTime = 5000) {
    // Check if warning with same ID exists
    const existingIndex = this.integratedData.warnings.findIndex(w => w.id === id);
    
    if (existingIndex >= 0) {
      // Update existing warning
      this.integratedData.warnings[existingIndex].time = Date.now();
      this.integratedData.warnings[existingIndex].message = message;
      this.integratedData.warnings[existingIndex].expireTime = expireTime;
    } else {
      // Add new warning
      this.integratedData.warnings.push({
        id,
        time: Date.now(),
        message,
        expireTime
      });
    }
  }
  
  // Expire warnings yang sudah lama
  expireWarnings() {
    const now = Date.now();
    this.integratedData.warnings = this.integratedData.warnings.filter(warning => {
      return (now - warning.time) < warning.expireTime;
    });
  }
  
  // Setup UI untuk integrated systems
  setupUI() {
    // Create systems status UI
    const statusPanel = document.createElement('div');
    statusPanel.id = 'system-status-panel';
    statusPanel.style.position = 'absolute';
    statusPanel.style.top = '50%';
    statusPanel.style.left = '20px';
    statusPanel.style.transform = 'translateY(-50%)';
    statusPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    statusPanel.style.color = 'white';
    statusPanel.style.padding = '15px';
    statusPanel.style.borderRadius = '5px';
    statusPanel.style.fontFamily = 'Arial, sans-serif';
    statusPanel.style.fontSize = '14px';
    statusPanel.style.zIndex = '1000';
    statusPanel.style.minWidth = '200px';
    statusPanel.style.maxHeight = '70vh';
    statusPanel.style.overflowY = 'auto';
    
    // Collapsed by default
    statusPanel.style.opacity = '1';
    statusPanel.style.transition = 'opacity 0.3s';
    
    // Initial content
    statusPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
        <h3 style="margin: 0; color: #44AAFF;">Systems Status</h3>
        <div id="systems-indicator" style="width: 10px; height: 10px; background-color: #4CAF50; border-radius: 50%;"></div>
      </div>
      <div id="systems-content">Loading systems data...</div>
    `;
    
    document.body.appendChild(statusPanel);
    
    // Create warnings panel
    const warningsPanel = document.createElement('div');
    warningsPanel.id = 'warnings-panel';
    warningsPanel.style.position = 'absolute';
    warningsPanel.style.top = '120px';
    warningsPanel.style.left = '50%';
    warningsPanel.style.transform = 'translateX(-50%)';
    warningsPanel.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
    warningsPanel.style.color = 'white';
    warningsPanel.style.padding = '15px 20px';
    warningsPanel.style.borderRadius = '5px';
    warningsPanel.style.fontFamily = 'Arial, sans-serif';
    warningsPanel.style.fontSize = '14px';
    warningsPanel.style.zIndex = '1000';
    warningsPanel.style.display = 'none'; // Hidden by default
    warningsPanel.style.maxWidth = '80%';
    warningsPanel.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    
    warningsPanel.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="font-size: 24px;">⚠️</div>
        <div id="warning-content">Warning Message</div>
      </div>
    `;
    
    document.body.appendChild(warningsPanel);
  }
  
  // Update UI status
  updateStatusUI() {
    const statusPanel = document.getElementById('system-status-panel');
    if (!statusPanel) return;
    
    const systemsContent = document.getElementById('systems-content');
    if (!systemsContent) return;
    
    // Prepare system status
    let systemsHtml = '';
    Object.keys(this.systems).forEach(sysName => {
      const system = this.systems[sysName];
      let statusColor = '#4CAF50'; // Default green
      let statusText = 'Online';
      
      // Check specific system status
      if (sysName === 'obstacleAvoidance' && this.integratedData.avoidanceActive) {
        statusColor = '#FFC107'; // Yellow
        statusText = 'Active';
      } else if (sysName === 'landing' && system.status && system.status.isLanding) {
        statusColor = '#FFC107'; // Yellow
        statusText = 'Landing';
      } else if (sysName === 'landing' && system.status && system.status.isCharging) {
        statusColor = '#2196F3'; // Blue
        statusText = 'Charging';
      }
      
      // Format system name for display
      const displayName = sysName.replace(/([A-Z])/g, ' $1').trim();
      
      systemsHtml += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; align-items: center;">
          <span>${displayName}</span>
          <span style="display: flex; align-items: center;">
            <span style="width: 8px; height: 8px; background-color: ${statusColor}; border-radius: 50%; margin-right: 5px;"></span>
            <span style="font-size: 12px;">${statusText}</span>
          </span>
        </div>
      `;
    });
    
    // Add warnings if any
    let warningsHtml = '';
    if (this.integratedData.warnings.length > 0) {
      warningsHtml = `
        <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px;">
          <div style="font-size: 12px; color: #FFC107; margin-bottom: 5px;">Active Warnings:</div>
          <div>
      `;
      
      this.integratedData.warnings.forEach(warning => {
        warningsHtml += `
          <div style="font-size: 12px; margin-bottom: 3px; color: #FFC107;">
            • ${warning.message}
          </div>
        `;
      });
      
      warningsHtml += `</div></div>`;
    }
    
    // Add system resources
    const resourcesHtml = `
      <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px;">
        <div style="font-size: 12px; color: #CCC; margin-bottom: 5px;">System Resources:</div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
          <span>CPU Usage:</span>
          <span>${this.statusData.cpuUsage.toFixed(1)}%</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span>Memory:</span>
          <span>${this.statusData.memoryUsage.toFixed(1)} MB</span>
        </div>
      </div>
    `;
    
    // Battery status
    let batteryHtml = '';
    if (this.drone && this.drone.sensorData && typeof this.drone.sensorData.battery === 'number') {
      const batteryLevel = this.drone.sensorData.battery;
      const batteryColor = 
        batteryLevel > 50 ? '#4CAF50' : 
        batteryLevel > 20 ? '#FFC107' : '#F44336';
      
      batteryHtml = `
        <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px;">
          <div style="font-size: 12px; color: #CCC; margin-bottom: 5px;">Power Status:</div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; align-items: center;">
            <span>Battery:</span>
            <span style="display: flex; align-items: center;">
              <span style="width: 8px; height: 8px; background-color: ${batteryColor}; border-radius: 50%; margin-right: 5px;"></span>
              <span>${batteryLevel.toFixed(1)}%</span>
            </span>
          </div>
        </div>
      `;
    }
    
    // Update system-level indicator
    const hasErrors = this.integratedData.errors.length > 0;
    const hasWarnings = this.integratedData.warnings.length > 0;
    const indicator = document.getElementById('systems-indicator');
    
    if (indicator) {
      if (hasErrors) {
        indicator.style.backgroundColor = '#F44336'; // Red
      } else if (hasWarnings) {
        indicator.style.backgroundColor = '#FFC107'; // Yellow
      } else {
        indicator.style.backgroundColor = '#4CAF50'; // Green
      }
    }
    
    // Combine all sections
    systemsContent.innerHTML = systemsHtml + warningsHtml + batteryHtml + resourcesHtml;
    
    // Update warnings popup
    this.updateWarningsPopup();
  }
  
  // Update popup untuk warnings
  updateWarningsPopup() {
    const warningsPanel = document.getElementById('warnings-panel');
    if (!warningsPanel) return;
    
    // Hide if no warnings
    if (this.integratedData.warnings.length === 0) {
      warningsPanel.style.display = 'none';
      return;
    }
    
    // Show and update
    warningsPanel.style.display = 'block';
    
    // Get the most recent/important warning
    const latestWarning = this.integratedData.warnings[this.integratedData.warnings.length - 1];
    
    // Update content
    warningsPanel.innerHTML = `
      <div style="background-color: rgba(255, 152, 0, 0.9); color: white; padding: 10px 20px; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); display: flex; align-items: center;">
        <span style="margin-right: 10px; font-size: 20px;">⚠️</span>
        <div>
          <div style="font-weight: bold;">Warning</div>
          <div>${latestWarning.message}</div>
        </div>
      </div>
    `;
  }
  
  // Show critical notification (red, center screen)
  showCriticalNotification(message) {
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'critical-notification';
    notification.style.position = 'absolute';
    notification.style.top = '50%';
    notification.style.left = '50%';
    notification.style.transform = 'translate(-50%, -50%)';
    notification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
    notification.style.color = 'white';
    notification.style.padding = '20px 30px';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
    notification.style.fontFamily = 'Arial, sans-serif';
    notification.style.fontSize = '18px';
    notification.style.textAlign = 'center';
    notification.style.zIndex = '2000';
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    notification.style.justifyContent = 'center';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    
    // Add warning icon
    notification.innerHTML = `
      <span style="font-size: 24px; margin-right: 15px;">⚠</span>
      <span>${message}</span>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Animation
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Flash effect
    let flashCount = 0;
    const flashInterval = setInterval(() => {
      notification.style.backgroundColor = flashCount % 2 === 0 ? 
        'rgba(244, 67, 54, 0.9)' : 'rgba(255, 87, 34, 0.9)';
      flashCount++;
      
      if (flashCount > 10) {
        clearInterval(flashInterval);
      }
    }, 300);
    
    // Remove after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 6000);
  }
  
  // Update per frame untuk animations dan efek visual
  update(time) {
    if (!this.isInitialized) return;
    
    // Update animation untuk vision system
    if (this.systems.vision) {
      this.systems.vision.updateAnimations(time);
    }
  }
  
  // Clean up semua resources
  dispose() {
    clearInterval(this.syncInterval);
    clearInterval(this.statusInterval);
    
    // Dispose each system
    Object.values(this.systems).forEach(system => {
      if (system && typeof system.dispose === 'function') {
        system.dispose();
      }
    });
    
    // Remove UI elements
    const statusPanel = document.getElementById('system-status-panel');
    if (statusPanel) {
      statusPanel.remove();
    }
    
    const warningsPanel = document.getElementById('warnings-panel');
    if (warningsPanel) {
      warningsPanel.remove();
    }
    
    this.systems = {};
    this.isInitialized = false;
  }
} 
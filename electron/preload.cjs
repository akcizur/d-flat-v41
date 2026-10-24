const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("dflatDesktop", Object.freeze({
  platform: process.platform,
  appName: "D-FLAT V41",
  desktop: true
}));
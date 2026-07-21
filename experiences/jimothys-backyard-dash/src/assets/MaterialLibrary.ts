import * as THREE from 'three';

export type MaterialLibrary = ReturnType<typeof createMaterialLibrary>;

export function createMaterialLibrary() {
  const standard = (color: THREE.ColorRepresentation, roughness: number, metalness = 0): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  return {
    bodyPrimary: standard('#6f7f67', 0.72),
    bodySecondary: standard('#31483c', 0.78),
    trim: standard('#e9c878', 0.46, 0.08),
    hazard: standard('#d76a46', 0.56),
    reward: new THREE.MeshStandardMaterial({ color: '#f4cf65', roughness: 0.28, metalness: 0.54, emissive: '#5a3b0d', emissiveIntensity: 0.2 }),
    shieldBoost: new THREE.MeshPhysicalMaterial({ color: '#8de2d4', roughness: 0.16, transmission: 0.25, transparent: true, opacity: 0.54, depthWrite: false }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#a9ddd8', roughness: 0.12, transmission: 0.52, transparent: true, opacity: 0.64 }),
    emissiveSignal: new THREE.MeshStandardMaterial({ color: '#ffe3a3', roughness: 0.38, emissive: '#ffb94c', emissiveIntensity: 1.1 }),
    groundContact: standard('#18261e', 0.96),
    decalDark: new THREE.MeshBasicMaterial({ color: '#21352a', transparent: true, opacity: 0.74, depthWrite: false }),
    decalLight: new THREE.MeshBasicMaterial({ color: '#f4e4bd', transparent: true, opacity: 0.74, depthWrite: false }),
    grass: standard('#557652', 0.94),
    wetGrass: standard('#436b55', 0.76),
    soil: standard('#634c37', 0.98),
    patio: standard('#a68d72', 0.82),
    cedar: standard('#8d5d3b', 0.86),
    foliage: standard('#365b43', 0.9),
  };
}

export function disposeMaterialLibrary(materials: MaterialLibrary): void {
  for (const material of Object.values(materials)) material.dispose();
}

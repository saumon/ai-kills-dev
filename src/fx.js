// Voxel particles, laser tracers and the first-person blaster.
import * as THREE from 'three';
import { NEON, hdr } from './level.js';

const MAX = 600;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class Particles {
    constructor() {
        this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), MAX);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        this.mesh.setColorAt(0, _c.set(0xffffff));
        this.items = [];
    }

    burst(origin, color, count, { speed = 4, size = 0.09, life = 0.8, spread = 0.25, up = 2.5, glow = 1.6 } = {}) {
        for (let i = 0; i < count && this.items.length < MAX; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = speed * (0.3 + Math.random() * 0.7);
            const elev = Math.random() * 2 - 0.6;
            const max = life * (0.6 + Math.random() * 0.4);
            this.items.push({
                pos: new THREE.Vector3(
                    origin.x + (Math.random() - 0.5) * spread * 2,
                    origin.y + (Math.random() - 0.5) * spread * 2,
                    origin.z + (Math.random() - 0.5) * spread * 2,
                ),
                vel: new THREE.Vector3(Math.cos(a) * v, elev * v * 0.6 + up, Math.sin(a) * v),
                life: max,
                max,
                size: size * (0.6 + Math.random() * 0.8),
                color: new THREE.Color(color).multiplyScalar(glow * (0.7 + Math.random() * 0.6)),
            });
        }
    }

    update(dt) {
        const items = this.items;
        let n = 0;
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            it.life -= dt;
            if (it.life <= 0) continue;
            it.vel.y -= 9 * dt;
            it.pos.addScaledVector(it.vel, dt);
            if (it.pos.y < 0.04) {
                it.pos.y = 0.04;
                it.vel.y *= -0.35;
                it.vel.x *= 0.6;
                it.vel.z *= 0.6;
            }
            const s = it.size * Math.min(1, (it.life / it.max) * 2);
            _m.compose(it.pos, _q, _s.setScalar(s));
            this.mesh.setMatrixAt(n, _m);
            this.mesh.setColorAt(n, it.color);
            items[n++] = it;
        }
        items.length = n;
        this.mesh.count = n;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
    }

    clear() {
        this.items.length = 0;
        this.mesh.count = 0;
    }
}

export class Tracers {
    constructor(scene) {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        this.pool = [];
        for (let i = 0; i < 6; i++) {
            const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hdr(NEON.cyan, 3), transparent: true, depthWrite: false }));
            mesh.visible = false;
            mesh.frustumCulled = false;
            scene.add(mesh);
            this.pool.push({ mesh, life: 0 });
        }
        this.next = 0;
    }

    fire(from, to) {
        const t = this.pool[this.next];
        this.next = (this.next + 1) % this.pool.length;
        const len = from.distanceTo(to);
        t.mesh.position.lerpVectors(from, to, 0.5);
        t.mesh.lookAt(to);
        t.mesh.scale.set(0.025, 0.025, len);
        t.mesh.visible = true;
        t.life = 0.09;
    }

    update(dt) {
        for (const t of this.pool) {
            if (!t.mesh.visible) continue;
            t.life -= dt;
            t.mesh.material.opacity = Math.max(0, t.life / 0.09);
            if (t.life <= 0) t.mesh.visible = false;
        }
    }
}

/** Neon blaster parented to the camera; it points at whatever the player aims at. */
export class Blaster {
    constructor(camera) {
        this.camera = camera;
        this.group = new THREE.Group();
        this.group.rotation.order = 'YXZ';
        const box = new THREE.BoxGeometry(1, 1, 1);
        const metal = new THREE.MeshLambertMaterial({ color: 0x3a4060, emissive: 0x10121c, fog: false });
        const darkMetal = new THREE.MeshLambertMaterial({ color: 0x1c2032, emissive: 0x08090f, fog: false });
        const cyan = new THREE.MeshBasicMaterial({ color: hdr(NEON.cyan, 1.25), fog: false });
        const magenta = new THREE.MeshBasicMaterial({ color: hdr(NEON.magenta, 1.25), fog: false });
        const add = (mat, x, y, z, sx, sy, sz, rx = 0) => {
            const m = new THREE.Mesh(box, mat);
            m.position.set(x, y, z);
            m.scale.set(sx, sy, sz);
            m.rotation.x = rx;
            this.group.add(m);
            return m;
        };
        add(metal, 0, 0, -0.04, 0.075, 0.1, 0.36);
        add(darkMetal, 0, 0.022, -0.3, 0.046, 0.046, 0.26);
        add(darkMetal, 0, -0.11, 0.08, 0.06, 0.16, 0.075, 0.3);
        add(darkMetal, 0, 0.065, 0.02, 0.03, 0.03, 0.16);
        add(cyan, 0, 0.052, -0.08, 0.079, 0.012, 0.26);
        add(cyan, 0, 0.022, -0.435, 0.03, 0.03, 0.012);
        add(magenta, 0, -0.01, 0.145, 0.05, 0.05, 0.012);

        this.muzzle = new THREE.Object3D();
        this.muzzle.position.set(0, 0.022, -0.46);
        this.group.add(this.muzzle);
        this.flash = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.07, 0),
            new THREE.MeshBasicMaterial({ color: hdr(0xbffcff, 2.2), fog: false, transparent: true }),
        );
        this.flash.visible = false;
        this.muzzle.add(this.flash);
        this.light = new THREE.PointLight(NEON.cyan, 0, 12, 1.5);
        this.muzzle.add(this.light);

        this.home = new THREE.Vector3(0.3, -0.26, -0.6);
        this.group.scale.setScalar(0.8);
        this.recoil = 0;
        this.time = 0;
        this.aimLocal = new THREE.Vector3(0, 0, -20);
        camera.add(this.group);
        this.layout();
    }

    layout() {
        // Keep the gun in frame on narrow (portrait) screens.
        const portrait = this.camera.aspect < 1;
        this.home.x = 0.3 * Math.min(1, this.camera.aspect * 0.85);
        this.home.y = portrait ? -0.36 : -0.26;
        this.group.scale.setScalar(portrait ? 0.6 : 0.8);
    }

    kick() {
        this.recoil = 1;
        this.flash.visible = true;
        this.flash.rotation.z = Math.random() * 3;
    }

    /** `aimWorld` is the point under the crosshair. */
    update(dt, aimWorld) {
        this.time += dt;
        this.recoil = Math.max(0, this.recoil - dt * 9);
        const r = this.recoil;
        this.group.position.set(
            this.home.x,
            this.home.y + Math.sin(this.time * 6.2) * 0.006 + r * 0.02,
            this.home.z + r * 0.07,
        );
        this.aimLocal.lerp(this.camera.worldToLocal(aimWorld.clone()), Math.min(1, dt * 18));
        const dx = this.aimLocal.x - this.group.position.x;
        const dy = this.aimLocal.y - this.group.position.y;
        const dz = this.aimLocal.z - this.group.position.z;
        this.group.rotation.y = Math.atan2(-dx, -dz);
        this.group.rotation.x = Math.atan2(dy, Math.hypot(dx, dz)) + r * 0.22;
        this.flash.visible = r > 0.55;
        this.flash.scale.setScalar(0.4 + r * 0.7);
        this.light.intensity = r * 18;
    }

    muzzleWorld(out) {
        this.group.updateWorldMatrix(true, true);
        return this.muzzle.getWorldPosition(out);
    }
}

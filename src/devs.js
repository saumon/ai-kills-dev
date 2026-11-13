// Developers (pooled low-poly characters) and the bugs they throw back.
import * as THREE from 'three';
import { NEON, hdr } from './level.js';

const HOODIES = [0x3b82f6, 0xef4444, 0x22c55e, 0xa855f7, 0x14b8a6, 0xec4899, 0xf97316];
const GOLD = 0xffc400;

export const DEV_TYPES = {
    normal: { points: 10, label: 'DEV' },
    runner: { points: 25, label: 'RUNNER' },
    gold: { points: 50, label: '10x DEV' },
};

const box = new THREE.BoxGeometry(1, 1, 1);
const shared = {
    skin: new THREE.MeshLambertMaterial({ color: 0xf2c49b, emissive: 0x3a2a20 }),
    hair: new THREE.MeshLambertMaterial({ color: 0x1b1b2a }),
    jeans: new THREE.MeshLambertMaterial({ color: 0x2c3252, emissive: 0x0a0c18 }),
    grey: new THREE.MeshLambertMaterial({ color: 0x9aa3b8, emissive: 0x1a1c24 }),
    dark: new THREE.MeshBasicMaterial({ color: 0x120a10 }),
    glasses: new THREE.MeshBasicMaterial({ color: hdr(0xbfefff, 1.5) }),
    logo: new THREE.MeshBasicMaterial({ color: hdr(0xffffff, 2) }),
    bug: new THREE.MeshBasicMaterial({ color: hdr(NEON.red, 2.4) }),
    bugLeg: new THREE.MeshBasicMaterial({ color: hdr(NEON.red, 1.2) }),
    hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
};
const bugGeo = new THREE.IcosahedronGeometry(0.2, 0);
const bugHitGeo = new THREE.SphereGeometry(0.5, 8, 6);

function makeBugMesh() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bugGeo, shared.bug));
    for (let i = 0; i < 6; i++) {
        const leg = new THREE.Mesh(box, shared.bugLeg);
        const side = i < 3 ? -1 : 1;
        leg.scale.set(0.22, 0.025, 0.025);
        leg.position.set(side * 0.24, -0.02, ((i % 3) - 1) * 0.12);
        leg.rotation.z = side * -0.5;
        g.add(leg);
    }
    return g;
}

const easeOutBack = (x) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export class Dev {
    constructor() {
        this.root = new THREE.Group();
        this.root.visible = false;
        this.root.userData.dev = this;
        this.body = new THREE.Group();
        this.root.add(this.body);
        this.hoodie = new THREE.MeshLambertMaterial({ color: 0xffffff });

        const add = (mat, x, y, z, sx, sy, sz, head = false) => {
            const m = new THREE.Mesh(box, mat);
            m.position.set(x, y, z);
            m.scale.set(sx, sy, sz);
            m.userData.head = head;
            this.body.add(m);
            return m;
        };
        add(shared.jeans, 0, 0.42, 0, 0.42, 0.84, 0.24);
        add(this.hoodie, 0, 1.14, 0, 0.56, 0.62, 0.3);
        add(this.hoodie, 0, 1.42, -0.13, 0.42, 0.16, 0.14);
        add(this.hoodie, -0.36, 1.12, 0.06, 0.14, 0.56, 0.16);
        this.arm = add(this.hoodie, 0.34, 1.52, 0, 0.14, 0.5, 0.14);
        this.arm.rotation.z = 0.45;
        add(shared.grey, 0, 1.46, 0, 0.44, 0.07, 0.34); // headphones around the neck
        add(shared.skin, 0, 1.65, 0, 0.34, 0.36, 0.32, true);
        add(shared.hair, 0, 1.86, -0.01, 0.39, 0.13, 0.37, true);
        add(shared.hair, 0.1, 1.95, 0.02, 0.12, 0.1, 0.14, true);
        add(shared.glasses, -0.085, 1.68, 0.165, 0.12, 0.1, 0.02, true);
        add(shared.glasses, 0.085, 1.68, 0.165, 0.12, 0.1, 0.02, true);
        add(shared.dark, 0, 1.55, 0.163, 0.12, 0.06, 0.01, true);
        // Laptop clutched in panic.
        add(shared.grey, -0.16, 1.0, 0.32, 0.42, 0.03, 0.28);
        const lid = add(shared.grey, -0.16, 1.13, 0.47, 0.42, 0.27, 0.02);
        lid.rotation.x = 0.15;
        add(shared.logo, -0.16, 1.14, 0.485, 0.06, 0.06, 0.006);

        this.heldBug = makeBugMesh();
        this.heldBug.position.set(0.42, 2.12, 0);
        this.body.add(this.heldBug);

        this.active = false;
        this.pos = this.root.position;
        this.from = new THREE.Vector3();
        this.to = new THREE.Vector3();
    }

    spawn(slot, type, { stay, thrower }) {
        this.slot = slot;
        this.slot2 = null;
        this.type = type;
        this.stay = stay;
        this.thrower = thrower;
        this.throwAt = thrower ? 0.9 : Infinity;
        this.state = 'rising';
        this.k = 0;
        this.age = 0;
        this.active = true;
        this.phase = Math.random() * 6;
        slot.busy = true;
        if (type === 'runner') {
            // Sprint from the next desk back toward this one.
            this.slot2 = slot.next;
            this.slot2.busy = true;
            this.from.copy(this.slot2.show);
            this.to.copy(slot.show);
        } else {
            this.from.copy(slot.show);
            this.to.copy(slot.show);
        }
        this.hideOffset = new THREE.Vector3().subVectors(slot.hide, slot.show);

        const color = type === 'gold' ? GOLD : HOODIES[Math.floor(Math.random() * HOODIES.length)];
        this.color = color;
        this.hoodie.color.set(color);
        this.hoodie.emissive.set(color).multiplyScalar(type === 'gold' ? 1.6 : 0.3);
        this.heldBug.visible = thrower;
        this.root.visible = true;
        this.root.scale.setScalar(type === 'gold' ? 1.08 : 1);
        this.place();
    }

    place() {
        const run = this.type === 'runner' ? Math.min(1, this.age / this.stay) : 0;
        const e = this.state === 'rising' ? easeOutBack(this.k) : this.k;
        this.pos.lerpVectors(this.from, this.to, run).addScaledVector(this.hideOffset, 1 - e);
    }

    /** @returns {'throw'|null} */
    update(dt, camPos) {
        let event = null;
        if (this.state === 'rising') {
            this.k = Math.min(1, this.k + dt / 0.26);
            if (this.k >= 1) this.state = 'up';
        } else if (this.state === 'up') {
            if (this.age >= this.stay) this.duck();
        } else if (this.state === 'ducking') {
            this.k = Math.max(0, this.k - dt / 0.2);
            if (this.k <= 0) {
                this.release();
                return null;
            }
        }
        this.age += dt;
        if (this.state !== 'ducking' && this.age >= this.throwAt) {
            this.throwAt = Infinity;
            this.heldBug.visible = false;
            event = 'throw';
        }
        this.place();
        this.root.rotation.y = Math.atan2(camPos.x - this.pos.x, camPos.z - this.pos.z);
        const wobble = this.type === 'runner' ? 14 : 9;
        this.body.position.y = Math.abs(Math.sin(this.age * wobble + this.phase)) * (this.type === 'runner' ? 0.09 : 0.025);
        this.arm.rotation.z = 0.45 + Math.sin(this.age * 16 + this.phase) * 0.12;
        if (this.heldBug.visible) {
            const s = 1 + Math.sin(this.age * 22) * 0.25;
            this.heldBug.scale.setScalar(s);
            this.heldBug.rotation.y += dt * 8;
        }
        return event;
    }

    duck() {
        if (this.state !== 'ducking') {
            this.state = 'ducking';
            // A runner ducks wherever it currently is.
            if (this.type === 'runner') {
                const run = Math.min(1, this.age / this.stay);
                this.from.lerpVectors(this.from, this.to, run);
                this.to.copy(this.from);
            }
        }
    }

    release() {
        this.active = false;
        this.root.visible = false;
        if (this.slot) this.slot.busy = false;
        if (this.slot2) this.slot2.busy = false;
        this.slot = this.slot2 = null;
    }

    headPosition(out) {
        return out.copy(this.pos).setY(this.pos.y + 1.65);
    }
}

export class Bug {
    constructor() {
        this.root = makeBugMesh();
        this.root.visible = false;
        this.root.userData.bug = this;
        this.root.add(new THREE.Mesh(bugHitGeo, shared.hit));
        this.start = new THREE.Vector3();
        this.active = false;
    }

    launch(from, duration) {
        this.start.copy(from);
        this.root.position.copy(from);
        this.t = 0;
        this.duration = duration;
        this.active = true;
        this.root.visible = true;
    }

    /** @returns {boolean} true when the bug reaches the player. */
    update(dt, target) {
        this.t += dt / this.duration;
        const k = Math.min(1, this.t);
        this.root.position.lerpVectors(this.start, target, k * k * 0.4 + k * 0.6);
        this.root.position.y += Math.sin(Math.PI * k) * 0.9;
        this.root.rotation.x += dt * 7;
        this.root.rotation.y += dt * 9;
        this.root.scale.setScalar(1 + k * 0.8);
        return this.t >= 1;
    }

    release() {
        this.active = false;
        this.root.visible = false;
    }
}

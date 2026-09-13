import * as THREE from 'three';

// Materials: machined dark aluminium, like the prototype photographs.
const M = {
  hull:   new THREE.MeshStandardMaterial({ name: 'anodized_black', color: 0x23262a, roughness: 0.42, metalness: 0.72 }),
  panel:  new THREE.MeshStandardMaterial({ name: 'brushed_plate',  color: 0x2a2d31, roughness: 0.46, metalness: 0.8 }),
  edgeTrim: new THREE.MeshStandardMaterial({ name: 'edge_trim',    color: 0x1a1c1f, roughness: 0.55, metalness: 0.6 }),
  hub:    new THREE.MeshStandardMaterial({ name: 'hub_steel',      color: 0x416180, roughness: 0.3,  metalness: 0.9 }),
  steel:  new THREE.MeshStandardMaterial({ name: 'raw_steel',      color: 0x8d9298, roughness: 0.28, metalness: 0.95 }),
  screw:  new THREE.MeshStandardMaterial({ name: 'screw',          color: 0x9aa0a7, roughness: 0.35, metalness: 0.95 }),
  tire:   new THREE.MeshStandardMaterial({ name: 'rubber',         color: 0x17181a, roughness: 0.95, metalness: 0.0 })
};

function part(name, geo, mat) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const SCREW_GEO = new THREE.CylinderGeometry(0.0026, 0.0026, 0.0016, 10);
const SCREW_SLOT = new THREE.BoxGeometry(0.0036, 0.0006, 0.0009);

function screw(x, y, z, rx = 0, ry = 0) {
  const g = new THREE.Group();
  g.name = 'screw';
  const head = part('screw_head', SCREW_GEO, M.screw);
  g.add(head);
  const slot = part('screw_slot', SCREW_SLOT, M.edgeTrim);
  slot.position.y = 0.0009;
  g.add(slot);
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, 0);
  return g;
}

function logoTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  g.font = '700 190px "Barlow Condensed", "Barlow", sans-serif';
  g.textBaseline = 'middle';
  const wr = g.measureText('R').width, w3 = g.measureText('3').width;
  const x = (512 - (wr + w3)) / 2;
  g.fillStyle = '#e8eaed'; g.fillText('R', x, 134);
  g.fillStyle = '#5980a6'; g.fillText('3', x + wr, 134);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildR3() {
  const root = new THREE.Group();
  root.name = 'R3';

  const LEN_F = 0.235, LEN_R = -0.205, H = 0.130, FLOOR = 0.004, BODY_W = 0.235;
  const slope = Math.atan((H - FLOOR) / (LEN_F - LEN_R));
  const deckY = (z) => FLOOR + (LEN_F - z) * Math.tan(slope);

  // --- central wedge hull -------------------------------------------------
  const profile = new THREE.Shape();
  profile.moveTo(LEN_F, FLOOR);
  profile.lineTo(LEN_R, H);
  profile.lineTo(LEN_R, FLOOR);
  profile.closePath();
  const hull = part('hull', new THREE.ExtrudeGeometry(profile, {
    depth: BODY_W, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0016, bevelSegments: 2
  }), M.hull);
  hull.rotation.y = -Math.PI / 2;
  hull.position.x = BODY_W / 2;
  root.add(hull);

  // brushed side plates, inset from the hull flanks
  [1, -1].forEach((s) => {
    const p = new THREE.Shape();
    p.moveTo(LEN_F - 0.055, FLOOR + 0.010);
    p.lineTo(LEN_R + 0.020, H - 0.022);
    p.lineTo(LEN_R + 0.020, FLOOR + 0.010);
    p.closePath();
    const plate = part('side_plate', new THREE.ExtrudeGeometry(p, { depth: 0.003, bevelEnabled: false }), M.panel);
    plate.rotation.y = -Math.PI / 2;
    plate.position.x = s * (BODY_W / 2 + 0.0015) + (s > 0 ? 0.003 : 0);
    root.add(plate);
    [[-0.16, 0.024], [-0.05, 0.024], [-0.16, 0.09], [0.07, 0.022]].forEach(([z, y]) =>
      root.add(screw(s * (BODY_W / 2 + 0.004), y, z, 0, 0, Math.PI / 2))
    );
  });
  // side-plate screws lie flat against the flank
  root.children.filter(c => c.name === 'screw' && Math.abs(c.position.x) > BODY_W / 2).forEach(c => { c.rotation.z = Math.PI / 2; });

  // --- deck detail: hatch, vent, screw rows ------------------------------
  const hatch = part('deck_hatch', new THREE.BoxGeometry(0.10, 0.0035, 0.085), M.panel);
  hatch.rotation.x = slope;
  hatch.position.set(0, deckY(-0.10) + 0.0015, -0.10);
  root.add(hatch);

  for (let i = 0; i < 5; i++) {
    const z = 0.10 - i * 0.075;
    [1, -1].forEach((s) => root.add(screw(s * (BODY_W / 2 - 0.014), deckY(z) + 0.0008, z, slope)));
  }
  [[-0.055, 0.062], [-0.145, 0.062], [-0.055, -0.062], [-0.145, -0.062]].forEach(([z, x]) =>
    root.add(screw(x, deckY(z) + 0.0008, z, slope))
  );

  // --- R3 mark on the sloped deck ----------------------------------------
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.115, 0.058),
    new THREE.MeshStandardMaterial({ name: 'mark', map: logoTexture(), transparent: true, roughness: 0.6, metalness: 0.0 })
  );
  logo.name = 'mark';
  logo.rotation.x = -Math.PI / 2 + slope;
  logo.position.set(0, deckY(0.035) + 0.0014, 0.035);
  root.add(logo);

  // --- front / side ramps (the V plow) -----------------------------------
  const rampGeo = new THREE.BoxGeometry(0.165, 0.005, 0.26);
  [1, -1].forEach((s) => {
    const fan = new THREE.Group();
    fan.name = s > 0 ? 'ramp_right' : 'ramp_left';
    fan.position.set(0, FLOOR + 0.002, LEN_F + 0.008);
    fan.rotation.y = -s * 0.34;
    const roll = new THREE.Group();
    roll.rotation.z = s * 0.30;

    const plate = part('ramp_plate', rampGeo, M.hull);
    plate.position.set(s * 0.082, 0, -0.132);
    roll.add(plate);

    const rail = part('ramp_rail', new THREE.BoxGeometry(0.009, 0.018, 0.26), M.edgeTrim);
    rail.position.set(s * 0.161, 0.010, -0.132);
    roll.add(rail);

    const lip = part('ramp_lip', new THREE.BoxGeometry(0.165, 0.010, 0.010), M.edgeTrim);
    lip.position.set(s * 0.082, 0.0035, -0.257);
    roll.add(lip);

    for (let i = 0; i < 4; i++) {
      const zz = -0.045 - i * 0.06;
      roll.add(screw(s * 0.145, 0.0034, zz));
      roll.add(screw(s * 0.028, 0.0034, zz));
    }
    fan.add(roll);
    root.add(fan);
  });

  // --- rear bulkhead + weapon mounts -------------------------------------
  [1, -1].forEach((s) => {
    const mount = part('weapon_mount', new THREE.BoxGeometry(0.014, 0.075, 0.045), M.edgeTrim);
    mount.position.set(s * 0.128, H - 0.012, LEN_R + 0.026);
    root.add(mount);
    const gusset = part('mount_gusset', new THREE.BoxGeometry(0.010, 0.030, 0.028), M.panel);
    gusset.position.set(s * 0.128, H - 0.050, LEN_R + 0.040);
    root.add(gusset);
  });

  // --- drum weapon --------------------------------------------------------
  const drum = new THREE.Group();
  drum.name = 'drum_assembly';
  const shaft = part('drum_shaft', new THREE.CylinderGeometry(0.011, 0.011, 0.27, 28), M.steel);
  shaft.rotation.z = Math.PI / 2;
  drum.add(shaft);

  for (let i = 0; i < 4; i++) {
    const x = -0.087 + i * 0.058;
    const band = part('drum_band', new THREE.CylinderGeometry(0.018, 0.018, 0.022, 28), M.edgeTrim);
    band.rotation.z = Math.PI / 2;
    band.position.x = x;
    drum.add(band);
    for (let t = 0; t < 3; t++) {
      const a = (t / 3) * Math.PI * 2 + i * 0.5;
      const tooth = part('drum_tooth', new THREE.BoxGeometry(0.008, 0.030, 0.013), M.panel);
      tooth.position.set(x, Math.cos(a) * 0.028, Math.sin(a) * 0.028);
      tooth.rotation.x = -a;
      drum.add(tooth);
    }
  }
  [1, -1].forEach((s) => {
    const cap = part('drum_hub', new THREE.CylinderGeometry(0.026, 0.026, 0.020, 32), M.hub);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = s * 0.135;
    drum.add(cap);
    const capFace = part('drum_hub_face', new THREE.CylinderGeometry(0.013, 0.013, 0.022, 24), M.edgeTrim);
    capFace.rotation.z = Math.PI / 2;
    capFace.position.x = s * 0.1365;
    drum.add(capFace);
    const motor = part('weapon_motor', new THREE.CylinderGeometry(0.019, 0.019, 0.052, 24), M.edgeTrim);
    motor.rotation.z = Math.PI / 2;
    motor.position.set(s * 0.072, -0.030, 0.004);
    drum.add(motor);
  });
  drum.position.set(0, H + 0.020, LEN_R + 0.022);
  root.add(drum);

  // --- drive wheels -------------------------------------------------------
  [1, -1].forEach((s) => {
    const w = new THREE.Group();
    w.name = s > 0 ? 'wheel_right' : 'wheel_left';
    const tire = part('tire', new THREE.CylinderGeometry(0.056, 0.056, 0.044, 40), M.tire);
    tire.rotation.z = Math.PI / 2;
    w.add(tire);
    const rim = part('rim', new THREE.CylinderGeometry(0.028, 0.028, 0.048, 28), M.hub);
    rim.rotation.z = Math.PI / 2;
    w.add(rim);
    const rimFace = part('rim_face', new THREE.CylinderGeometry(0.014, 0.014, 0.05, 20), M.steel);
    rimFace.rotation.z = Math.PI / 2;
    w.add(rimFace);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const tread = part('tread', new THREE.BoxGeometry(0.044, 0.005, 0.011), M.tire);
      tread.position.set(0, Math.cos(a) * 0.0545, Math.sin(a) * 0.0545);
      tread.rotation.x = -a;
      w.add(tread);
    }
    w.position.set(s * (BODY_W / 2 + 0.026), 0.056, LEN_R + 0.075);
    root.add(w);

    const axle = part('axle', new THREE.CylinderGeometry(0.009, 0.009, 0.05, 20), M.steel);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(s * (BODY_W / 2 + 0.005), 0.056, LEN_R + 0.075);
    root.add(axle);
  });

  // --- rear support wheel -------------------------------------------------
  const caster = new THREE.Group();
  caster.name = 'support_wheel';
  const cw = part('support_tire', new THREE.CylinderGeometry(0.026, 0.026, 0.020, 28), M.tire);
  cw.rotation.z = Math.PI / 2;
  caster.add(cw);
  const chub = part('support_hub', new THREE.CylinderGeometry(0.011, 0.011, 0.024, 18), M.hub);
  chub.rotation.z = Math.PI / 2;
  caster.add(chub);
  const fork = part('support_fork', new THREE.BoxGeometry(0.034, 0.042, 0.008), M.edgeTrim);
  fork.position.y = 0.028;
  caster.add(fork);
  caster.position.set(0, 0.026, LEN_R - 0.012);
  root.add(caster);

  return root;
}

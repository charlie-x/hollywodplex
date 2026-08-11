/*
 * employee-plaque.js — the employee of the month display for the wall
 * behind the checkout counter.
 */

import * as THREE from 'three';

const HV_NAVY = '#131c3a';
const HV_RED = '#d42027';

/*
 * employee of the month plaque: gold frame, portrait, name plate.
 * kris has held the title since the store opened.
 */
export function createEmployeeOfMonth(position, rotationY = 0) {
  const group = new THREE.Group();

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 1.12, 0.04),
    new THREE.MeshStandardMaterial({ color: '#b08a1a', roughness: 0.4, metalness: 0.5 }),
  );
  group.add(frame);

  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 1.04),
    new THREE.MeshStandardMaterial({ map: employeeTexture(), roughness: 0.6 }),
  );
  plaque.position.z = 0.025;
  group.add(plaque);

  group.position.copy(position);
  group.rotation.y = rotationY;
  group.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  group.updateMatrix();
  group.matrixAutoUpdate = false;
  return group;
}

/*
 * hand-drawn plaque art: header, kris's portrait, gold name plate.
 */
function employeeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#efe9da';
  ctx.fillRect(0, 0, 384, 512);

  // header band
  ctx.fillStyle = HV_NAVY;
  ctx.fillRect(0, 0, 384, 78);
  ctx.fillStyle = '#f0c419';
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EMPLOYEE OF', 192, 34);
  ctx.fillText('THE MONTH', 192, 66);

  // portrait: kris, twenties, long blonde pigtails, red staff polo
  // long hair behind first, face over it, fringe and pigtails on top
  ctx.fillStyle = '#e8c95a';
  ctx.beginPath();
  ctx.ellipse(192, 190, 92, 96, 0, 0, Math.PI * 2);
  ctx.fill();
  // long falls of hair framing the face down past the shoulders
  ctx.beginPath();
  ctx.moveTo(104, 180);
  ctx.quadraticCurveTo(88, 280, 100, 388);
  ctx.lineTo(140, 388);
  ctx.quadraticCurveTo(122, 280, 126, 200);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(280, 180);
  ctx.quadraticCurveTo(296, 280, 284, 388);
  ctx.lineTo(244, 388);
  ctx.quadraticCurveTo(262, 280, 258, 200);
  ctx.closePath();
  ctx.fill();
  // pigtails: high bunches swinging out either side
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(192 + side * 88, 150);
    ctx.quadraticCurveTo(192 + side * 150, 180, 192 + side * 140, 300);
    ctx.quadraticCurveTo(192 + side * 128, 330, 192 + side * 112, 300);
    ctx.quadraticCurveTo(192 + side * 108, 200, 192 + side * 78, 168);
    ctx.closePath();
    ctx.fill();
  }
  // pink streaks running through the fringe, falls and pigtails
  ctx.strokeStyle = '#e87ab8';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // fringe streak
  ctx.moveTo(140, 152);
  ctx.quadraticCurveTo(190, 130, 248, 140);
  // left and right falls
  ctx.moveTo(112, 210);
  ctx.quadraticCurveTo(100, 290, 112, 380);
  ctx.moveTo(272, 210);
  ctx.quadraticCurveTo(284, 290, 272, 380);
  ctx.stroke();
  // pigtail streaks
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(192 + side * 96, 164);
    ctx.quadraticCurveTo(192 + side * 138, 190, 192 + side * 128, 296);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#f2cfae'; // face
  ctx.beginPath();
  ctx.ellipse(192, 210, 74, 84, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c95a'; // side-swept fringe
  ctx.beginPath();
  ctx.moveTo(110, 170);
  ctx.quadraticCurveTo(150, 96, 268, 126);
  ctx.quadraticCurveTo(282, 150, 274, 172);
  ctx.quadraticCurveTo(220, 138, 168, 156);
  ctx.quadraticCurveTo(132, 168, 110, 170);
  ctx.fill();
  // hazel eyes and brows
  ctx.fillStyle = '#8a6b3a';
  ctx.beginPath();
  ctx.ellipse(162, 208, 8, 11, 0, 0, Math.PI * 2);
  ctx.ellipse(222, 208, 8, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9a83e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(148, 188); ctx.quadraticCurveTo(162, 182, 176, 188);
  ctx.moveTo(208, 188); ctx.quadraticCurveTo(222, 182, 236, 188);
  ctx.stroke();
  // freckles and a big grin
  ctx.fillStyle = '#dda87e';
  for (const [fx, fy] of [[150, 232], [160, 238], [170, 233], [214, 233], [224, 238], [234, 232]]) {
    ctx.fillRect(fx, fy, 3, 3);
  }
  ctx.strokeStyle = '#b05a48';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(158, 258);
  ctx.quadraticCurveTo(192, 284, 226, 258);
  ctx.stroke();
  // red staff polo with a natural fit and a name badge
  ctx.fillStyle = HV_RED;
  ctx.beginPath();
  ctx.moveTo(84, 400);
  ctx.quadraticCurveTo(92, 328, 148, 306);
  ctx.quadraticCurveTo(192, 294, 236, 306);
  ctx.quadraticCurveTo(292, 328, 300, 400);
  ctx.closePath();
  ctx.fill();
  // navy collar
  ctx.strokeStyle = HV_NAVY;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(158, 310);
  ctx.quadraticCurveTo(192, 330, 226, 310);
  ctx.stroke();
  // soft fold shading where the polo fits her figure
  ctx.strokeStyle = '#a3161c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(122, 370);
  ctx.quadraticCurveTo(154, 392, 186, 378);
  ctx.moveTo(198, 378);
  ctx.quadraticCurveTo(230, 392, 262, 370);
  ctx.stroke();
  ctx.fillStyle = '#f6f4ea';
  ctx.fillRect(242, 344, 44, 20);

  // gold name plate with a star
  ctx.fillStyle = '#b08a1a';
  ctx.fillRect(72, 416, 240, 56);
  ctx.fillStyle = HV_NAVY;
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.fillText('* KRIS *', 192, 456);
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.fillStyle = '#6a614c';
  ctx.fillText('14 MONTHS RUNNING', 192, 498);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}


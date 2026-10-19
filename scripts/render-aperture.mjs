import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

// A real local Three.js studio render of the canonical DEEP symbol.
// Recreate with `node scripts/render-aperture.mjs`; no remote textures or models.
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const artwork = JSON.parse(await fs.readFile(path.join(root, 'src/config/brandArtwork.json'), 'utf8'));
const html = `<!doctype html><html><head><style>*{margin:0}html,body{width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script></head><body><script type="module">
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();
const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, preserveDrawingBuffer:true});
renderer.setSize(1200,1320); renderer.setPixelRatio(1);
renderer.setClearColor(0x030810,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(32,1200/1320,.1,100);
camera.position.set(0,0,13.5);camera.lookAt(0,0,0);
const studio=new THREE.Scene();studio.background=new THREE.Color(0x10151b);
const panel=(w,h,color,p,rotation)=>{ const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));mesh.position.set(...p);mesh.lookAt(0,0,0);if(rotation)mesh.rotateZ(rotation);studio.add(mesh);return mesh; };
panel(7,10,new THREE.Color(1.3,1.4,1.6),[-6,5,6]);
panel(2,11,new THREE.Color(2.2,2.5,2.9),[6,0,3]);
panel(10,3,new THREE.Color(1.6,1.55,1.4),[0,7,3]);
panel(4,10,new THREE.Color(.16,.23,.32),[0,0,9]);
panel(5,8,new THREE.Color(.6,.75,.95),[-4,-5,3]);
panel(5,10,new THREE.Color(2.5,2.35,2.15),[8,1,-4]);
panel(3,9,new THREE.Color(1.8,1.85,1.9),[-7,1,3]);
const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromScene(studio,.045);scene.environment=environment.texture;
const key = new THREE.RectAreaLight(0xdfe8ee,1.8,5,8);key.position.set(-5,5,7);key.lookAt(0,0,0);scene.add(key);
const fill = new THREE.RectAreaLight(0x8aa0b9,1.6,3,7);fill.position.set(5,-1,4);fill.lookAt(0,0,0);scene.add(fill);
const rim = new THREE.RectAreaLight(0xf0dfcb,2,8,1);rim.position.set(0,6,-1);rim.lookAt(0,0,0);scene.add(rim);
const sculpture=new THREE.Group();
const svg='<svg xmlns="http://www.w3.org/2000/svg">'+${JSON.stringify(artwork.symbol.paths)}.map(d=>'<path d="'+d+'"/>').join('')+'</svg>';
const data=new SVGLoader().parse(svg);
const material=new THREE.MeshStandardMaterial({color:0x30353b,metalness:1,roughness:.32,envMapIntensity:1.05});
data.paths.forEach((p,i)=>{
 for(const shape of SVGLoader.createShapes(p)){
 let geometry=new THREE.ExtrudeGeometry(shape,{depth:8,bevelEnabled:true,bevelThickness:.95,bevelSize:.95,bevelSegments:8,curveSegments:80,steps:1});
 geometry.translate(-32,-32,-4);geometry.scale(.1,.1,.1);geometry.deleteAttribute("normal");geometry.deleteAttribute("uv");geometry=mergeVertices(geometry,.0001);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,[material,new THREE.MeshStandardMaterial({color:0x5f656b,metalness:1,roughness:.3,envMapIntensity:1.05})]);mesh.scale.y=-1;mesh.position.z=i===0?.12:-.12;sculpture.add(mesh);
 }
});
sculpture.rotation.set(-.2,-.58,-.18);scene.add(sculpture);
renderer.render(scene,camera);
window.renderDone=true;
window.renderInfo={renderer:renderer.info.render,objectBounds:new THREE.Box3().setFromObject(sculpture).getSize(new THREE.Vector3()).toArray(),background:'#030810 (transparent alpha)'};
</script></body></html>`;
const server=http.createServer(async(req,res)=>{
 try {
  if(req.url==='/'){res.setHeader('content-type','text/html');res.end(html);return;}
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const content=await fs.readFile(file);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(content);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1320},deviceScaleFactor:1});
 page.on('pageerror',error=>console.error(error));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>window.renderDone);
 const png=Buffer.from((await page.evaluate(()=>document.querySelector('canvas').toDataURL('image/png'))).split(',')[1],'base64');
 const out=path.join(root,'public/images');await fs.mkdir(out,{recursive:true});
 await sharp(png).webp({quality:94,alphaQuality:100,effort:6}).toFile(path.join(out,'aperture-sculpture.webp'));
 await sharp(png).flatten({background:'#030810'}).png().toFile(path.join(root,'docs/screenshots/aperture-sculpture-review.png'));
 const info=await page.evaluate(()=>window.renderInfo);console.log(JSON.stringify(info));
}finally{await browser.close();server.close();}
